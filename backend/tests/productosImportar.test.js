// Productos con código de barras e importación desde Excel / CSV en el POS.

const db = { productos: [], sig: 1 };
const repetido = () => Object.assign(new Error('duplicate key'), { code: '23505' });
const chocaCodigo = (codigo, local, id) =>
  codigo && db.productos.some(p => p.activo && p.local === local && p.codigo_barras === codigo && p.id !== id);

const query = async (sql, params = []) => {
  if (/^(BEGIN|COMMIT|ROLLBACK|SAVEPOINT|RELEASE)/.test(sql)) return { rows: [] };
  if (sql.includes('FROM locales WHERE id')) return { rows: params[0] === 7 ? [{ nombre: 'Kiosco' }] : [] };
  if (sql.includes('FROM locales')) return { rows: ['Kiosco', 'Comedor'].includes(params[1]) ? [{}] : [] };
  if (sql.includes('AND codigo_barras = $3')) {
    return { rows: db.productos.filter(p => p.activo && p.local === params[1] && p.codigo_barras === params[2]) };
  }
  if (sql.includes('lower(nombre) = lower($3)')) {
    return { rows: db.productos.filter(p => p.activo && p.local === params[1] && p.nombre.toLowerCase() === params[2].toLowerCase()) };
  }
  if (sql.startsWith('UPDATE productos SET nombre = $1, precio = $2, categoria = COALESCE')) {
    const [nombre, precio, categoria, codigo, stock, id] = params;
    const p = db.productos.find(x => x.id === id);
    if (codigo && chocaCodigo(codigo, p.local, id)) throw repetido();
    Object.assign(p, { nombre, precio, categoria: categoria ?? p.categoria, codigo_barras: codigo ?? p.codigo_barras, stock: stock ?? p.stock });
    return { rows: [p] };
  }
  if (sql.includes('INSERT INTO productos')) {
    const [nombre, precio, stock, categoria, local, colegio_id, codigo_barras] = params;
    if (chocaCodigo(codigo_barras, local)) throw repetido();
    const p = { id: db.sig++, nombre, precio, stock, categoria, local, colegio_id, codigo_barras, activo: true };
    db.productos.push(p);
    return { rows: [p] };
  }
  if (sql.includes('SELECT * FROM productos WHERE id = $1')) return { rows: db.productos.filter(p => p.id === Number(params[0])) };
  if (sql.startsWith('UPDATE productos SET nombre = $1, precio = $2, categoria = $3, codigo_barras = $4')) {
    const p = db.productos.find(x => x.id === Number(params.at(-1)));
    if (chocaCodigo(params[3], p.local, p.id)) throw repetido();
    Object.assign(p, { nombre: params[0], precio: params[1], categoria: params[2], codigo_barras: params[3] });
    return { rows: [p] };
  }
  return { rows: [] };
};

jest.mock('../src/db/conexion', () => ({
  query: (...a) => query(...a),
  connect: async () => ({ query: (...a) => query(...a), release: () => {} }),
}));
jest.mock('../src/controllers/auditoriaController', () => ({ registrar: jest.fn() }));

const { importarProductos, crearProducto, actualizarProducto } = require('../src/controllers/productosController');

const respuesta = () => { const res = { status: jest.fn(() => res), json: jest.fn() }; return res; };
const cajero = { id: 1, colegio_id: 3, local_id: null };
const importar = async (productos, empleado = cajero, local = 'Kiosco') => {
  const res = respuesta();
  await importarProductos({ empleado, body: { local, productos } }, res);
  return res;
};

beforeEach(() => {
  db.sig = 1;
  db.productos = [
    { id: db.sig++, nombre: 'Alfajor', precio: 500, stock: 4, categoria: 'golosina', local: 'Kiosco', codigo_barras: '7790580000011', activo: true },
    { id: db.sig++, nombre: 'Agua', precio: 700, stock: 10, categoria: 'bebida', local: 'Kiosco', codigo_barras: null, activo: true },
  ];
});

