// Recepción de un pedido al proveedor: lo que llegó se suma al stock del
// producto de venta de la zona (por código de barras o nombre), su precio de
// compra queda el recibido, y si no se vendía todavía se crea con el precio
// de venta que pone el empleado. Si llegó menos de lo pedido queda "incompleto".

let db;
const reiniciar = () => {
  db = {
    pedido: { id: 1, colegio_id: 3, proveedor_id: 9, local: 'Kiosco', estado: 'pedido' },
    items: [
      { id: 11, pedido_id: 1, proveedor_producto_id: 101, nombre: 'Alfajor Jorgito', codigo_barras: '779001', categoria: 'golosina', unidades_bulto: 12, bultos: 2, precio_compra: '500' },
      { id: 12, pedido_id: 1, proveedor_producto_id: 102, nombre: 'Agua 500 ml', codigo_barras: null, categoria: 'bebida', unidades_bulto: 6, bultos: 1, precio_compra: '400' },
    ],
    productos: [{ id: 7, colegio_id: 3, local: 'Kiosco', nombre: 'Alfajor Jorgito', codigo_barras: '779001', stock: 5, costo: null, activo: true }],
    catalogo: { 101: { precio_compra: 500 }, 102: { precio_compra: 400 } },
  };
};

const ejecutar = async (sql, p = []) => {
  if (sql.startsWith('SELECT * FROM pedidos_proveedor WHERE id')) return { rows: Number(p[0]) === db.pedido.id ? [{ ...db.pedido }] : [] };
  if (sql.startsWith('SELECT * FROM pedido_items')) return { rows: db.items.map(i => ({ ...i })) };
  if (sql.startsWith('SELECT * FROM productos WHERE colegio_id')) {
    return { rows: db.productos.filter(x => x.local === p[1] && ((p[2] && x.codigo_barras === p[2]) || x.nombre.toLowerCase() === p[3].toLowerCase())) };
  }
  if (sql.startsWith('UPDATE productos SET stock')) { const x = db.productos.find(y => y.id === p[3]); x.stock += p[0]; x.costo = p[1]; return { rows: [] }; }
  if (sql.startsWith('INSERT INTO productos')) {
    const x = { id: 50 + db.productos.length, nombre: p[0], precio: p[1], stock: p[2], categoria: p[3], local: p[4], codigo_barras: p[6], costo: p[7], activo: true };
    db.productos.push(x); return { rows: [x] };
  }
  if (sql.startsWith('UPDATE pedido_items')) { const i = db.items.find(y => y.id === p[3]); i.cantidad_recibida = p[0]; i.precio_recibido = p[1]; return { rows: [] }; }
  if (sql.startsWith('UPDATE proveedor_productos SET precio_compra')) { db.catalogo[p[1]].precio_compra = p[0]; return { rows: [] }; }
  if (sql.startsWith('UPDATE pedidos_proveedor SET estado')) { db.pedido.estado = p[0]; return { rows: [] }; }
  return { rows: [] };
};

jest.mock('../src/db/conexion', () => ({
  query: (...a) => ejecutar(...a),
  connect: async () => ({ query: (...a) => ejecutar(...a), release: () => {} }),
}));
jest.mock('../src/controllers/auditoriaController', () => ({ registrar: async () => {} }));

const { recibirPedido } = require('../src/controllers/proveedoresController');

const respuesta = () => { const res = { status: jest.fn(() => res), json: jest.fn() }; return res; };
const cajero = { id: 10, colegio_id: 3, local_id: null };
const recibir = async items => { const res = respuesta(); await recibirPedido({ empleado: cajero, params: { id: 1 }, body: { items } }, res); return res; };

beforeEach(reiniciar);

test('todo completo: suma al stock, actualiza el precio de compra y crea lo que no se vendía', async () => {
  const res = await recibir([
    { id: 11, cantidad_recibida: 24 },
    { id: 12, cantidad_recibida: 6, precio_venta: 1000 },
  ]);
  expect(res.json.mock.calls[0][0]).toMatchObject({ estado: 'recibido', unidades: 30 });
  expect(db.productos.find(x => x.id === 7)).toMatchObject({ stock: 29, costo: 500 });
  expect(db.productos.find(x => x.nombre === 'Agua 500 ml')).toMatchObject({ stock: 6, precio: 1000, costo: 400, categoria: 'bebida' });
});

test('si llegó menos queda incompleto, y un precio nuevo actualiza el catálogo', async () => {
  const res = await recibir([
    { id: 11, cantidad_recibida: 20, precio_recibido: 550 },
    { id: 12, cantidad_recibida: 0 },
  ]);
  expect(res.json.mock.calls[0][0].estado).toBe('incompleto');
  expect(db.productos.find(x => x.id === 7)).toMatchObject({ stock: 25, costo: 550 });
  expect(db.catalogo[101].precio_compra).toBe(550);
  expect(db.productos).toHaveLength(1); // el agua no llegó: no se crea
});

test('un producto nuevo sin precio de venta no se puede recibir', async () => {
  const res = await recibir([{ id: 11, cantidad_recibida: 24 }, { id: 12, cantidad_recibida: 6 }]);
  expect(res.status).toHaveBeenCalledWith(400);
  expect(res.json.mock.calls[0][0]).toMatchObject({ falta_precio_venta: true, item_id: 12 });
});

test('un pedido ya recibido no se recibe dos veces', async () => {
  db.pedido.estado = 'recibido';
  const res = await recibir([{ id: 11, cantidad_recibida: 24 }]);
  expect(res.status).toHaveBeenCalledWith(400);
  expect(db.productos.find(x => x.id === 7).stock).toBe(5);
});
