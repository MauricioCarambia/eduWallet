const { Preference, Payment } = require("mercadopago");
const pool = require("../db/conexion");
const { enviarPush } = require("../services/pushService");
const { calcularRecarga, clienteColegio, buscarPago } = require("../services/mercadoPagoService");
require("dotenv").config();

// Notifica al padre que su recarga por Mercado Pago fue acreditada
const notificarRecargaMP = async (padreId, alumnoId, monto) => {
  try {
    const alumno = await pool.query('SELECT nombre, saldo FROM alumnos WHERE id = $1', [alumnoId]);
    if (alumno.rows.length === 0) return;
    await enviarPush(padreId, {
      title: `Recarga acreditada — ${alumno.rows[0].nombre}`,
      body: `+$${Number(monto).toLocaleString('es-AR')} · Nuevo saldo: $${Number(alumno.rows[0].saldo).toLocaleString('es-AR')}`,
      url: '/inicio'
    });
  } catch (err) { console.error('Error notificarRecargaMP:', err.message); }
};

// Mapea los estados de Mercado Pago a los estados internos
const mapEstado = (mpStatus) => {
  if (mpStatus === 'approved') return 'acreditado';
  if (mpStatus === 'in_process' || mpStatus === 'pending' || mpStatus === 'authorized') return 'pendiente';
  return 'rechazado'; // rejected, cancelled, refunded, etc.
};

const MONTO_MAXIMO = 1000000;

const montoValido = (monto) => {
  const n = Number(monto);
  return Number.isFinite(n) && n > 0 && n <= MONTO_MAXIMO;
};

const notificationUrl = (colegioId) =>
  `${process.env.BACKEND_URL}/api/pagos/webhook?colegio_id=${colegioId}`;

// Datos del alumno + comisión del colegio, verificando que el padre esté vinculado
const alumnoDelPadre = async (padreId, alumnoId) => {
  const r = await pool.query(
    `SELECT a.id, a.nombre, a.colegio_id, c.comision_pct
     FROM alumnos a
     JOIN padres_alumnos pa ON pa.alumno_id = a.id AND pa.padre_id = $1
     JOIN colegios c ON c.id = a.colegio_id
     WHERE a.id = $2`,
    [padreId, alumnoId]
  );
  return r.rows[0] || null;
};

