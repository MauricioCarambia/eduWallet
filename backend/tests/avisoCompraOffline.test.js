// Aviso de una compra hecha sin conexión: le llega a la familia cuando la venta
// se sube, así que dice a qué hora fue y, si el saldo quedó negativo, que se
// descuenta de la próxima recarga.

const padre = { id: 5, nombre: 'Laura', email: 'laura@ejemplo.com', notif_compras: 'todas', notif_saldo_bajo: false, notif_email: true, notif_push: true };
jest.mock('../src/db/conexion', () => ({ query: async () => ({ rows: [padre] }) }));
const mockPush = jest.fn(async () => {});
const mockEmail = jest.fn(async () => {});
jest.mock('../src/services/pushService', () => ({ enviarPush: (...a) => mockPush(...a) }));
jest.mock('../src/services/emailService', () => ({
  enviarEmailCompra: (...a) => mockEmail(...a), enviarEmailSaldoBajo: async () => {}, enviarEmailAviso: async () => {},
}));

const { notificarCompra, notificarSaldoNegativo } = require('../src/services/notificacionesService');

const compra = { colegioId: 1, alumno: { id: 1, nombre: 'Martina López' }, lugar: 'Kiosco', total: 1400, descripcion: 'Barra de cereal', saldoAnterior: 4100 };

beforeEach(() => { mockPush.mockClear(); mockEmail.mockClear(); });

test('compra con internet: aviso de siempre', async () => {
  await notificarCompra({ ...compra, saldoNuevo: 2700 });
  expect(mockPush.mock.calls[0][1].body).toBe('Barra de cereal — $1.400 en Kiosco. Saldo: $2.700');
  expect(mockEmail.mock.calls[0][0].sinConexion).toBeNull();
});

test('compra sin conexión: dice la hora de Argentina en que se hizo', async () => {
  // hoy (en Argentina) a las 11:26, aunque el test corra de noche
  const hoyAR = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });
  const hoyA_las_11_26 = new Date(`${hoyAR}T11:26:00-03:00`);
  await notificarCompra({ ...compra, saldoNuevo: 2700, sinConexion: hoyA_las_11_26 });
  expect(mockPush.mock.calls[0][1].body).toContain('Compra hecha sin conexión a las 11:26.');
  expect(mockEmail.mock.calls[0][0].sinConexion).toBe('11:26');
});

test('si el saldo quedó negativo, avisa que se descuenta de la próxima recarga', async () => {
  await notificarCompra({ ...compra, saldoAnterior: 1000, saldoNuevo: -400, sinConexion: new Date() });
  expect(mockPush.mock.calls[0][1].body).toContain('se descuenta de la próxima recarga');
});

test('recordatorio de saldo negativo: cuánto debe y que se descuenta de la próxima recarga', async () => {
  const avisados = await notificarSaldoNegativo({ colegioId: 1, alumno: { id: 1, nombre: 'Martina López', saldo: '-400.00' } });
  expect(avisados).toBe(1);
  expect(mockPush.mock.calls[0][1]).toMatchObject({ title: 'Saldo en negativo — Martina López', body: 'Debe $400. Se descuenta de la próxima recarga.' });
});
