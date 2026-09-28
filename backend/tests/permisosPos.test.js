// El POS es sólo para el personal de las zonas; el admin del colegio entra
// únicamente al panel admin.

const bcrypt = require('bcrypt');

const empleados = {};
jest.mock('../src/db/conexion', () => ({
  query: async (sql, params = []) => {
    if (sql.includes('FROM colegios WHERE slug')) return { rows: [{ id: 3 }] };
    if (sql.includes('FROM empleados e')) return { rows: empleados[params[1]] ? [empleados[params[1]]] : [] };
    return { rows: [] };
  },
}));

const { login } = require('../src/controllers/empleadosController');
const { soloPersonalPos } = require('../src/middlewares/auth');

const respuesta = () => { const res = { status: jest.fn(() => res), json: jest.fn() }; return res; };
const entrar = async (usuario, app) => {
  const res = respuesta();
  await login({ body: { colegio: 'demo', usuario, pin: '1234', app } }, res);
  return res;
};

beforeAll(async () => {
  const pin = await bcrypt.hash('1234', 4);
  empleados.directora = { id: 1, usuario: 'directora', rol: 'admin', colegio_id: 3, local_id: null, pin, activo: true };
  empleados.kiosquero = { id: 2, usuario: 'kiosquero', rol: 'staff', colegio_id: 3, local_id: 1, pin, activo: true };
});

describe('login por app', () => {
  test('el admin no puede entrar al POS', async () => {
    expect((await entrar('directora', 'pos')).status).toHaveBeenCalledWith(403);
  });
  test('el admin entra al panel admin', async () => {
    const res = await entrar('directora', 'admin');
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ token: expect.any(String) }));
  });
  test('el personal entra al POS pero no al panel admin', async () => {
    expect((await entrar('kiosquero', 'pos')).status).not.toHaveBeenCalled();
    expect((await entrar('kiosquero', 'admin')).status).toHaveBeenCalledWith(403);
  });
});

describe('soloPersonalPos', () => {
  test('bloquea al admin y deja pasar al personal', () => {
    const next = jest.fn();
    const res = respuesta();
    soloPersonalPos({ empleado: { rol: 'admin' } }, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
    soloPersonalPos({ empleado: { rol: 'staff' } }, respuesta(), next);
    expect(next).toHaveBeenCalled();
  });
});
