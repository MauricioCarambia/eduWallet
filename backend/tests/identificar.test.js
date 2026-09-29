// Identificar al alumno con cualquier medio: QR de la credencial (lector USB
// o cámara), tarjeta NFC 13,56 MHz o llavero 125 kHz, con cualquier lector.

const { variantesUid } = require('../src/services/tarjetasService');
const { nuevoCodigoQr, esCodigoQr } = require('../src/services/credencialesService');

const db = { alumnos: [] };
jest.mock('../src/db/conexion', () => ({
  query: async (sql, params = []) => {
    if (sql.includes("regexp_replace(upper(qr)")) {
      return { rows: db.alumnos.filter(a => a.colegio_id === params[0] && a.qr.toUpperCase().replace(/[^A-Z0-9]/g, '') === params[1]) };
    }
    if (sql.includes('nfc_claves && $2')) {
      return { rows: db.alumnos.filter(a => a.colegio_id === params[0] && (a.nfc_claves || []).some(c => params[1].includes(c))) };
    }
    return { rows: [] };
  },
}));
jest.mock('../src/controllers/auditoriaController', () => ({ registrar: jest.fn() }));

const { identificarAlumno, asignarTarjeta } = require('../src/controllers/alumnosController');

const respuesta = () => { const res = { status: jest.fn(() => res), json: jest.fn() }; return res; };
const identificar = async codigo => { const res = respuesta(); await identificarAlumno({ empleado: { colegio_id: 3 }, query: { codigo } }, res); return res; };
const qrAna = nuevoCodigoQr();

beforeAll(() => {
  db.alumnos = [
    { id: 1, nombre: 'Ana', colegio_id: 3, qr: qrAna, nfc_claves: variantesUid('04:a2:3f:1b') },   // credencial NFC 13,56
    { id: 2, nombre: 'Luis', colegio_id: 3, qr: nuevoCodigoQr(), nfc_claves: variantesUid('0004567890') }, // llavero 125 kHz
    { id: 3, nombre: 'Sol', colegio_id: 3, qr: 'QR-1790467851679', nfc_claves: null },         // QR formato viejo
  ];
});

test('los QR nuevos son aleatorios, sólo letras y números, y no parecen tarjetas', () => {
  const codigos = new Set(Array.from({ length: 500 }, nuevoCodigoQr));
  expect(codigos.size).toBe(500);
  for (const c of codigos) {
    expect(c).toMatch(/^EW[A-Z2-9]{12}$/);
    expect(esCodigoQr(c)).toBe(true);
    expect(variantesUid(c)).toEqual([]);
  }
});

test.each([
  ['QR leído tal cual', () => qrAna, 1, 'qr'],
  ['QR con minúsculas (Bloq Mayús)', () => qrAna.toLowerCase(), 1, 'qr'],
  ['tarjeta 13,56 con el celular', () => '04:a2:3f:1b', 1, 'tarjeta'],
  ['tarjeta 13,56 con lector USB en decimal', () => String(0x1B3FA204), 1, 'tarjeta'],
  ['llavero 125 kHz', () => '0004567890', 2, 'tarjeta'],
  ['QR viejo con el "-" cambiado por el teclado', () => "QR'1790467851679", 3, 'qr'],
])('%s', async (_, codigo, id, medio) => {
  const res = await identificar(codigo());
  expect(res.status).not.toHaveBeenCalled();
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id, medio }));
});

test('código desconocido o ilegible', async () => {
  expect((await identificar('EWZZZZZZZZZZZZ')).status).toHaveBeenCalledWith(404);
  expect((await identificar('04:00:00:01')).status).toHaveBeenCalledWith(404);
  expect((await identificar('12')).status).toHaveBeenCalledWith(400);
});

test('no se puede asignar un QR de credencial como si fuera una tarjeta', async () => {
  const res = respuesta();
  await asignarTarjeta({ empleado: { id: 1, colegio_id: 3 }, params: { id: '2' }, body: { uid: qrAna } }, res);
  expect(res.status).toHaveBeenCalledWith(400);
});

describe('medios bloqueados por la familia', () => {
  afterEach(() => { db.alumnos[0].qr_bloqueado = false; db.alumnos[0].tarjeta_bloqueada = false; });

  test('con el QR bloqueado, el QR no identifica pero la tarjeta sí', async () => {
    db.alumnos[0].qr_bloqueado = true;
    const qr = await identificar(qrAna);
    expect(qr.status).toHaveBeenCalledWith(403);
    expect(qr.json).toHaveBeenCalledWith(expect.objectContaining({ bloqueado: 'qr' }));
    expect((await identificar('04:a2:3f:1b')).status).not.toHaveBeenCalled();
  });

  test('con la tarjeta bloqueada, la tarjeta no identifica pero el QR sí', async () => {
    db.alumnos[0].tarjeta_bloqueada = true;
    expect((await identificar('04:a2:3f:1b')).status).toHaveBeenCalledWith(403);
    expect((await identificar(qrAna)).status).not.toHaveBeenCalled();
  });
});