test('crea los nuevos y actualiza los existentes por código o por nombre', async () => {
  const res = await importar([
    { fila: 2, nombre: 'Alfajor triple', precio: 800, codigo_barras: '7790580000011' }, // mismo código → actualiza
    { fila: 3, nombre: 'AGUA', precio: 750, stock: 24, codigo_barras: '7798' },          // mismo nombre → actualiza y suma código
    { fila: 4, nombre: 'Lápiz', precio: 300, stock: 50, categoria: 'Útiles' },          // nuevo
  ]);
  expect(res.json).toHaveBeenCalledWith({ creados: 1, actualizados: 2, errores: [] });
  expect(db.productos[0]).toMatchObject({ nombre: 'Alfajor triple', precio: 800, stock: 4 }); // sin stock en el archivo, no lo toca
  expect(db.productos[1]).toMatchObject({ precio: 750, stock: 24, codigo_barras: '7798' });
  expect(db.productos[2]).toMatchObject({ nombre: 'Lápiz', categoria: 'útil', stock: 50, local: 'Kiosco' });
});

test('las filas con errores se informan y no frenan al resto', async () => {
  db.productos.push({ id: db.sig++, nombre: 'Chicle', precio: 100, stock: 1, local: 'Kiosco', codigo_barras: '111', activo: true });
  const res = await importar([
    { fila: 2, nombre: '', precio: 100 },
    { fila: 3, nombre: 'Turrón', precio: 0 },
    { fila: 4, nombre: 'Jugo', precio: 900, stock: -2 },
    { fila: 5, nombre: 'Chicle menta', precio: 150, codigo_barras: '111' }, // el código manda: actualiza Chicle
    { fila: 6, nombre: 'Galletitas', precio: 1200 },
  ]);
  const { creados, actualizados, errores } = res.json.mock.calls[0][0];
  expect(creados).toBe(1);
  expect(actualizados).toBe(1);
  expect(errores.map(e => e.fila)).toEqual([2, 3, 4]);
  expect(errores[2].error).toMatch(/stock/);
  expect(db.productos.find(p => p.codigo_barras === '111').nombre).toBe('Chicle menta');
});

test('un empleado con zona fija siempre importa en su zona', async () => {
  await importar([{ nombre: 'Tostado', precio: 1500 }], { ...cajero, local_id: 7 }, 'Comedor');
  expect(db.productos.at(-1)).toMatchObject({ nombre: 'Tostado', local: 'Kiosco' });
});

test('rechaza archivos vacíos, demasiado grandes o de otra zona', async () => {
  expect((await importar([])).status).toHaveBeenCalledWith(400);
  expect((await importar(Array.from({ length: 1001 }, () => ({ nombre: 'x', precio: 1 })))).status).toHaveBeenCalledWith(400);
  expect((await importar([{ nombre: 'x', precio: 1 }], cajero, 'Otra')).status).toHaveBeenCalledWith(400);
});

test('el mismo código de barras no puede estar en dos productos de la zona', async () => {
  const res = respuesta();
  await crearProducto({ empleado: cajero, body: { nombre: 'Otro', precio: 100, local: 'Kiosco', codigo_barras: ' 7790580000011 ' } }, res);
  expect(res.status).toHaveBeenCalledWith(409);

  const ok = respuesta();
  await actualizarProducto({ empleado: cajero, params: { id: '2' }, body: { nombre: 'Agua', precio: 700, codigo_barras: '7790' } }, ok);
  expect(ok.status).not.toHaveBeenCalled();
  expect(db.productos[1].codigo_barras).toBe('7790');

  const choca = respuesta();
  await actualizarProducto({ empleado: cajero, params: { id: '2' }, body: { nombre: 'Agua', precio: 700, codigo_barras: '7790580000011' } }, choca);
  expect(choca.status).toHaveBeenCalledWith(409);
});
