// Cobro y anulación en el POS: los precios salen de la base, las cantidades
// tienen que ser positivas y una venta se anula una sola vez. Base mockeada.

const db = {};
const reset = () => {
  db.alumnos = [{ id: 5, nombre: 'Ana', colegio_id: 3, activo: true, saldo: 10000, gasto_hoy: 0, limite_diario: 5000, curso: '1A' }];
  db.productos = [
    { id: 1, nombre: 'Alfajor', precio: '800', local: 'Kiosco', colegio_id: 3, activo: true, stock: 10 },
    { id: 2, nombre: 'Cuaderno', precio: '3000', local: 'Librería', colegio_id: 3, activo: true, stock: 5 },
  ];
  db.transacciones = [];
};

const fakeQuery = async (sql, params = []) => {
  if (/^(BEGIN|COMMIT|ROLLBACK)/.test(sql)) return { rows: [] };
  if (sql.startsWith('SELECT * FROM alumnos WHERE id = $1 AND colegio_id')) {
    return { rows: db.alumnos.filter(a => a.id === Number(params[0]) && a.colegio_id === params[1]).map(a => ({ ...a })) };
  }
  if (sql.startsWith('SELECT * FROM alumnos WHERE id')) return { rows: db.alumnos.filter(a => a.id === Number(params[0])) };
  if (sql.includes('FROM productos WHERE id = ANY')) {
    return { rows: db.productos.filter(p => params[0].includes(p.id) && p.colegio_id === params[1] && p.activo) };
  }
  if (sql.startsWith('UPDATE alumnos SET saldo = saldo - $1')) {
    const a = db.alumnos.find(x => x.id === Number(params[1]));
    a.saldo -= params[0]; a.gasto_hoy += params[0];
    return { rows: [] };
  }
  if (sql.startsWith('UPDATE alumnos SET saldo = saldo + $1')) {
    const a = db.alumnos.find(x => x.id === Number(params[1]));
    a.saldo += Number(params[0]); a.gasto_hoy = Math.max(0, a.gasto_hoy - Number(params[0]));
    return { rows: [] };
  }
  if (sql.includes('INSERT INTO transacciones') && sql.includes("'compra'")) {
    const [alumno_id, empleado_id, monto, lugar, descripcion, colegio_id] = params;
    const t = { id: db.transacciones.length + 1, alumno_id, empleado_id, monto, tipo: 'compra', lugar, descripcion, colegio_id, fecha: new Date() };
    db.transacciones.push(t);
    return { rows: [t] };
  }
  if (sql.startsWith('SELECT * FROM transacciones WHERE id')) {
    return { rows: db.transacciones.filter(t => t.id === Number(params[0]) && t.tipo === params[1] && t.colegio_id === params[2]).map(t => ({ ...t })) };
  }
  if (sql.startsWith("UPDATE transacciones SET descripcion = '[ANULADA] '")) {
    const t = db.transacciones.find(x => x.id === Number(params[0]));
    t.descripcion = '[ANULADA] ' + t.descripcion;
    return { rows: [] };
  }
  return { rows: [] };
};

jest.mock('../src/db/conexion', () => ({
  query: (...a) => fakeQuery(...a),
  connect: async () => ({ query: (...a) => fakeQuery(...a), release: () => {} }),
}));
jest.mock('../src/services/emailService', () => ({ enviarEmailCompra: jest.fn(), enviarEmailSaldoBajo: jest.fn() }));
jest.mock('../src/services/pushService', () => ({ enviarPush: jest.fn() }));

const { cobrar, anularVenta } = require('../src/controllers/transaccionesController');

const respuesta = () => { const res = { status: jest.fn(() => res), json: jest.fn() }; return res; };
const kiosquero = { id: 10, rol: 'staff', colegio_id: 3, local_id: null };
const otroEmpleado = { id: 11, rol: 'staff', colegio_id: 3, local_id: null };
const admin = { id: 1, rol: 'admin', colegio_id: 3, local_id: null };

const cobrarA = (empleado, items, extra = {}) => {
  const res = respuesta();
  return cobrar({ empleado, body: { alumno_id: 5, lugar: 'Kiosco', items, ...extra } }, res).then(() => res);
};

beforeEach(reset);

describe('cobrar', () => {
  test('usa el precio de la base aunque el POS mande otro', async () => {
    await cobrarA(kiosquero, [{ id: 1, nombre: 'Alfajor', precio: 1, qty: 2 }]);
    expect(db.alumnos[0].saldo).toBe(10000 - 1600);
    expect(db.transacciones[0]).toMatchObject({ monto: 1600, empleado_id: 10, descripcion: 'Alfajor ×2' });
  });

  test('una cantidad negativa no puede sumar saldo', async () => {
    const res = await cobrarA(kiosquero, [{ id: 1, nombre: 'Alfajor', precio: 800, qty: -5 }]);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(db.alumnos[0].saldo).toBe(10000);
  });

  test('el empleado de la venta es el de la sesión, no el que manda el POS', async () => {
    await cobrarA(kiosquero, [{ id: 1, qty: 1 }], { empleado_id: 99 });
    expect(db.transacciones[0].empleado_id).toBe(10);
  });

  test('no se cobran productos de otra zona', async () => {
    const res = await cobrarA(kiosquero, [{ id: 2, qty: 1 }]);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(db.alumnos[0].saldo).toBe(10000);
  });

  test('descuento fuera de rango', async () => {
    const res = await cobrarA(kiosquero, [{ id: 1, qty: 1 }], { descuento: 150 });
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('anular venta', () => {
  const anular = (empleado, id) => { const res = respuesta(); return anularVenta({ empleado, params: { id: String(id) } }, res).then(() => res); };

  test('devuelve el saldo una sola vez', async () => {
    await cobrarA(kiosquero, [{ id: 1, qty: 1 }]);
    await anular(kiosquero, 1);
    expect(db.alumnos[0].saldo).toBe(10000);
    const segunda = await anular(kiosquero, 1);
    expect(segunda.status).toHaveBeenCalledWith(400);
    expect(db.alumnos[0].saldo).toBe(10000);
  });

  test('otro empleado no puede anular ventas ajenas; el admin sí', async () => {
    await cobrarA(kiosquero, [{ id: 1, qty: 1 }]);
    const ajena = await anular(otroEmpleado, 1);
    expect(ajena.status).toHaveBeenCalledWith(403);
    expect(db.alumnos[0].saldo).toBe(9200);
    const delAdmin = await anular(admin, 1);
    expect(delAdmin.status).not.toHaveBeenCalled();
    expect(db.alumnos[0].saldo).toBe(10000);
  });
});
