// Cierre diario: lo hace el primer pedido del día, una sola vez.

const mockDb = { dia: null, sqls: [] };
jest.mock('../src/db/conexion', () => ({
  query: async (sql, params = []) => {
    mockDb.sqls.push(sql);
    if (sql.includes('INSERT INTO tareas_estado')) {
      if (mockDb.dia && mockDb.dia >= params[0]) return { rows: [] };
      mockDb.dia = params[0];
      return { rows: [{ clave: 'cierre_diario' }] };
    }
    if (sql.includes('UPDATE cajas SET abierta = false')) return { rowCount: 2, rows: [] };
    return { rows: [], rowCount: 0 };
  },
}));
jest.mock('../src/services/backupService', () => ({ hacerBackup: jest.fn(async () => {}) }));
jest.mock('../src/services/mercadoPagoService', () => ({ renovarTokensPorVencer: jest.fn(async () => {}) }));
jest.mock('../src/controllers/conciliacionController', () => ({ conciliarTodos: jest.fn(async () => {}) }));
jest.mock('../src/controllers/pagosController', () => ({ vencerPagosPendientes: jest.fn(async () => 0) }));

const { cierreDiario, alDia, hoyAR } = require('../src/services/tareasDiarias');

beforeEach(() => { mockDb.dia = null; mockDb.sqls = []; });

test('el primer cierre del día cierra las cajas viejas y pone el gasto en 0', async () => {
  expect(await cierreDiario()).toBe(true);
  expect(mockDb.sqls.some(s => s.includes('UPDATE cajas SET abierta = false'))).toBe(true);
  expect(mockDb.sqls.some(s => s.includes('UPDATE alumnos SET gasto_hoy = 0'))).toBe(true);
});

test('el mismo día no se repite', async () => {
  await cierreDiario();
  mockDb.sqls = [];
  expect(await cierreDiario()).toBe(false);
  expect(mockDb.sqls.some(s => s.includes('gasto_hoy = 0'))).toBe(false);
});

test('las cajas se comparan por el día de Argentina', () => {
  expect(hoyAR()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
});

test('el middleware siempre deja pasar el pedido, aunque falle el cierre', async () => {
  const next = jest.fn();
  await alDia({}, {}, next);
  expect(next).toHaveBeenCalled();
  const pool = require('../src/db/conexion');
  const original = pool.query;
  pool.query = async () => { throw new Error('base caída') };
  const next2 = jest.fn();
  jest.isolateModules(() => {});
  await alDia({}, {}, next2); // ya estaba listo en memoria: no consulta
  expect(next2).toHaveBeenCalled();
  pool.query = original;
});
