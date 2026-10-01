// Caja abierta y cerrada sin internet: al sincronizar se crea una sola vez con
// la hora real, las ventas hechas en ella la encuentran y el cierre se registra
// después de las ventas.

const db = {
  cajas: [{ id: 5, colegio_id: 3, empleado_id: 10, abierta: true, ventas: 0, tx_count: 0, id_local: null }],
  alumnos: [{ id: 1, colegio_id: 3, nombre: 'Martina López', saldo: 5000, gasto_hoy: 0 }],
  productos: [{ id: 7, colegio_id: 3, nombre: 'Alfajor', precio: 800, categoria: 'golosina', stock: 5 }],
  transacciones: [],
  orden: [],
};

const ejecutar = async (sql, p = []) => {
  if (sql.startsWith('SELECT id FROM cajas WHERE colegio_id = $1 AND id_local')) return { rows: db.cajas.filter(c => c.colegio_id === p[0] && c.id_local === p[1]) };
  if (sql.startsWith('INSERT INTO cajas')) {
    const c = { id: 100 + db.cajas.length, empleado_id: p[0], local: p[1], fondo: p[2], colegio_id: p[3], apertura: p[4], id_local: p[5], abierta: true, ventas: 0, tx_count: 0 };
    db.cajas.push(c); db.orden.push('abrir'); return { rows: [c] };
  }
  if (sql.startsWith('UPDATE cajas SET ventas')) { const c = db.cajas.find(x => x.id === p[1]); c.ventas += p[0]; c.tx_count++; db.orden.push('venta'); return { rows: [] }; }
  if (sql.startsWith('UPDATE cajas SET abierta = false')) { const c = db.cajas.find(x => x.id === p[1] && x.abierta); if (c) { c.abierta = false; c.cierre = p[0]; } db.orden.push('cerrar'); return { rows: [] }; }
  if (sql.startsWith('SELECT id FROM transacciones WHERE colegio_id')) return { rows: db.transacciones.filter(t => t.id_venta === p[1]) };
  if (sql.startsWith('SELECT nombre FROM locales WHERE colegio_id')) return { rows: [{ nombre: p[1] }] };
  if (sql.startsWith('SELECT * FROM alumnos WHERE id')) return { rows: db.alumnos.map(a => ({ ...a })) };
  if (sql.startsWith('SELECT id, nombre, precio, categoria FROM productos')) return { rows: db.productos };
  if (sql.startsWith('UPDATE alumnos SET saldo')) { db.alumnos[0].saldo -= p[0]; return { rows: [] }; }
  if (sql.startsWith('INSERT INTO transacciones')) { const t = { id: db.transacciones.length + 1, id_venta: p[7] }; db.transacciones.push(t); return { rows: [t] }; }
  if (sql.startsWith('SELECT id, saldo, gasto_hoy FROM alumnos')) return { rows: [{ id: 1, saldo: db.alumnos[0].saldo, gasto_hoy: 0 }] };
  return { rows: [] };
};

jest.mock('../src/db/conexion', () => ({
  query: (...a) => ejecutar(...a),
  connect: async () => ({ query: (...a) => ejecutar(...a), release: () => {} }),
}));
jest.mock('../src/controllers/auditoriaController', () => ({ registrar: async () => {} }));
jest.mock('../src/services/notificacionesService', () => ({ notificarCompra: () => {} }));

const { sincronizarVentas } = require('../src/controllers/offlineController');

const respuesta = () => { const res = { status: jest.fn(() => res), json: jest.fn() }; return res; };
const cajero = { id: 10, colegio_id: 3, local_id: null };
const hace = min => new Date(Date.now() - min * 60000).toISOString();

test('caja abierta sin internet: se crea, la venta la encuentra y después se cierra', async () => {
  const res = respuesta();
  await sincronizarVentas({ empleado: cajero, body: {
    cajas: [{ id_local: 'caja-local-0001', local: 'Kiosco', fondo: 500, apertura: hace(60) }],
    ventas: [{ id_venta: 'venta-local-0001', alumno_id: 1, lugar: 'Kiosco', items: [{ id: 7, qty: 1 }], caja_id: 'local:caja-local-0001', fecha: hace(30) }],
    cierres: [{ caja_id: 'local:caja-local-0001', cierre: hace(5) }],
  } }, res);
  const r = res.json.mock.calls[0][0];
  expect(r.cajas[0]).toMatchObject({ estado: 'ok' });
  expect(r.resultados[0].estado).toBe('ok');
  expect(r.cierres[0].estado).toBe('ok');
  const caja = db.cajas.find(c => c.id_local === 'caja-local-0001');
  expect(caja).toMatchObject({ ventas: 800, tx_count: 1, abierta: false, fondo: 500 });
  expect(db.orden).toEqual(['abrir', 'venta', 'cerrar']); // la venta antes del cierre
});

test('la misma caja dos veces se crea una sola vez', async () => {
  const res = respuesta();
  await sincronizarVentas({ empleado: cajero, body: { cajas: [{ id_local: 'caja-local-0001', local: 'Kiosco', fondo: 500, apertura: hace(60) }] } }, res);
  expect(res.json.mock.calls[0][0].cajas[0].estado).toBe('ya_estaba');
  expect(db.cajas.filter(c => c.id_local === 'caja-local-0001')).toHaveLength(1);
});

test('cierre sin internet de una caja que ya existía', async () => {
  const res = respuesta();
  await sincronizarVentas({ empleado: cajero, body: { cierres: [{ caja_id: 5, cierre: hace(2) }] } }, res);
  expect(res.json.mock.calls[0][0].cierres[0].estado).toBe('ok');
  expect(db.cajas.find(c => c.id === 5).abierta).toBe(false);
});

test('venta anulada antes de subirse: queda registrada como anulada y no descuenta nada', async () => {
  const saldoAntes = db.alumnos[0].saldo, stockAntes = db.productos[0].stock, ventasCaja = db.cajas.find(c => c.id === 5).ventas
  const antes = db.transacciones.length
  const res = respuesta();
  await sincronizarVentas({ empleado: cajero, body: { ventas: [{ id_venta: 'venta-anulada-0001', alumno_id: 1, lugar: 'Kiosco', items: [{ id: 7, qty: 2 }], caja_id: 5, fecha: hace(10), anulada: true, anulada_en: hace(9) }] } }, res);
  expect(res.json.mock.calls[0][0].resultados[0]).toMatchObject({ estado: 'ok', anulada: true });
  expect(db.transacciones.length - antes).toBe(2); // la venta [ANULADA] y su anulación (suman cero)
  expect(db.alumnos[0].saldo).toBe(saldoAntes);
  expect(db.productos[0].stock).toBe(stockAntes);
  expect(db.cajas.find(c => c.id === 5).ventas).toBe(ventasCaja);
});
