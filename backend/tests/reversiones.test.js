// Devoluciones, contracargos y disputas de Mercado Pago sobre recargas ya
// acreditadas, y la conciliación que las detecta.

const mockDb = {};
const mockReset = () => {
  mockDb.pago = { id: 10, colegio_id: 3, alumno_id: 1, padre_id: 4, monto: '10000', monto_total: '10500', estado: 'pendiente', monto_revertido: '0', external_reference: '4_1_10000_1', detalle: null };
  mockDb.saldo = 2000;
  mockDb.movs = [];
  mockDb.conciliaciones = [];
};
const mockQuery = async (sql, params = []) => {
  if (/^(BEGIN|COMMIT|ROLLBACK)/.test(sql)) return { rows: [] };
  if (sql.startsWith('SELECT * FROM pagos WHERE external_reference')) return { rows: [{ ...mockDb.pago }] };
  if (sql.startsWith('UPDATE pagos SET estado = $1, mp_payment_id')) { Object.assign(mockDb.pago, { estado: params[0], mp_payment_id: params[1], detalle: params[2] }); return { rows: [] }; }
  if (sql.startsWith('UPDATE pagos SET estado = $1, monto_revertido')) { Object.assign(mockDb.pago, { estado: params[0], monto_revertido: String(params[1]) }); return { rows: [] }; }
  if (sql.includes("WHERE tipo = 'recarga' AND descripcion = $1")) return { rows: mockDb.movs.some(m => m[0] === 'recarga' && m[2] === params[0]) ? [{}] : [] };
  if (sql.includes("WHERE tipo = 'reversion' AND descripcion LIKE $1")) return { rows: mockDb.movs.some(m => m[0] === 'reversion' && m[2].endsWith(params[0].slice(1))) ? [{}] : [] };
  if (sql.includes("VALUES ($1, $2, 'recarga'")) {
    if (mockDb.movs.some(m => m[0] === 'recarga' && m[2] === params[2])) return { rows: [] }; // índice único de MP:id
    mockDb.movs.push(['recarga', Number(params[1]), params[2]]); return { rows: [{ id: 1 }] };
  }
  if (sql.startsWith('UPDATE alumnos SET saldo = saldo + $1')) { mockDb.saldo += Number(params[0]); return { rows: [] }; }
  if (sql.startsWith('UPDATE alumnos SET saldo = saldo - $1')) { mockDb.saldo -= Number(params[0]); return { rows: [{ saldo: String(mockDb.saldo) }] }; }
  if (sql.includes("'reversion'")) { mockDb.movs.push(['reversion', Number(params[1]), params[2]]); return { rows: [] }; }
  if (sql.includes('FROM pagos p JOIN alumnos a')) return { rows: [{ ...mockDb.pago, alumno_nombre: 'Martina' }] };
  if (sql.includes('INSERT INTO conciliaciones')) { const row = { revisados: params[4], corregidas: params[5], diferencias: JSON.parse(params[6]) }; mockDb.conciliaciones.push(row); return { rows: [row] }; }
  return { rows: [] };
};
jest.mock('../src/db/conexion', () => ({
  query: (...a) => mockQuery(...a),
  connect: async () => ({ query: (...a) => mockQuery(...a), release: () => {} }),
}));
const mockReversion = jest.fn();
jest.mock('../src/services/notificacionesService', () => ({ notificarReversion: (...a) => mockReversion(...a) }));
jest.mock('../src/services/pushService', () => ({ enviarPush: jest.fn() }));
jest.mock('../src/controllers/auditoriaController', () => ({ registrar: jest.fn(async () => {}) }));
jest.mock('../src/services/mercadoPagoService', () => ({ calcularRecarga: jest.fn(), clienteColegio: jest.fn(), buscarPago: jest.fn() }));

const { acreditarPago } = require('../src/controllers/pagosController');
const { conciliarColegio } = require('../src/services/conciliacionService');

const mp = (status, extra = {}) => ({ id: 555, external_reference: '4_1_10000_1', status, transaction_amount: 10500, ...extra });

beforeEach(() => { mockReset(); jest.clearAllMocks(); });

const acreditada = async () => { await acreditarPago(mp('approved')); expect(mockDb.saldo).toBe(12000); };

test('un pago aprobado se acredita una sola vez aunque MP avise dos veces', async () => {
  await acreditada();
  await acreditarPago(mp('approved'));
  expect(mockDb.saldo).toBe(12000);
  expect(mockDb.movs.filter(m => m[0] === 'recarga')).toHaveLength(1);
});

test('devolución total: se descuenta la recarga y se avisa a la familia', async () => {
  await acreditada();
  const r = await acreditarPago(mp('refunded', { transaction_amount_refunded: 10500 }));
  expect(r).toMatchObject({ estado: 'devuelto', revertido: 10000 });
  expect(mockDb.saldo).toBe(2000);
  expect(mockDb.movs.at(-1)).toEqual(['reversion', 10000, 'Devolución de recarga MP:555']);
  expect(mockReversion).toHaveBeenCalledWith(expect.objectContaining({ monto: 10000, motivo: 'Devolución' }));
});

