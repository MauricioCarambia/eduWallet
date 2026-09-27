// Acreditación de recargas de Mercado Pago (modelo B) con la base mockeada:
// verifica que un pago se acredite una sola vez y por el monto de `pagos`.

const estadoDb = { pagos: [], transacciones: [], saldos: {} };

const fakeQuery = async (sql, params = []) => {
  if (/^(BEGIN|COMMIT|ROLLBACK)/.test(sql)) return { rows: [] };
  if (sql.includes('FROM pagos WHERE external_reference')) {
    return { rows: estadoDb.pagos.filter(p => p.external_reference === params[0]).map(p => ({ ...p })) };
  }
  if (sql.startsWith('UPDATE pagos SET estado')) {
    const p = estadoDb.pagos.find(x => x.id === params[3]);
    Object.assign(p, { estado: params[0], mp_payment_id: params[1], detalle: params[2] });
    return { rows: [] };
  }
  if (sql.includes('INSERT INTO transacciones')) {
    if (estadoDb.transacciones.some(t => t.descripcion === params[2])) return { rows: [] }; // ON CONFLICT DO NOTHING
    estadoDb.transacciones.push({ alumno_id: params[0], monto: params[1], descripcion: params[2] });
    return { rows: [{ id: estadoDb.transacciones.length }] };
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

const { acreditarPago } = require('../src/controllers/pagosController');
const { calcularRecarga } = require('../src/services/mercadoPagoService');

const REF = '7_42_20000_1700000000000';

beforeEach(() => {
  estadoDb.pagos = [{
    id: 1, padre_id: 7, alumno_id: 42, colegio_id: 3, external_reference: REF,
    monto: '20000.00', comision: '1000.00', monto_total: '21000.00', estado: 'pendiente',
  }];
  estadoDb.transacciones = [];
  estadoDb.saldos = {};
});

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
