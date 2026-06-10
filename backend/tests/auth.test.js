const request = require('supertest');
const bcrypt = require('bcrypt');
const app = require('../src/app');
const pool = require('../src/db/conexion');

describe('Autenticación de empleados', () => {
  const usuario = `test_emp_${Date.now()}`;
  const pin = '1234';
  let empleadoId;

  beforeAll(async () => {
    const hash = await bcrypt.hash(pin, 10);
    const res = await pool.query(
      `INSERT INTO empleados (nombre, usuario, pin, rol, activo) VALUES ($1, $2, $3, 'admin', true) RETURNING id`,
      ['Empleado de prueba', usuario, hash]
    );
    empleadoId = res.rows[0].id;
  });

  afterAll(async () => {
    await pool.query('DELETE FROM auditoria WHERE empleado_id = $1', [empleadoId]);
    await pool.query('DELETE FROM empleados WHERE id = $1', [empleadoId]);
    await pool.end();
  });

  test('rechaza login con usuario inexistente', async () => {
    const res = await request(app)
      .post('/api/empleados/login')
      .send({ usuario: 'no_existe_usuario', pin: '0000' });
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  test('rechaza login con PIN incorrecto', async () => {
    const res = await request(app)
      .post('/api/empleados/login')
      .send({ usuario, pin: '9999' });
    expect(res.status).toBe(401);
  });

  test('login correcto devuelve un token JWT', async () => {
    const res = await request(app)
      .post('/api/empleados/login')
      .send({ usuario, pin });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.empleado.usuario).toBe(usuario);
    expect(res.body.empleado.rol).toBe('admin');
  });

  test('rechaza requests sin token a rutas protegidas', async () => {
    const res = await request(app).get('/api/alumnos');
    expect(res.status).toBe(401);
  });

  test('rechaza requests con token inválido', async () => {
    const res = await request(app)
      .get('/api/alumnos')
      .set('Authorization', 'Bearer token_invalido');
    expect(res.status).toBe(403);
  });

  test('permite acceso a rutas protegidas con token válido', async () => {
    const login = await request(app).post('/api/empleados/login').send({ usuario, pin });
    const token = login.body.token;

    const res = await request(app)
      .get('/api/alumnos')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