test('contracargo de una recarga ya gastada: el saldo queda negativo', async () => {
  await acreditada();
  mockDb.saldo = 3000; // gastó 9000 de los 12000
  const r = await acreditarPago(mp('charged_back'));
  expect(r).toMatchObject({ estado: 'contracargo', revertido: 10000 });
  expect(mockDb.saldo).toBe(-7000);
  expect(mockReversion).toHaveBeenCalledWith(expect.objectContaining({ motivo: 'Contracargo', saldoNuevo: '-7000' }));
});

test('devolución parcial y después total: se descuenta sólo la diferencia', async () => {
  await acreditada();
  await acreditarPago(mp('approved', { transaction_amount_refunded: 4000 }));
  expect(mockDb.pago.estado).toBe('devuelto_parcial');
  expect(mockDb.saldo).toBe(8000);
  await acreditarPago(mp('approved', { transaction_amount_refunded: 4000 })); // aviso repetido
  expect(mockDb.saldo).toBe(8000);
  await acreditarPago(mp('refunded', { transaction_amount_refunded: 10500 }));
  expect(mockDb.saldo).toBe(2000); // en total se descontaron los 10000 acreditados, no más
});

test('disputa: no se toca el saldo; si se resuelve a favor, vuelve a acreditado', async () => {
  await acreditada();
  await acreditarPago(mp('in_mediation'));
  expect(mockDb.pago.estado).toBe('en_disputa');
  expect(mockDb.saldo).toBe(12000);
  await acreditarPago(mp('approved'));
  expect(mockDb.pago.estado).toBe('acreditado');
  expect(mockReversion).not.toHaveBeenCalled();
});

describe('conciliación', () => {
  test('un pago aprobado en MP que no sumó saldo se acredita y queda registrado', async () => {
    const r = await conciliarColegio(3, { mp: { obtenerPago: async () => mp('approved'), buscarPorReferencia: async () => mp('approved') } });
    expect(mockDb.saldo).toBe(12000);
    expect(r.corregidas).toBe(1);
    expect(r.diferencias[0]).toMatchObject({ tipo: 'aprobado_sin_saldo', estado: 'corregida' });
  });

  test('un contracargo que no llegó por aviso se detecta y se descuenta', async () => {
    await acreditada();
    const r = await conciliarColegio(3, { mp: { obtenerPago: async () => mp('charged_back'), buscarPorReferencia: async () => null } });
    expect(mockDb.saldo).toBe(2000);
    expect(r.diferencias[0]).toMatchObject({ tipo: 'contracargo', estado: 'corregida' });
  });

  test('si MP no responde, el pago queda para revisar', async () => {
    await acreditada();
    const r = await conciliarColegio(3, { mp: { obtenerPago: async () => { throw new Error('timeout') }, buscarPorReferencia: async () => null } });
    expect(r.diferencias[0]).toMatchObject({ tipo: 'no_verificado', estado: 'revisar' });
    expect(mockDb.saldo).toBe(12000);
  });
});

describe('otro pago con la misma referencia', () => {
  test('el cupón de Rapipago que vence no le saca la recarga pagada con tarjeta', async () => {
    await acreditada(); // pagó con tarjeta (555)
    const r = await acreditarPago(mp('cancelled', { id: 777 })); // el cupón que había generado antes
    expect(r.revertido).toBeUndefined();
    expect(mockDb.saldo).toBe(12000);
    expect(mockDb.pago.estado).toBe('acreditado');
    expect(mockDb.movs.filter(m => m[0] === 'reversion')).toHaveLength(0);
  });

  test('si la familia pagó dos veces, el segundo pago también se acredita (una sola vez)', async () => {
    await acreditada();
    const r = await acreditarPago(mp('approved', { id: 777 }));
    expect(r.acreditado).toBe(true);
    expect(mockDb.saldo).toBe(22000);
    await acreditarPago(mp('approved', { id: 777 })); // aviso repetido
    expect(mockDb.saldo).toBe(22000);
  });

  test('si después devuelven el pago repetido, se descuenta solo ese', async () => {
    await acreditada();
    await acreditarPago(mp('approved', { id: 777 }));
    const r = await acreditarPago(mp('refunded', { id: 777, transaction_amount_refunded: 10500 }));
    expect(r.revertido).toBe(10000);
    expect(mockDb.saldo).toBe(12000);
    await acreditarPago(mp('refunded', { id: 777, transaction_amount_refunded: 10500 })); // repetido
    expect(mockDb.saldo).toBe(12000);
    expect(mockDb.pago.estado).toBe('acreditado'); // el pago con tarjeta sigue intacto
  });
});
