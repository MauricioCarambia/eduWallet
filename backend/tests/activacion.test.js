// Cuentas de empleados: el admin las crea sin PIN y el empleado elige el
// suyo con un código de un solo uso. El admin nunca conoce el PIN.

const bcrypt = require('bcrypt');

const db = { empleados: [] };
jest.mock('../src/db/conexion', () => ({
  query: async (sql, params = []) => {
    if (sql.startsWith('INSERT INTO empleados')) {
      const [nombre, usuario, rol, colegio_id, local_id] = params;
      const e = { id: db.empleados.length + 1, nombre, usuario, rol, colegio_id, local_id, activo: true, pin: null };
      db.empleados.push(e);
      return { rows: [{ id: e.id, nombre, usuario, rol, local_id, activo: true }] };
    }
    if (sql.startsWith('UPDATE empleados SET pin = NULL, codigo_activacion')) {
      Object.assign(db.empleados.find(e => e.id === Number(params[2])), { pin: null, codigo_activacion: params[0], codigo_activacion_expira: params[1] });
      return { rows: [] };
    }
    if (sql.includes('FROM empleados e JOIN colegios c')) {
      return { rows: db.empleados.filter(e => params[0] === 'demo' && e.usuario.toLowerCase() === params[1].toLowerCase()) };
    }
    if (sql.startsWith('UPDATE empleados SET pin = $1, codigo_activacion = NULL')) {
      Object.assign(db.empleados.find(e => e.id === params[1]), { pin: params[0], codigo_activacion: null, codigo_activacion_expira: null });
      return { rows: [] };
    }
    if (sql.includes('FROM colegios WHERE slug')) return { rows: [{ id: 3 }] };
    if (sql.includes('FROM empleados e') && sql.includes('LEFT JOIN locales')) {
      return { rows: db.empleados.filter(e => e.usuario === params[1]) };
    }
    if (sql.startsWith('SELECT id, nombre FROM empleados')) return { rows: db.empleados.filter(e => e.id === Number(params[0])) };
    return { rows: [] };
  },
}));

const { crearEmpleado, activarCuenta, login, resetearPin } = require('../src/controllers/empleadosController');

const respuesta = () => { const res = { status: jest.fn(() => res), json: jest.fn() }; return res; };
const admin = { id: 1, rol: 'admin', colegio_id: 3 };
const llamar = async (fn, req) => { const res = respuesta(); await fn(req, res); return res; };
const cuerpo = res => res.json.mock.calls[0][0];

beforeEach(() => { db.empleados = []; });

test('el admin crea al empleado sin PIN y recibe un código', async () => {
  const res = await llamar(crearEmpleado, { empleado: admin, body: { nombre: 'Juan', usuario: 'Juan', rol: 'staff' } });
  expect(cuerpo(res)).toMatchObject({ usuario: 'Juan', pendiente_activacion: true, codigo_activacion: expect.stringMatching(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/) });
  expect(db.empleados[0].pin).toBeNull();
  expect(db.empleados[0].codigo_activacion).not.toContain('-'); // se guarda el hash, no el código
});

test('sin activar no puede iniciar sesión', async () => {
  await llamar(crearEmpleado, { empleado: admin, body: { nombre: 'Juan', usuario: 'juan', rol: 'staff' } });
  const res = await llamar(login, { body: { colegio: 'demo', usuario: 'juan', pin: '1234', app: 'pos' } });
  expect(res.status).toHaveBeenCalledWith(403);
});

test('el empleado activa con el código, elige su PIN y entra', async () => {
  const alta = await llamar(crearEmpleado, { empleado: admin, body: { nombre: 'Juan', usuario: 'juan', rol: 'staff' } });
  const { codigo_activacion } = cuerpo(alta);
  const act = await llamar(activarCuenta, { body: { colegio: 'demo', usuario: 'JUAN', codigo: codigo_activacion.toLowerCase().replace('-', ' '), pin: '4821' } });
  expect(act.status).not.toHaveBeenCalled();
  expect(await bcrypt.compare('4821', db.empleados[0].pin)).toBe(true);
  const entrar = await llamar(login, { body: { colegio: 'demo', usuario: 'juan', pin: '4821', app: 'pos' } });
  expect(entrar.status).not.toHaveBeenCalled();
  // el código es de un solo uso
  const otraVez = await llamar(activarCuenta, { body: { colegio: 'demo', usuario: 'juan', codigo: codigo_activacion, pin: '1111' } });
  expect(otraVez.status).toHaveBeenCalledWith(400);
});

test('código incorrecto, vencido o PIN inválido', async () => {
  const alta = await llamar(crearEmpleado, { empleado: admin, body: { nombre: 'Juan', usuario: 'juan', rol: 'staff' } });
  const { codigo_activacion } = cuerpo(alta);
  expect((await llamar(activarCuenta, { body: { colegio: 'demo', usuario: 'juan', codigo: 'AAAA-BBBB', pin: '4821' } })).status).toHaveBeenCalledWith(400);
  expect((await llamar(activarCuenta, { body: { colegio: 'demo', usuario: 'juan', codigo: codigo_activacion, pin: '12' } })).status).toHaveBeenCalledWith(400);
  db.empleados[0].codigo_activacion_expira = new Date(Date.now() - 1000);
  expect((await llamar(activarCuenta, { body: { colegio: 'demo', usuario: 'juan', codigo: codigo_activacion, pin: '4821' } })).status).toHaveBeenCalledWith(400);
});

test('el reset genera un código nuevo y el PIN anterior deja de funcionar', async () => {
  const alta = await llamar(crearEmpleado, { empleado: admin, body: { nombre: 'Juan', usuario: 'juan', rol: 'staff' } });
  await llamar(activarCuenta, { body: { colegio: 'demo', usuario: 'juan', codigo: cuerpo(alta).codigo_activacion, pin: '4821' } });
  const reset = await llamar(resetearPin, { empleado: admin, params: { id: '1' } });
  expect(cuerpo(reset).codigo_activacion).toBeTruthy();
  const entrar = await llamar(login, { body: { colegio: 'demo', usuario: 'juan', pin: '4821', app: 'pos' } });
  expect(entrar.status).toHaveBeenCalledWith(403);
});
