// Conciliación Mercado Pago ↔ saldo EduPass.
//
// Revisa los pagos de los últimos días contra lo que dice Mercado Pago y
// corrige lo que se puede corregir sin intervención (MP es la fuente de verdad):
//   - pago aprobado en MP que no sumó saldo (ej.: se perdió el aviso) → se acredita
//   - recarga devuelta o con contracargo en MP → se descuenta del saldo
// y deja para revisar lo que necesita una persona:
//   - pagos que no se pudieron consultar, montos que no coinciden
//   - recargas con saldo pero sin pago registrado
//   - alumnos cuyo saldo no coincide con la suma de sus movimientos
const pool = require('../db/conexion');
const { Payment } = require('mercadopago');
const { buscarPago, clienteColegio } = require('./mercadoPagoService');

const MAX_PAGOS = 500;
const MAX_DESCUADRES = 50;

// Acceso a Mercado Pago (se reemplaza en los tests)
const mpPorDefecto = {
  obtenerPago: (paymentId, colegioId) => buscarPago(paymentId, [colegioId]),
  buscarPorReferencia: async (ref, colegioId) => {
    const { client } = await clienteColegio(colegioId);
    const r = await new Payment(client).search({ options: { external_reference: ref } });
    const pagos = r.results || [];
    return pagos.find(p => p.status === 'approved') || pagos[0] || null;
  },
};

const pesos = n => `$${Number(n).toLocaleString('es-AR')}`;

const conciliarColegio = async (colegioId, { dias = 30, origen = 'manual', empleadoId = null, mp = mpPorDefecto } = {}) => {
  const { acreditarPago } = require('../controllers/pagosController');
  const diferencias = [];
  let revisados = 0;

  const pagos = await pool.query(
    `SELECT p.*, a.nombre AS alumno_nombre FROM pagos p JOIN alumnos a ON a.id = p.alumno_id
     WHERE p.colegio_id = $1 AND p.creado_en >= NOW() - make_interval(days => $2)
       AND (p.mp_payment_id IS NOT NULL OR p.estado IN ('pendiente', 'vencido', 'rechazado'))
     ORDER BY p.id DESC LIMIT ${MAX_PAGOS}`,
    [colegioId, dias]
  );

  for (const pago of pagos.rows) {
    const base = { pago_id: pago.id, alumno: pago.alumno_nombre, monto: Number(pago.monto) };
    let datos;
    try {
      datos = pago.mp_payment_id
        ? await mp.obtenerPago(pago.mp_payment_id, colegioId)
        : await mp.buscarPorReferencia(pago.external_reference, colegioId);
    } catch (err) {
      if (pago.mp_payment_id) {
        diferencias.push({ ...base, tipo: 'no_verificado', estado: 'revisar', detalle: `No se pudo consultar el pago ${pago.mp_payment_id} en Mercado Pago` });
      }
      continue;
    }
    revisados++;
    if (!datos) continue; // intento sin pago en MP: nada que conciliar

    const antes = pago.estado;
    const r = await acreditarPago(datos);

    if (r.acreditado) {
      diferencias.push({ ...base, tipo: 'aprobado_sin_saldo', estado: 'corregida', detalle: `Pago aprobado en Mercado Pago que no había sumado saldo: se acreditaron ${pesos(pago.monto)}` });
    } else if (r.revertido > 0) {
      const tipo = r.estado === 'contracargo' ? 'contracargo' : 'devolucion';
      diferencias.push({ ...base, tipo, estado: 'corregida', detalle: `${tipo === 'contracargo' ? 'Contracargo' : 'Devolución'} en Mercado Pago: se descontaron ${pesos(r.revertido)} del saldo` });
    } else if (r.estado === 'en_disputa' && antes !== 'en_disputa') {
      diferencias.push({ ...base, tipo: 'disputa', estado: 'info', detalle: 'La familia abrió una disputa en Mercado Pago. Si se resuelve en contra, se descuenta del saldo.' });
    } else if (datos.status === 'approved' && r.estado === 'rechazado') {
      diferencias.push({ ...base, tipo: 'monto_inconsistente', estado: 'revisar', detalle: `Mercado Pago cobró ${pesos(datos.transaction_amount)} y no coincide con lo esperado: no se acreditó` });
    }
  }

  // Recargas con saldo acreditado cuyo pago no está registrado
  const huerfanas = await pool.query(
    `SELECT t.id, t.monto, a.nombre AS alumno, substring(t.descripcion from 4) AS mp_id
     FROM transacciones t LEFT JOIN alumnos a ON a.id = t.alumno_id
     WHERE t.colegio_id = $1 AND t.tipo = 'recarga' AND t.descripcion LIKE 'MP:%'
       AND t.fecha >= NOW() - make_interval(days => $2)
       AND NOT EXISTS (SELECT 1 FROM pagos p WHERE p.mp_payment_id = substring(t.descripcion from 4))`,
    [colegioId, dias]
  );
  for (const t of huerfanas.rows) {
    diferencias.push({ tipo: 'recarga_sin_pago', estado: 'revisar', alumno: t.alumno, monto: Number(t.monto), detalle: `Recarga de ${pesos(t.monto)} (MP ${t.mp_id}) sin pago registrado` });
  }

  // Saldo = recargas + anulaciones + ajustes − compras − reversiones
  const descuadres = await pool.query(
    `SELECT a.id, a.nombre, a.saldo, COALESCE(SUM(CASE
         WHEN t.tipo IN ('recarga', 'anulacion', 'ajuste') THEN t.monto
         WHEN t.tipo IN ('compra', 'reversion') THEN -t.monto ELSE 0 END), 0) AS esperado
     FROM alumnos a LEFT JOIN transacciones t ON t.alumno_id = a.id
     WHERE a.colegio_id = $1
     GROUP BY a.id
     HAVING ABS(a.saldo - COALESCE(SUM(CASE
         WHEN t.tipo IN ('recarga', 'anulacion', 'ajuste') THEN t.monto
         WHEN t.tipo IN ('compra', 'reversion') THEN -t.monto ELSE 0 END), 0)) > 0.009
     ORDER BY a.nombre LIMIT ${MAX_DESCUADRES}`,
    [colegioId]
  );
  for (const a of descuadres.rows) {
    diferencias.push({ tipo: 'saldo_descuadrado', estado: 'revisar', alumno: a.nombre, monto: Number(a.saldo), detalle: `El saldo es ${pesos(a.saldo)} pero sus movimientos suman ${pesos(a.esperado)}` });
  }

  const corregidas = diferencias.filter(d => d.estado === 'corregida').length;
  const r = await pool.query(
    `INSERT INTO conciliaciones (colegio_id, origen, empleado_id, dias, revisados, corregidas, diferencias)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [colegioId, origen, empleadoId, dias, revisados, corregidas, JSON.stringify(diferencias)]
  );
  return r.rows[0];
};

module.exports = { conciliarColegio };
