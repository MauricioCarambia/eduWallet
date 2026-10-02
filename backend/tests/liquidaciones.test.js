// Liquidaciones a concesionarios: totales, validaciones y que no se liquide dos veces.

const mockDb = {};
const mockReset = () => {
  mockDb.zona = { local: 'Kiosco', operador: 'Cantina Don Pepe', canon_pct: '15' };
  mockDb.pendiente = { ventas: '10000', cantidad_ventas: '8', anulaciones: '1000', cantidad_anulaciones: '1', desde: '2026-09-01' };
  mockDb.marcadas = 9;
  mockDb.insert = null;
  mockDb.sql = [];
};
const mockQuery = async (sql, params = []) => {
  mockDb.sql.push(sql.trim().split(/\s+/).slice(0, 2).join(' '));
  if (/^(BEGIN|COMMIT|ROLLBACK)/.test(sql)) return { rows: [] };
  if (sql.includes('FROM zonas_operador')) return { rows: mockDb.zona ? [mockDb.zona] : [] };
  if (sql.includes('COALESCE(SUM(monto) FILTER')) return { rows: [mockDb.pendiente] };
  if (sql.includes('INSERT INTO liquidaciones')) { mockDb.insert = params; return { rows: [{ id: 5, total: params[13] }] }; }
  if (sql.includes('UPDATE transacciones SET liquidacion_id')) return { rows: [], rowCount: mockDb.marcadas };
  return { rows: [] };
};
jest.mock('../src/db/conexion', () => ({
  query: (...a) => mockQuery(...a),
  connect: async () => ({ query: (...a) => mockQuery(...a), release: () => {} }),
}));
jest.mock('../src/controllers/auditoriaController', () => ({ registrar: jest.fn() }));
jest.mock('../src/services/emailService', () => ({ enviarEmailLiquidacion: jest.fn() }));

const { crearLiquidacion, getVistaPrevia } = require('../src/controllers/liquidacionesController');

const llamar = (fn, req) => new Promise(resolve => {
  const res = { code: 200, status(c) { this.code = c; return this; }, json(d) { resolve({ code: this.code, data: d }); } };
  fn({ empleado: { id: 1, colegio_id: 3, rol: 'admin' }, query: {}, body: {}, params: {}, ...req }, res);
});

beforeEach(mockReset);

test('vista previa: lo vendido menos anulaciones, menos el canon, más el ajuste', async () => {
  const { code, data } = await llamar(getVistaPrevia, { query: { local: 'Kiosco', hasta: '2026-09-30', ajuste: '-500' } });
  expect(code).toBe(200);
  expect(data).toMatchObject({ neto: 9000, canon_pct: 15, canon: 1350, ajuste: -500, total: 7150 });
});

test('crea la liquidación con los totales y marca las ventas', async () => {
  const { code } = await llamar(crearLiquidacion, { body: { local: 'Kiosco', hasta: '2026-09-30' } });
  expect(code).toBe(201);
  expect(mockDb.insert[13]).toBe(7650); // 9000 − 15%
  expect(mockDb.sql).toContain('COMMIT');
});

test('si las ventas cambian mientras se liquida, no queda nada a medias', async () => {
  mockDb.marcadas = 10;
  const { code } = await llamar(crearLiquidacion, { body: { local: 'Kiosco', hasta: '2026-09-30' } });
  expect(code).toBe(500);
  expect(mockDb.sql).toContain('ROLLBACK');
  expect(mockDb.sql).not.toContain('COMMIT');
});

test('sin ventas pendientes no se crea', async () => {
  mockDb.pendiente = { ventas: '0', cantidad_ventas: '0', anulaciones: '0', cantidad_anulaciones: '0', desde: null };
  const { code, data } = await llamar(crearLiquidacion, { body: { local: 'Kiosco', hasta: '2026-09-30' } });
  expect(code).toBe(400);
  expect(data.error).toMatch(/No hay ventas/);
});

test('una zona del colegio no se liquida', async () => {
  mockDb.zona = null;
  const { code } = await llamar(crearLiquidacion, { body: { local: 'Comedor', hasta: '2026-09-30' } });
  expect(code).toBe(400);
});

test('un ajuste necesita motivo y la fecha de corte no puede ser futura', async () => {
  expect((await llamar(crearLiquidacion, { body: { local: 'Kiosco', ajuste: 300 } })).code).toBe(400);
  expect((await llamar(crearLiquidacion, { body: { local: 'Kiosco', hasta: '2099-01-01' } })).code).toBe(400);
});
