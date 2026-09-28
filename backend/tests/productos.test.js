// Cada zona gestiona sus productos: el empleado con zona fija sólo los de
// su zona; el admin y los empleados sin zona, todos. Base mockeada.

const db = { productos: [], locales: [{ id: 1, colegio_id: 3, nombre: 'Kiosco' }, { id: 2, colegio_id: 3, nombre: 'Librería' }] };

const fakeQuery = async (sql, params = []) => {
  if (sql.startsWith('SELECT nombre FROM locales')) {
    return { rows: db.locales.filter(l => l.id === params[0] && l.colegio_id === params[1]) };
  }
  if (sql.startsWith('SELECT 1 FROM locales')) {
    return { rows: db.locales.filter(l => l.colegio_id === params[0] && l.nombre === params[1]) };
  }
  if (sql.startsWith('SELECT * FROM productos WHERE id')) {
    return { rows: db.productos.filter(p => p.id === Number(params[0]) && p.colegio_id === params[1] && p.activo) };
  }
  if (sql.startsWith('INSERT INTO productos')) {
    const [nombre, precio, stock, categoria, local, colegio_id] = params;
    const p = { id: db.productos.length + 1, nombre, precio, stock, categoria, local, colegio_id, activo: true };
    db.productos.push(p);
    return { rows: [p] };
  }
  if (sql.startsWith('UPDATE productos SET nombre')) {
    const p = db.productos.find(x => x.id === Number(params[3]));
    Object.assign(p, { nombre: params[0], precio: params[1], categoria: params[2] });
    return { rows: [p] };
  }
  if (sql.startsWith('UPDATE productos SET activo = false')) {
    db.productos.find(x => x.id === Number(params[0])).activo = false;
    return { rows: [] };
  }
  return { rows: [] };
};

jest.mock('../src/db/conexion', () => ({ query: (...a) => fakeQuery(...a) }));

const { crearProducto, actualizarProducto, eliminarProducto } = require('../src/controllers/productosController');

const respuesta = () => { const res = { status: jest.fn(() => res), json: jest.fn() }; return res; };
const kiosquero = { id: 10, rol: 'staff', colegio_id: 3, local_id: 1 };
const sinZona = { id: 11, rol: 'staff', colegio_id: 3, local_id: null };
const admin = { id: 1, rol: 'admin', colegio_id: 3, local_id: null };

beforeEach(() => {
  db.productos = [
    { id: 1, nombre: 'Alfajor', precio: '800', stock: 10, categoria: 'golosina', local: 'Kiosco', colegio_id: 3, activo: true },
    { id: 2, nombre: 'Cuaderno', precio: '3000', stock: 5, categoria: 'útil', local: 'Librería', colegio_id: 3, activo: true },
  ];
});

test('el kiosquero crea productos siempre en su zona', async () => {
  const res = respuesta();
  await crearProducto({ empleado: kiosquero, body: { nombre: 'Gaseosa', precio: 1500, stock: 20, categoria: 'bebida', local: 'Librería' } }, res);
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ nombre: 'Gaseosa', local: 'Kiosco' }));
});

test('el kiosquero edita y elimina productos de su zona', async () => {
  const editar = respuesta();
  await actualizarProducto({ empleado: kiosquero, params: { id: '1' }, body: { nombre: 'Alfajor triple', precio: 1200 } }, editar);
  expect(editar.json).toHaveBeenCalledWith(expect.objectContaining({ nombre: 'Alfajor triple', precio: 1200 }));
  const eliminar = respuesta();
  await eliminarProducto({ empleado: kiosquero, params: { id: '1' } }, eliminar);
  expect(db.productos[0].activo).toBe(false);
});

test('el kiosquero no puede tocar productos de otra zona', async () => {
  const editar = respuesta();
  await actualizarProducto({ empleado: kiosquero, params: { id: '2' }, body: { nombre: 'Cuaderno', precio: 1 } }, editar);
  expect(editar.status).toHaveBeenCalledWith(403);
  const eliminar = respuesta();
  await eliminarProducto({ empleado: kiosquero, params: { id: '2' } }, eliminar);
  expect(eliminar.status).toHaveBeenCalledWith(403);
  expect(db.productos[1]).toMatchObject({ precio: '3000', activo: true });
});

test('el admin y los empleados sin zona gestionan todas las zonas', async () => {
  for (const empleado of [admin, sinZona]) {
    const res = respuesta();
    await actualizarProducto({ empleado, params: { id: '2' }, body: { nombre: 'Cuaderno', precio: 3500 } }, res);
    expect(res.status).not.toHaveBeenCalled();
  }
});

test('valida nombre, precio y zona', async () => {
  for (const body of [{ nombre: '', precio: 100, local: 'Kiosco' }, { nombre: 'X', precio: 0, local: 'Kiosco' }, { nombre: 'X', precio: 100, local: 'Buffet' }]) {
    const res = respuesta();
    await crearProducto({ empleado: admin, body }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  }
});
