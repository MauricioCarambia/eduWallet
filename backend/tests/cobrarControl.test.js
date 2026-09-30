// Cobro en el POS con las reglas de la familia y las alergias del alumno.

const mockDb = {};
const mockReset = () => {
  mockDb.alumno = { id: 1, colegio_id: 3, nombre: 'Martina López', curso: '4° B', saldo: '10000', gasto_hoy: '0', limite_diario: '50000', activo: true,
    restricciones: {}, limite_semanal: null, alergenos: [], bloquear_alergenos: false };
  mockDb.productos = [
    { id: 1, nombre: 'Alfajor de maní', precio: '800', local: 'Kiosco', categoria: 'golosina', alergenos: ['mani', 'gluten'] },
    { id: 2, nombre: 'Agua', precio: '1000', local: 'Kiosco', categoria: 'bebida', alergenos: [] },
  ];
  mockDb.hoy = [];
  mockDb.items = [];
  mockDb.cobrado = false;
};
const mockQuery = async (sql, params = []) => {
  if (/^(BEGIN|COMMIT|ROLLBACK)/.test(sql)) return { rows: [] };
  if (sql.includes('FROM alumnos WHERE id = $1')) return { rows: [{ ...mockDb.alumno }] };
  if (sql.includes('FROM productos WHERE id = ANY')) return { rows: mockDb.productos.filter(p => params[0].includes(p.id)) };
  if (sql.includes('FROM transaccion_items ti')) return { rows: mockDb.hoy };
  if (sql.includes('COALESCE(SUM(t.monto), 0) AS total')) return { rows: [{ total: '0' }] };
  if (sql.startsWith('UPDATE alumnos SET saldo = saldo - $1')) { mockDb.cobrado = true; mockDb.alumno.saldo = String(Number(mockDb.alumno.saldo) - params[0]); return { rows: [] }; }
  if (sql.includes('INSERT INTO transacciones')) return { rows: [{ id: 77, monto: params[2] }] };
  if (sql.includes('INSERT INTO transaccion_items')) { mockDb.items.push(params); return { rows: [] }; }
  return { rows: [] };
};
jest.mock('../src/db/conexion', () => ({
  query: (...a) => mockQuery(...a),
  connect: async () => ({ query: (...a) => mockQuery(...a), release: () => {} }),
}));
const mockAvisos = { notificarCompra: jest.fn(), notificarRechazo: jest.fn() };
jest.mock('../src/services/notificacionesService', () => ({
  notificarCompra: (...a) => mockAvisos.notificarCompra(...a),
  notificarRechazo: (...a) => mockAvisos.notificarRechazo(...a),
}));
const mockRegistrar = jest.fn();
jest.mock('../src/controllers/auditoriaController', () => ({ registrar: (...a) => mockRegistrar(...a) }));

const { cobrar } = require('../src/controllers/transaccionesController');

const respuesta = () => { const res = { status: jest.fn(() => res), json: jest.fn() }; return res; };
const vender = async (items, extra = {}) => {
  const res = respuesta();
  await cobrar({ empleado: { id: 5, colegio_id: 3, local_id: null }, body: { alumno_id: 1, lugar: 'Kiosco', items, ...extra } }, res);
  return res;
};

beforeEach(() => { mockReset(); jest.clearAllMocks(); });

test('sin reglas ni alergias vende y guarda el detalle por categoría', async () => {
  const res = await vender([{ id: 2, qty: 2 }]);
  expect(res.status).not.toHaveBeenCalled();
  expect(mockDb.items).toEqual([[77, 2, 'Agua', 'bebida', 2, '1000']]);
  expect(mockAvisos.notificarCompra).toHaveBeenCalledWith(expect.objectContaining({ total: 2000, saldoAnterior: '10000' }));
});

test('una categoría bloqueada por la familia no se vende y se avisa a la familia', async () => {
  mockDb.alumno.restricciones = { categorias_bloqueadas: ['golosina'] };
  const res = await vender([{ id: 1, qty: 1 }]);
  expect(res.status).toHaveBeenCalledWith(403);
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ tipo: 'regla' }));
  expect(mockDb.cobrado).toBe(false);
  expect(mockAvisos.notificarRechazo).toHaveBeenCalled();
});

test('máximo 1 bebida por día: la segunda del día se rechaza', async () => {
  mockDb.alumno.restricciones = { maximos: { bebida: 1 } };
  expect((await vender([{ id: 2, qty: 1 }])).status).not.toHaveBeenCalled();
  mockDb.hoy = [{ categoria: 'bebida', cantidad: 1 }];
  mockDb.cobrado = false;
  expect((await vender([{ id: 2, qty: 1 }])).status).toHaveBeenCalledWith(403);
  expect(mockDb.cobrado).toBe(false);
});

describe('alergias', () => {
  beforeEach(() => { mockDb.alumno.alergenos = ['mani']; });

  test('sin confirmación del cajero no se vende: el POS tiene que preguntar', async () => {
    const res = await vender([{ id: 1, qty: 1 }]);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ requiere_confirmacion: true, alergias: [{ id: 1, nombre: 'Alfajor de maní', alergenos: ['mani'] }] }));
    expect(mockDb.cobrado).toBe(false);
  });

  test('con la confirmación del cajero se vende y queda en la auditoría', async () => {
    const res = await vender([{ id: 1, qty: 1 }], { confirmar_alergias: true });
    expect(res.status).not.toHaveBeenCalled();
    expect(mockDb.cobrado).toBe(true);
    expect(mockRegistrar).toHaveBeenCalledWith(5, 3, 'Venta con alérgeno confirmada', expect.stringContaining('Maní'));
  });

  test('si la familia eligió bloquear, ni con confirmación se vende', async () => {
    mockDb.alumno.bloquear_alergenos = true;
    const res = await vender([{ id: 1, qty: 1 }], { confirmar_alergias: true });
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ tipo: 'alergia_bloqueada' }));
    expect(mockDb.cobrado).toBe(false);
    expect(mockAvisos.notificarRechazo).toHaveBeenCalled();
  });

  test('un producto sin el alérgeno se vende normal', async () => {
    expect((await vender([{ id: 2, qty: 1 }])).status).not.toHaveBeenCalled();
  });
});

test('con saldo negativo (por un contracargo) no se puede comprar', async () => {
  mockDb.alumno.saldo = '-2000';
  const res = await vender([{ id: 2, qty: 1 }]);
  expect(res.status).toHaveBeenCalledWith(400);
  expect(mockDb.cobrado).toBe(false);
});
