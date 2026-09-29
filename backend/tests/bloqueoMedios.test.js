// El padre bloquea o desbloquea el QR o la tarjeta de sus hijos (y sólo de ellos).
const consultas = [];
jest.mock('../src/db/conexion', () => ({
  query: async (sql, params = []) => {
    consultas.push({ sql, params });
    if (sql.includes('FROM padres_alumnos')) return { rows: params[0] === 7 && Number(params[1]) === 42 ? [{ id: 1 }] : [] };
    if (sql.startsWith('UPDATE alumnos SET')) return { rows: [{ id: 42, nombre: 'Ana', colegio_id: 3, qr_bloqueado: params[0] }] };
    if (sql.includes('FROM padres WHERE')) return { rows: [{ nombre: 'Mauricio' }] };
    return { rows: [] };
  },
}));
jest.mock('../src/services/emailService', () => ({}));

const { bloquearMedio } = require('../src/controllers/padresController');
const pedir = (padreId, alumnoId, body) => new Promise(ok => {
  const res = { status: jest.fn(() => res), json: b => ok({ res, body: b }) };
  bloquearMedio({ padre: { id: padreId }, params: { alumno_id: String(alumnoId) }, body }, res);
});

beforeEach(() => { consultas.length = 0; });

test('bloquea el QR de un hijo y queda en la auditoría', async () => {
  const { res, body } = await pedir(7, 42, { medio: 'qr', bloqueado: true });
  expect(res.status).not.toHaveBeenCalled();
  expect(body.qr_bloqueado).toBe(true);
  expect(consultas.find(c => c.sql.startsWith('UPDATE alumnos')).sql).toContain('qr_bloqueado');
  expect(consultas.some(c => c.sql.includes('INSERT INTO auditoria'))).toBe(true);
});

test('no puede bloquear medios de un alumno ajeno', async () => {
  const { res } = await pedir(7, 99, { medio: 'tarjeta', bloqueado: true });
  expect(res.status).toHaveBeenCalledWith(403);
  expect(consultas.some(c => c.sql.startsWith('UPDATE alumnos'))).toBe(false);
});

test('medio o valor inválido', async () => {
  expect((await pedir(7, 42, { medio: 'nfc; DROP', bloqueado: true })).res.status).toHaveBeenCalledWith(400);
  expect((await pedir(7, 42, { medio: 'qr', bloqueado: 'si' })).res.status).toHaveBeenCalledWith(400);
});
