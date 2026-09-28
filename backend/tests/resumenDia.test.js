// Resumen del día del POS: totales, ventas por hora, productos más vendidos
// y anuladas, con las consultas mockeadas.

const ventas = [
  { id: 1, fecha: '2026-09-28T13:05:00Z', monto: '1600', descripcion: 'Alfajor ×2', lugar: 'Kiosco', empleado_id: 10, alumno_nombre: 'Ana', empleado_nombre: 'Juan', hora: 10 },
  { id: 2, fecha: '2026-09-28T13:40:00Z', monto: '2300', descripcion: 'Alfajor, Gaseosa', lugar: 'Kiosco', empleado_id: 10, alumno_nombre: 'Luis', empleado_nombre: 'Juan', hora: 10 },
  { id: 3, fecha: '2026-09-28T16:10:00Z', monto: '1500', descripcion: '[ANULADA] Gaseosa', lugar: 'Kiosco', empleado_id: 10, alumno_nombre: 'Ana', empleado_nombre: 'Juan', hora: 13 },
  { id: 4, fecha: '2026-09-28T16:20:00Z', monto: '800', descripcion: 'Alfajor', lugar: 'Kiosco', empleado_id: 11, alumno_nombre: 'Ana', empleado_nombre: 'Marta', hora: 13 },
];
const consultas = [];

jest.mock('../src/db/conexion', () => ({
  query: async (sql, params) => {
    consultas.push({ sql, params });
    if (sql.includes('FROM locales')) return { rows: [{ nombre: 'Kiosco' }] };
    if (sql.includes("t.tipo = 'compra'")) return { rows: ventas };
    if (sql.includes('FROM cajas')) return { rows: [{ id: 1, local: 'Kiosco', ventas: '4700', abierta: false }] };
    if (sql.includes('- 7')) return { rows: [{ total: '2000', cantidad: 2 }] };
    return { rows: [] };
  },
}));
jest.mock('../src/services/emailService', () => ({}));
jest.mock('../src/services/pushService', () => ({}));

const { getResumenDia } = require('../src/controllers/transaccionesController');

const pedir = (empleado, query) => new Promise(ok => {
  const res = { status: jest.fn(() => res), json: body => ok({ res, body }) };
  getResumenDia({ empleado, query }, res);
});

const kiosquero = { id: 10, rol: 'staff', colegio_id: 3, local_id: 1 };

test('totales sin contar las ventas anuladas', async () => {
  const { body } = await pedir(kiosquero, { fecha: '2026-09-28' });
  expect(body.resumen).toEqual({ total: 4700, cantidad: 3, ticket_promedio: 1567, alumnos: 2, anuladas: 1, monto_anulado: 1500 });
  expect(body.semana_pasada).toEqual({ total: 2000, cantidad: 2 });
});

test('ventas por hora, productos y empleados', async () => {
  const { body } = await pedir(kiosquero, { fecha: '2026-09-28' });
  expect(body.por_hora[10]).toEqual({ hora: 10, total: 3900, cantidad: 2 });
  expect(body.por_hora[13]).toEqual({ hora: 13, total: 800, cantidad: 1 });
  expect(body.productos).toEqual([{ nombre: 'Alfajor', cantidad: 4 }, { nombre: 'Gaseosa', cantidad: 1 }]);
  expect(body.por_empleado.map(e => e.nombre)).toEqual(['Juan', 'Marta']);
});

test('el empleado con zona fija ve sólo su zona aunque pida otra', async () => {
  consultas.length = 0;
  const { body } = await pedir(kiosquero, { fecha: '2026-09-28', local: 'Librería' });
  expect(body.local).toBe('Kiosco');
  expect(consultas.find(c => c.sql.includes("t.tipo = 'compra'")).params[2]).toBe('Kiosco');
});

test('fecha inválida', async () => {
  const { res } = await pedir(kiosquero, { fecha: '28/09/2026' });
  expect(res.status).toHaveBeenCalledWith(400);
});
