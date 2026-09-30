// Formulario de contacto de la página: guarda la consulta y avisa por email.

const mockGuardados = [];
jest.mock('../src/db/conexion', () => ({
  query: async (sql, params) => { if (sql.includes('INSERT INTO contactos')) mockGuardados.push(params); return { rows: [] }; },
}));
const mockEmail = jest.fn(async () => {});
jest.mock('../src/services/emailService', () => ({ enviarEmailContacto: (...a) => mockEmail(...a) }));

const { enviarContacto } = require('../src/controllers/contactoController');

const respuesta = () => { const res = { status: jest.fn(() => res), json: jest.fn() }; return res; };
const enviar = async body => { const res = respuesta(); await enviarContacto({ body, ip: '1.2.3.4' }, res); return res; };

beforeEach(() => { mockGuardados.length = 0; mockEmail.mockClear(); });

test('guarda la consulta y manda el aviso', async () => {
  const res = await enviar({ nombre: ' Ana Paz ', colegio: 'Colegio Modelo', email: 'ana@colegio.edu.ar', alumnos: '300 a 600', mensaje: 'Queremos una demo' });
  expect(res.json).toHaveBeenCalledWith({ ok: true });
  expect(mockGuardados[0].slice(0, 2)).toEqual(['Ana Paz', 'Colegio Modelo']);
  expect(mockEmail).toHaveBeenCalledWith(expect.objectContaining({ colegio: 'Colegio Modelo', mensaje: 'Queremos una demo' }));
});

test('alcanza con un teléfono si no hay email', async () => {
  expect((await enviar({ nombre: 'Ana', colegio: 'X', telefono: '11 5555-5555' })).status).not.toHaveBeenCalled();
});

test.each([
  ['sin nombre', { colegio: 'X', email: 'a@b.com' }],
  ['sin colegio', { nombre: 'Ana', email: 'a@b.com' }],
  ['sin email ni teléfono', { nombre: 'Ana', colegio: 'X' }],
  ['email inválido', { nombre: 'Ana', colegio: 'X', email: 'ana@' }],
])('rechaza %s', async (_, body) => {
  expect((await enviar(body)).status).toHaveBeenCalledWith(400);
  expect(mockGuardados).toHaveLength(0);
});

test('un robot que completa el campo oculto no se guarda, pero no se entera', async () => {
  const res = await enviar({ nombre: 'Bot', colegio: 'Spam', email: 'bot@spam.com', sitio_web: 'http://spam' });
  expect(res.json).toHaveBeenCalledWith({ ok: true });
  expect(mockGuardados).toHaveLength(0);
  expect(mockEmail).not.toHaveBeenCalled();
});