// Único lugar donde se acredita saldo por Mercado Pago. Lo usan el webhook,
// /verificar y /procesar: la fila de `pagos` se bloquea (FOR UPDATE) y la
// transacción MP:<id> tiene índice único, así que aunque lleguen varios
// avisos del mismo pago al mismo tiempo, el saldo se suma una sola vez.
// El monto a acreditar sale siempre de nuestra fila de `pagos`, nunca del
// cliente ni de la URL de retorno.
const acreditarPago = async (pagoData) => {
  const ref = pagoData.external_reference;
  if (!ref) return { estado: null, acreditado: false, pago: null };

  const paymentId = String(pagoData.id);
  const db = await pool.connect();
  let acreditado = false;
  let pago;
  let estado = mapEstado(pagoData.status);

  try {
    await db.query('BEGIN');

    let r = await db.query('SELECT * FROM pagos WHERE external_reference = $1 FOR UPDATE', [ref]);
    if (r.rows.length === 0) {
      // Pago sin registro previo (anterior al registro de intentos): se
      // reconstruye desde la referencia, que generamos nosotros
      const [padreId, alumnoId, monto] = ref.split('_');
      const al = await db.query('SELECT colegio_id FROM alumnos WHERE id = $1', [alumnoId]);
      if (al.rows.length === 0 || !montoValido(monto)) {
        await db.query('ROLLBACK');
        return { estado: null, acreditado: false, pago: null };
      }
      await db.query(
        `INSERT INTO pagos (padre_id, alumno_id, monto, monto_total, estado, external_reference, detalle, colegio_id)
         VALUES ($1, $2, $3, $3, 'pendiente', $4, 'Mercado Pago', $5)
         ON CONFLICT (external_reference) DO NOTHING`,
        [padreId, alumnoId, monto, ref, al.rows[0].colegio_id]
      );
      r = await db.query('SELECT * FROM pagos WHERE external_reference = $1 FOR UPDATE', [ref]);
    }
    pago = r.rows[0];

    if (pago.estado === 'acreditado') {
      // Ya se acreditó antes: nada que hacer (no se "desacredita" acá)
      await db.query('COMMIT');
      return { estado: 'acreditado', acreditado: false, pago };
    }

    let detalle = pagoData.status_detail || null;
    const esperado = Number(pago.monto_total ?? pago.monto);
    if (estado === 'acreditado' && Number(pagoData.transaction_amount) + 0.01 < esperado) {
      // Se pagó menos de lo que se cobró (monto + comisión): no se acredita
      console.error(`Pago MP ${paymentId}: pagado ${pagoData.transaction_amount}, esperado ${esperado}`);
      estado = 'rechazado';
      detalle = 'monto_inconsistente';
    }

    await db.query(
      `UPDATE pagos SET estado = $1, mp_payment_id = $2, detalle = $3, actualizado_en = NOW() WHERE id = $4`,
      [estado, paymentId, detalle, pago.id]
    );

    if (estado === 'acreditado') {
      const tx = await db.query(
        `INSERT INTO transacciones (alumno_id, monto, tipo, lugar, descripcion, colegio_id)
         VALUES ($1, $2, 'recarga', 'Mercado Pago', $3, $4)
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [pago.alumno_id, pago.monto, `MP:${paymentId}`, pago.colegio_id]
      );
      if (tx.rows.length > 0) {
        await db.query('UPDATE alumnos SET saldo = saldo + $1 WHERE id = $2', [pago.monto, pago.alumno_id]);
        acreditado = true;
      }
    }

    await db.query('COMMIT');
  } catch (err) {
    await db.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    db.release();
  }

  if (acreditado) await notificarRecargaMP(pago.padre_id, pago.alumno_id, pago.monto);
  return { estado, acreditado, pago };
};

// Modelo B: el padre elige el saldo a cargar (`monto`) y paga monto + comisión.
// Si el colegio tiene su cuenta de MP conectada, la preferencia se crea a
// su nombre y la comisión va a la plataforma como marketplace_fee (split).
const crearPreferencia = async (req, res) => {
  const { monto, alumno_id } = req.body;
  const padreId = req.padre.id;
  if (!montoValido(monto)) return res.status(400).json({ error: 'Monto inválido' });

  try {
    const alumno = await alumnoDelPadre(padreId, alumno_id);
    if (!alumno) return res.status(403).json({ error: 'Sin acceso a este alumno' });

    const padreRes = await pool.query('SELECT nombre, email FROM padres WHERE id = $1', [padreId]);
    const padre = padreRes.rows[0];
    const [nombre, ...apellidos] = (padre.nombre || '').trim().split(/\s+/);

    const calc = calcularRecarga(monto, alumno.comision_pct);
    const { client, split } = await clienteColegio(alumno.colegio_id);
    if (!split && calc.comision > 0) {
      console.warn(`Colegio ${alumno.colegio_id} sin MP conectado: la recarga entra entera a la cuenta de la plataforma`);
    }

    const externalReference = `${padreId}_${alumno_id}_${calc.monto}_${Date.now()}`;

    const items = [{
      id: `recarga_${alumno_id}`,
      title: `Recarga EduWallet — ${alumno.nombre}`,
      description: `Saldo para consumos en el colegio de ${alumno.nombre}`,
      category_id: 'services',
      quantity: 1,
      unit_price: calc.monto,
      currency_id: 'ARS',
    }];
    if (calc.comision > 0) {
      items.push({
        id: 'cargo_servicio',
        title: 'Cargo por servicio EduWallet',
        description: 'Comisión de la plataforma',
        category_id: 'services',
        quantity: 1,
        unit_price: calc.comision,
        currency_id: 'ARS',
      });
    }

    const body = {
      items,
      payer: { name: nombre, surname: apellidos.join(' ') || undefined, email: padre.email },
      back_urls: {
        success: `${process.env.PADRES_URL}/recargar?status=success&alumno=${alumno_id}`,
        failure: `${process.env.PADRES_URL}/recargar?status=failure`,
        pending: `${process.env.PADRES_URL}/recargar?status=pending`,
      },
      auto_return: 'approved',
      statement_descriptor: 'EDUWALLET',
      external_reference: externalReference,
      notification_url: notificationUrl(alumno.colegio_id),
    };
    if (split && calc.comision > 0) body.marketplace_fee = calc.comision;

    // Registramos el intento antes de ir a MP: así el webhook siempre
    // encuentra el monto a acreditar y la comisión cobrada
    await pool.query(
      `INSERT INTO pagos (padre_id, alumno_id, monto, comision, monto_total, estado, external_reference, detalle, colegio_id)
       VALUES ($1, $2, $3, $4, $5, 'pendiente', $6, 'Mercado Pago (checkout)', $7)`,
      [padreId, alumno_id, calc.monto, calc.comision, calc.total, externalReference, alumno.colegio_id]
    );

    let result;
    try {
      result = await new Preference(client).create({ body });
    } catch (err) {
      await pool.query(
        `UPDATE pagos SET estado = 'rechazado', detalle = 'Error al crear la preferencia', actualizado_en = NOW()
         WHERE external_reference = $1`,
        [externalReference]
      ).catch(() => {});
      throw err;
    }

    res.json({ init_point: result.init_point, preference_id: result.id, ...calc });
  } catch (err) {
    console.error('Error crearPreferencia:', err.message);
    res.status(500).json({ error: 'Error al crear preferencia de pago' });
  }
};

// Checkout API / Bricks (hoy la app de padres usa Checkout Pro). Con split,
// el token de tarjeta tiene que generarse con la public key del colegio.
const procesarPago = async (req, res) => {
  const { token, payment_method_id, issuer_id, installments, monto, alumno_id, email, payer } = req.body;
  const padreId = req.padre.id;
  if (!montoValido(monto)) return res.status(400).json({ error: 'Monto inválido' });

  let externalReference;
  try {
    const alumno = await alumnoDelPadre(padreId, alumno_id);
    if (!alumno) return res.status(403).json({ error: 'Sin acceso a este alumno' });

    const calc = calcularRecarga(monto, alumno.comision_pct);
    const { client, split } = await clienteColegio(alumno.colegio_id);
    externalReference = `${padreId}_${alumno_id}_${calc.monto}_${Date.now()}`;

    await pool.query(
      `INSERT INTO pagos (padre_id, alumno_id, monto, comision, monto_total, estado, external_reference, detalle, colegio_id)
       VALUES ($1, $2, $3, $4, $5, 'pendiente', $6, 'Mercado Pago (tarjeta)', $7)`,
      [padreId, alumno_id, calc.monto, calc.comision, calc.total, externalReference, alumno.colegio_id]
    );

    const body = {
      transaction_amount: calc.total,
      token,
      description: `Recarga EduWallet alumno ${alumno_id}`,
      installments: Number(installments) || 1,
      payment_method_id,
      issuer_id,
      payer: {
        email: payer?.email || email,
        identification: payer?.identification
      },
      statement_descriptor: 'EDUWALLET',
      external_reference: externalReference,
      notification_url: notificationUrl(alumno.colegio_id),
    };
    if (split && calc.comision > 0) body.application_fee = calc.comision;

    const result = await new Payment(client).create({ body, requestOptions: { idempotencyKey: externalReference } });
    const { estado } = await acreditarPago(result);

    if (estado === 'acreditado') {
      const saldo = await pool.query('SELECT saldo FROM alumnos WHERE id = $1', [alumno_id]);
      return res.json({ status: 'approved', saldo: saldo.rows[0].saldo, payment_id: result.id });
    }
    if (result.status === 'in_process') return res.json({ status: 'pending' });
    res.json({ status: result.status, detail: result.status_detail });
  } catch (err) {
    console.error('Error procesarPago:', err.message);
    if (externalReference) {
      await pool.query(
        `UPDATE pagos SET estado = 'rechazado', detalle = 'Error al procesar el pago', actualizado_en = NOW()
         WHERE external_reference = $1 AND estado = 'pendiente'`,
        [externalReference]
      ).catch(e => console.error('Error registrando pago fallido:', e.message));
    }
    res.status(500).json({ error: 'Error al procesar el pago' });
  }
};

const webhook = async (req, res) => {
  const { type, data } = req.body || {};
  if (type !== "payment" || !data?.id) return res.sendStatus(200);
  try {
    // colegio_id viene en la notification_url que armamos nosotros: sólo
    // indica con qué cuenta consultar el pago, los datos salen de MP
    const colegioId = Number(req.query.colegio_id);
    const pagoData = await buscarPago(data.id, colegioId ? [colegioId] : []);
    await acreditarPago(pagoData);
    res.sendStatus(200);
  } catch (err) {
    console.error('Error webhook MP:', err.message);
    res.sendStatus(500);
  }
};

const verificarPago = async (req, res) => {
  const { payment_id } = req.query;
  if (!payment_id) return res.status(400).json({ error: 'Falta payment_id' });
  try {
    const colegios = await pool.query(
      `SELECT DISTINCT a.colegio_id FROM alumnos a
       JOIN padres_alumnos pa ON pa.alumno_id = a.id
       WHERE pa.padre_id = $1`,
      [req.padre.id]
    );
    const pagoData = await buscarPago(payment_id, colegios.rows.map(c => c.colegio_id));

    const ref = pagoData.external_reference;
    if (!ref) return res.status(400).json({ error: 'Pago sin referencia válida' });
    if (ref.split('_')[0] !== String(req.padre.id)) {
      return res.status(403).json({ error: 'Este pago no te pertenece' });
    }

    const { estado, pago } = await acreditarPago(pagoData);
    if (estado !== 'acreditado') return res.json({ status: pagoData.status });

    const alumno = await pool.query("SELECT saldo FROM alumnos WHERE id = $1", [pago.alumno_id]);
    res.json({ status: "approved", saldo: alumno.rows[0].saldo });
  } catch (err) {
    console.error('Error verificarPago:', err.message);
    res.status(500).json({ error: "Error al verificar pago" });
  }
};

// Historial de recargas (con estados pendiente/acreditado/rechazado) para el padre logueado
const getHistorialPagos = async (req, res) => {
  const padreId = req.padre.id;
  try {
    const result = await pool.query(
      `SELECT p.id, p.monto, p.comision, p.monto_total, p.estado, p.detalle, p.creado_en, p.actualizado_en,
              a.nombre AS alumno_nombre
       FROM pagos p
       JOIN alumnos a ON a.id = p.alumno_id
       WHERE p.padre_id = $1
       ORDER BY p.creado_en DESC
       LIMIT 50`,
      [padreId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error getHistorialPagos:', err);
    res.status(500).json({ error: 'Error al obtener historial de pagos' });
  }
};

module.exports = { crearPreferencia, procesarPago, webhook, verificarPago, getHistorialPagos, acreditarPago };
