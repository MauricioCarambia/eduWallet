// Acreditación de recargas de Mercado Pago (modelo B) con la base mockeada:
// verifica que un pago se acredite una sola vez y por el monto de `pagos`.

const estadoDb = { pagos: [], transacciones: [], saldos: {}, alumnos: [], padresAlumnos: [] };

const fakeQuery = async (sql, params = []) => {
  if (/^(BEGIN|COMMIT|ROLLBACK)/.test(sql)) return { rows: [] };
  if (sql.includes('FROM pagos WHERE external_reference')) {
    return { rows: estadoDb.pagos.filter(p => p.external_reference === params[0]).map(p => ({ ...p })) };
  }
  if (sql.startsWith('UPDATE pagos SET estado = $1')) {
    const p = estadoDb.pagos.find(x => x.id === params[3]);
    Object.assign(p, { estado: params[0], mp_payment_id: params[1], detalle: params[2] });
    return { rows: [] };
  }
  if (sql.includes('INSERT INTO transacciones')) {
    if (estadoDb.transacciones.some(t => t.descripcion === params[2])) return { rows: [] }; // ON CONFLICT DO NOTHING
    estadoDb.transacciones.push({ alumno_id: params[0], monto: params[1], descripcion: params[2] });
    return { rows: [{ id: estadoDb.transacciones.length }] };
  }
  if (sql.includes("SET estado = 'vencido'")) {
    const horas = p => (p.origen === 'link' ? 72 : 24);
    const vencen = estadoDb.pagos.filter(p => p.estado === 'pendiente' && !p.mp_payment_id && p.creado_en < Date.now() - horas(p) * 3600 * 1000);
    vencen.forEach(p => { p.estado = 'vencido'; });
    return { rows: [], rowCount: vencen.length };
  }
  if (sql.includes('FROM alumnos a JOIN colegios c')) {
    return { rows: estadoDb.alumnos.filter(a => a.id === Number(params[0]) && a.colegio_id === params[1]) };
  }
  if (sql.includes('INSERT INTO pagos') && sql.includes("'link'")) {
    const [alumno_id, monto, comision, monto_total, external_reference, colegio_id] = params;
    estadoDb.pagos.push({ id: estadoDb.pagos.length + 1, padre_id: null, alumno_id, monto, comision, monto_total, estado: 'pendiente', external_reference, colegio_id, origen: 'link', creado_en: Date.now() });
    return { rows: [] };
  }
  if (sql.includes('SELECT nombre, saldo FROM alumnos')) return { rows: [{ nombre: 'Alumno', saldo: estadoDb.saldos[params[0]] || 0 }] };
  if (sql.includes('SELECT padre_id FROM padres_alumnos')) {
    return { rows: estadoDb.padresAlumnos.filter(pa => pa.alumno_id === params[0]).map(pa => ({ padre_id: pa.padre_id })) };
  }
  if (sql.startsWith('UPDATE alumnos SET saldo')) {
    estadoDb.saldos[params[1]] = (estadoDb.saldos[params[1]] || 0) + Number(params[0]);
    return { rows: [] };
  }
  return { rows: [] };
};

jest.mock('../src/db/conexion', () => ({
  query: (...a) => fakeQuery(...a),
  connect: async () => ({ query: (...a) => fakeQuery(...a), release: () => {} }),
}));
jest.mock('../src/services/pushService', () => ({ enviarPush: jest.fn() }));
// Mercado Pago: se captura el body de la preferencia en vez de llamar a la API
const preferenciasCreadas = [];
jest.mock('mercadopago', () => ({
  MercadoPagoConfig: jest.fn(),
  Payment: jest.fn(),
  Preference: jest.fn(() => ({
    create: async ({ body }) => { preferenciasCreadas.push(body); return { id: 'pref-1', init_point: 'https://mp.test/checkout?pref_id=pref-1' }; },
  })),
}));
const { enviarPush } = require('../src/services/pushService');

const { acreditarPago, vencerPagosPendientes, getHistorialPagos, crearLinkPago } = require('../src/controllers/pagosController');
const { calcularRecarga } = require('../src/services/mercadoPagoService');

const REF = '7_42_20000_1700000000000';

beforeEach(() => {
  estadoDb.pagos = [{
    id: 1, padre_id: 7, alumno_id: 42, colegio_id: 3, external_reference: REF,
    monto: '20000.00', comision: '1000.00', monto_total: '21000.00', estado: 'pendiente',
    creado_en: Date.now(),
  }];
  estadoDb.transacciones = [];
  estadoDb.saldos = {};
  estadoDb.alumnos = [{ id: 42, nombre: 'Juan', colegio_id: 3, activo: true, comision_pct: '5' }];
  estadoDb.padresAlumnos = [{ padre_id: 7, alumno_id: 42 }, { padre_id: 8, alumno_id: 42 }];
  preferenciasCreadas.length = 0;
  enviarPush.mockClear();
});

const respuesta = () => { const res = { status: jest.fn(() => res), json: jest.fn() }; return res; };

describe('calcularRecarga (modelo B)', () => {
  test('la comisión se suma encima del saldo', () => {
    expect(calcularRecarga(20000, 5)).toEqual({ monto: 20000, comision: 1000, total: 21000 });
  });
  test('redondea a centavos', () => {
    expect(calcularRecarga(1234, 3.5)).toEqual({ monto: 1234, comision: 43.19, total: 1277.19 });
  });
  test('sin comisión configurada', () => {
    expect(calcularRecarga(500, null)).toEqual({ monto: 500, comision: 0, total: 500 });
  });
});

