const request = require('supertest');
const bcrypt = require('bcrypt');
const app = require('../src/app');
const pool = require('../src/db/conexion');

describe('Alumnos', () => {
  const usuario = `test_admin_${Date.now()}`;
  let token;
  let empleadoId;
  let alumnoId;

  beforeAll(async () => {
    const hash = await bcrypt.hash('1234', 10);
    const empleado = await pool.query(
      `INSERT INTO empleados (nombre, usuario, pin, rol, activo) VALUES ($1, $2, $3, 'admin', true) RETURNING id`,
      ['Admin de prueba', usuario, hash]
    );
    empleadoId = empleado.rows[0].id;

    const login = await request(app).post('/api/empleados/login').send({ usuario, pin: '1234' });
    token = login.body.token;
  });

  afterAll(async () => {
    if (alumnoId) await pool.query('DELETE FROM alumnos WHERE id = $1', [alumnoId]);
    await pool.query('DELETE FROM auditoria WHERE empleado_id = $1', [empleadoId]);
    await pool.query('DELETE FROM empleados WHERE id = $1', [empleadoId]);
    await pool.end();
  });

  test('crea un alumno', async () => {
    const res = await request(app)
      .post('/api/alumnos')
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: 'Alumno de Prueba', curso: '1ro A', limite_diario: 1000 });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id');
    expect(res.body.nombre).toBe('Alumno de Prueba');
    alumnoId = res.body.id;
  });

  test('lista alumnos e incluye el creado', async () => {
    const res = await request(app)
      .get('/api/alumnos')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.some(a => a.id === alumnoId)).toBe(true);
  });

  test('obtiene un alumno por id', async () => {
    const res = await request(app)
      .get(`/api/alumnos/${alumnoId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(alumnoId);
  });

  test('recarga saldo del alumno', async () => {
    const res = await request(app)
      .post(`/api/alumnos/${alumnoId}/recargar`)
      .set('Authorization', `Bearer ${token}`)
      .send({ monto: 500, empleado_id: empleadoId, descripcion: 'Recarga de prueba' });
    expect(res.status).toBe(200);
    expect(Number(res.body.saldo)).toBe(500);
  });

  test('404 al pedir un alumno inexistente', async () => {
    const res = await request(app)
      .get('/api/alumnos/999999999')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  test('elimina el alumno', async () => {
    // limpiar transacciones generadas por la recarga de prueba (FK)
    await pool.query('DELETE FROM transacciones WHERE alumno_id = $1', [alumnoId]);

    const res = await request(app)
      .delete(`/api/alumnos/${alumnoId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    alumnoId = null;
  });
});
