// La familia cambia el límite diario o semanal desde Control.

const mockDb = { sql: [] };
const mockQuery = async (sql, params = []) => {
  mockDb.sql.push({ sql, params });
  if (sql.includes('FROM padres_alumnos')) return { rows: [{ id: 1 }] };
  if (sql.startsWith('UPDATE alumnos SET')) return { rows: [{ id: 7, limite_diario: '3000', limite_semanal: null }] };
  return { rows: [] };
};
jest.mock('../src/db/conexion', () => ({ query: (...a) => mockQuery(...a) }));
jest.mock('../src/services/consumoAlumno', () => ({ gastoDeLaSemana: async () => 0 }));

const { actualizarLimite } = require('../src/controllers/padresController');

const llamar = body => new Promise(resolve => {
  const res = { code: 200, status(c) { this.code = c; return this; }, json(d) { resolve({ code: this.code, data: d }); } };
  actualizarLimite({ params: { alumno_id: '7' }, padre: { id: 4 }, body }, res);
});

beforeEach(() => { mockDb.sql = []; });

test('guarda el límite con parámetros ($1, $2…), no con números sueltos', async () => {
  const { code } = await llamar({ limite_diario: 3000, limite_semanal: 12000 });
  expect(code).toBe(200);
  const update = mockDb.sql.find(q => q.sql.startsWith('UPDATE alumnos SET'));
  expect(update.sql).toMatch(/limite_diario = \$1, limite_semanal = \$2 WHERE id = \$3/);
  expect(update.params).toEqual([3000, 12000, '7']);
});

test('un límite inválido no llega a la base', async () => {
  expect((await llamar({ limite_diario: -5 })).code).toBe(400);
  expect(mockDb.sql).toHaveLength(0);
});
