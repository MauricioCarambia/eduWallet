// El padre ve la credencial de sus hijos, y sólo de ellos.
jest.mock('../src/db/conexion', () => ({
  query: async (sql, params = []) => {
    if (sql.includes('JOIN padres_alumnos pa')) {
      return { rows: params[0] === 7 && Number(params[1]) === 42 ? [{ id: 42, nombre: 'Ana García', curso: '1A', qr: 'EWK7QM2XPT4HNA', colegio_id: 3 }] : [] };
    }
    if (sql.includes('FROM configuracion')) return { rows: [{ nombre_colegio: 'Colegio San Martín', logo: null }] };
    return { rows: [] };
  },
}));
jest.mock('../src/services/emailService', () => ({}));

const { getCredencial } = require('../src/controllers/padresController');
const pedir = (padreId, alumnoId) => new Promise(ok => {
  const res = { status: jest.fn(() => res), json: body => ok({ res, body }) };
  getCredencial({ padre: { id: padreId }, params: { alumno_id: String(alumnoId) } }, res);
});

test('credencial de un hijo propio, con el QR como imagen', async () => {
  const { res, body } = await pedir(7, 42);
  expect(res.status).not.toHaveBeenCalled();
  expect(body).toMatchObject({ colegio: 'Colegio San Martín', credencial: { id: 42, nombre: 'Ana García', curso: '1A' } });
  expect(body.credencial.qr_img).toMatch(/^data:image\/png;base64,/);
  expect(body.credencial.qr).toBeUndefined(); // el código en texto no se manda
});

test('no puede ver la credencial de un alumno que no es su hijo', async () => {
  const { res } = await pedir(7, 99);
  expect(res.status).toHaveBeenCalledWith(403);
});
