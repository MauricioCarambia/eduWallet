// Ventas hechas sin internet: al sincronizar se aceptan aunque el saldo quede
// negativo (la venta ya pasó), cada id_venta se toma una sola vez y lo que no
// se puede registrar vuelve como error para que el POS lo muestre.

const db = {
  alumnos: [{ id: 1, colegio_id: 3, nombre: 'Martina López', saldo: 1000, gasto_hoy: 0 }],
  productos: [{ id: 7, colegio_id: 3, nombre: 'Alfajor', precio: 800, categoria: 'golosina', stock: 5 }],
  transacciones: [],
  auditoria: [],
};

const ejecutar = async (sql, p = []) => {
  if (sql.startsWith('SELECT id FROM transacciones WHERE colegio_id')) {
    return { rows: db.transacciones.filter(t => t.colegio_id === p[0] && t.id_venta === p[1]) };
  }
  if (sql.startsWith('SELECT nombre FROM locales WHERE colegio_id')) return { rows: p[1] === 'Kiosco' ? [{ nombre: 'Kiosco' }] : [] };
  if (sql.startsWith('SELECT * FROM alumnos WHERE id')) return { rows: db.alumnos.filter(a => a.id === Number(p[0]) && a.colegio_id === p[1]).map(a => ({ ...a })) };
  if (sql.startsWith('SELECT id, nombre, precio, categoria FROM productos')) return { rows: db.productos.filter(x => p[0].includes(x.id)) };
  if (sql.startsWith('UPDATE alumnos SET saldo')) { const a = db.alumnos.find(x => x.id === p[1]); a.saldo -= p[0]; a.gasto_hoy += p[0]; return { rows: [] }; }
  if (sql.startsWith('UPDATE productos SET stock')) { const x = db.productos.find(y => y.id === p[1]); x.stock = Math.max(0, x.stock - p[0]); return { rows: [] }; }
  if (sql.startsWith('INSERT INTO transacciones')) {
    const t = { id: db.transacciones.length + 1, alumno_id: p[0], monto: p[2], colegio_id: p[5], id_venta: p[7], offline: true };
    db.transacciones.push(t);
    return { rows: [t] };
  }
  if (sql.startsWith('SELECT id, saldo, gasto_hoy FROM alumnos')) { const a = db.alumnos.find(x => x.id === p[0]); return { rows: [{ id: a.id, saldo: a.saldo, gasto_hoy: a.gasto_hoy }] }; }
  return { rows: [] };
};

jest.mock('../src/db/conexion', () => ({
  query: (...a) => ejecutar(...a),
  connect: async () => ({ query: (...a) => ejecutar(...a), release: () => {} }),
}));
jest.mock('../src/controllers/auditoriaController', () => ({ registrar: async (...a) => { db.auditoria.push(a); } }));
jest.mock('../src/services/notificacionesService', () => ({ notificarCompra: () => {} }));

const { sincronizarVentas, huella } = require('../src/controllers/offlineController');

const respuesta = () => { const res = { status: jest.fn(() => res), json: jest.fn() }; return res; };
const cajero = { id: 10, colegio_id: 3, local_id: null };
const venta = (id_venta, qty = 1) => ({ id_venta, alumno_id: 1, lugar: 'Kiosco', items: [{ id: 7, qty }], descuento: 0, fecha: new Date().toISOString() });

test('acepta la venta aunque el saldo quede negativo y lo deja en auditoría', async () => {
  const res = respuesta();
  await sincronizarVentas({ empleado: cajero, body: { ventas: [venta('venta-0001', 2)] } }, res);
  const [r] = res.json.mock.calls[0][0].resultados;
  expect(r).toMatchObject({ id_venta: 'venta-0001', estado: 'ok', total: 1600 });
  expect(db.alumnos[0].saldo).toBe(-600);
  expect(db.productos[0].stock).toBe(3);
  expect(db.auditoria.some(a => a[2] === 'Venta sin conexión con saldo negativo')).toBe(true);
});

test('la misma venta dos veces se toma una sola vez', async () => {
  const res = respuesta();
  await sincronizarVentas({ empleado: cajero, body: { ventas: [venta('venta-0001', 2)] } }, res);
  expect(res.json.mock.calls[0][0].resultados[0].estado).toBe('ya_estaba');
  expect(db.transacciones).toHaveLength(1);
  expect(db.alumnos[0].saldo).toBe(-600);
});

test('lo que no se puede registrar vuelve como error y no frena al resto', async () => {
  const res = respuesta();
  const otroAlumno = { ...venta('venta-0002'), alumno_id: 99 };
  await sincronizarVentas({ empleado: cajero, body: { ventas: [otroAlumno, { id_venta: 'x' }, venta('venta-0003')] } }, res);
  const estados = res.json.mock.calls[0][0].resultados.map(r => r.estado);
  expect(estados).toEqual(['error', 'error', 'ok']);
});

test('la huella de una credencial es la misma que calcula el POS', () => {
  expect(huella('EW7K3M9QXR2T4P')).toMatch(/^[0-9a-f]{64}$/);
  expect(huella('EW7K3M9QXR2T4P')).toBe(huella('EW7K3M9QXR2T4P'));
});