describe('acreditarPago', () => {
  const aprobado = { id: 999, status: 'approved', status_detail: 'accredited', external_reference: REF, transaction_amount: 21000 };

  test('acredita el saldo pedido (sin la comisión)', async () => {
    const r = await acreditarPago(aprobado);
    expect(r).toMatchObject({ estado: 'acreditado', acreditado: true });
    expect(estadoDb.saldos[42]).toBe(20000);
    expect(estadoDb.pagos[0].estado).toBe('acreditado');
  });

  test('webhook + /verificar del mismo pago acreditan una sola vez', async () => {
    await acreditarPago(aprobado);
    const r = await acreditarPago(aprobado);
    expect(r.acreditado).toBe(false);
    expect(estadoDb.saldos[42]).toBe(20000);
    expect(estadoDb.transacciones).toHaveLength(1);
  });

  test('no acredita si se pagó menos que monto + comisión', async () => {
    const r = await acreditarPago({ ...aprobado, transaction_amount: 20000 });
    expect(r.estado).toBe('rechazado');
    expect(estadoDb.saldos[42]).toBeUndefined();
    expect(estadoDb.pagos[0].detalle).toBe('monto_inconsistente');
  });

  test('pago pendiente sólo actualiza el estado', async () => {
    const r = await acreditarPago({ ...aprobado, status: 'in_process' });
    expect(r).toMatchObject({ estado: 'pendiente', acreditado: false });
    expect(estadoDb.saldos[42]).toBeUndefined();
  });
});

describe('recargas vencidas', () => {
  const HACE_2_DIAS = Date.now() - 48 * 3600 * 1000;

  test('vence sólo los intentos viejos que nunca tuvieron pago en MP', async () => {
    estadoDb.pagos[0].creado_en = HACE_2_DIAS;
    estadoDb.pagos.push(
      { id: 2, estado: 'pendiente', mp_payment_id: null, creado_en: Date.now() },           // reciente
      { id: 3, estado: 'pendiente', mp_payment_id: '555', creado_en: HACE_2_DIAS },         // pago en proceso
    );
    expect(await vencerPagosPendientes()).toBe(1);
    expect(estadoDb.pagos.map(p => p.estado)).toEqual(['vencido', 'pendiente', 'pendiente']);
  });

  test('si MP aprueba un pago ya vencido, igual se acredita', async () => {
    estadoDb.pagos[0].estado = 'vencido';
    const r = await acreditarPago({ id: 999, status: 'approved', external_reference: REF, transaction_amount: 21000 });
    expect(r.acreditado).toBe(true);
    expect(estadoDb.saldos[42]).toBe(20000);
  });

  test('el historial rechaza un filtro de estado inválido', async () => {
    const res = { status: jest.fn(() => res), json: jest.fn() };
    await getHistorialPagos({ padre: { id: 7 }, query: { estado: 'cualquiera' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('link de pago del colegio', () => {
  const admin = { id: 1, colegio_id: 3 };

  test('genera la preferencia con el modelo B, sin padre y con vencimiento', async () => {
    const res = respuesta();
    await crearLinkPago({ empleado: admin, body: { alumno_id: 42, monto: 5000 } }, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ url: 'https://mp.test/checkout?pref_id=pref-1', monto: 5000, comision: 250, total: 5250 }));
    const pref = preferenciasCreadas[0];
    expect(pref.items.map(i => i.unit_price)).toEqual([5000, 250]);
    expect(pref.expires).toBe(true);
    expect(pref.payer).toBeUndefined();
    const pago = estadoDb.pagos.find(p => p.origen === 'link');
    expect(pago).toMatchObject({ padre_id: null, monto: 5000, comision: 250, monto_total: 5250, estado: 'pendiente' });
    expect(pago.external_reference).toMatch(/^link_42_5000_/);
  });

  test('no genera links para alumnos de otro colegio ni montos inválidos', async () => {
    const otro = respuesta();
    await crearLinkPago({ empleado: { id: 1, colegio_id: 99 }, body: { alumno_id: 42, monto: 5000 } }, otro);
    expect(otro.status).toHaveBeenCalledWith(404);
    const invalido = respuesta();
    await crearLinkPago({ empleado: admin, body: { alumno_id: 42, monto: -10 } }, invalido);
    expect(invalido.status).toHaveBeenCalledWith(400);
    expect(preferenciasCreadas).toHaveLength(0);
  });

  test('al pagarse, acredita el saldo y avisa a todos los padres vinculados', async () => {
    await crearLinkPago({ empleado: admin, body: { alumno_id: 42, monto: 5000 } }, respuesta());
    const ref = estadoDb.pagos.find(p => p.origen === 'link').external_reference;
    const r = await acreditarPago({ id: 777, status: 'approved', external_reference: ref, transaction_amount: 5250 });
    expect(r.acreditado).toBe(true);
    expect(estadoDb.saldos[42]).toBe(5000);
    expect(enviarPush.mock.calls.map(c => c[0]).sort()).toEqual([7, 8]);
  });

  test('un link sin pagar vence a las 72 h, no a las 24 h', async () => {
    estadoDb.pagos = [
      { id: 1, estado: 'pendiente', origen: 'link', mp_payment_id: null, creado_en: Date.now() - 48 * 3600 * 1000 },
      { id: 2, estado: 'pendiente', origen: 'link', mp_payment_id: null, creado_en: Date.now() - 80 * 3600 * 1000 },
    ];
    expect(await vencerPagosPendientes()).toBe(1);
    expect(estadoDb.pagos.map(p => p.estado)).toEqual(['pendiente', 'vencido']);
  });

  test('una referencia de link sin fila en pagos no se reconstruye', async () => {
    const r = await acreditarPago({ id: 778, status: 'approved', external_reference: 'link_42_5000_123', transaction_amount: 5250 });
    expect(r.acreditado).toBe(false);
    expect(estadoDb.saldos[42]).toBeUndefined();
  });
});
