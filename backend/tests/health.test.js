const request = require('supertest');
const app = require('../src/app');

describe('Salud de la API', () => {
  test('GET / responde con mensaje de la API', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('mensaje');
  });

  test('GET /api/docs.json devuelve la especificación OpenAPI', async () => {
    const res = await request(app).get('/api/docs.json');
    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe('3.0.0');
    expect(res.body.info.title).toBe('EduWallet API');
    expect(Object.keys(res.body.paths).length).toBeGreaterThan(0);
  });

  test('GET /api/configuracion/branding es público', async () => {
    const res = await request(app).get('/api/configuracion/branding');
    expect(res.status).toBe(200);
  });
});
