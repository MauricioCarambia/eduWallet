const { Preference, Payment } = require("mercadopago");
const pool = require("../db/conexion");
const { enviarPush } = require("../services/pushService");
const { calcularRecarga, clienteColegio, buscarPago } = require("../services/mercadoPagoService");
const { registrar } = require("./auditoriaController");
const { notificarReversion } = require("../services/notificacionesService");
require("dotenv").config();

// Notifica que la recarga por Mercado Pago fue acreditada: al padre que la
// hizo o, si vino por un link de pago del colegio, a todos los vinculados
const notificarRecargaMP = async (padreId, alumnoId, monto) => {
  try {
    const alumno = await pool.query('SELECT nombre, saldo FROM alumnos WHERE id = $1', [alumnoId]);
    if (alumno.rows.length === 0) return;
    const padres = padreId
      ? [padreId]
      : (await pool.query('SELECT padre_id FROM padres_alumnos WHERE alumno_id = $1', [alumnoId])).rows.map(r => r.padre_id);
    for (const id of padres) {
      await enviarPush(id, {
        title: `Recarga acreditada — ${alumno.rows[0].nombre}`,
        body: `+${Number(monto).toLocaleString('es-AR')} · Nuevo saldo: ${Number(alumno.rows[0].saldo).toLocaleString('es-AR')}`,
        url: '/inicio'
      });
    }
  } catch (err) { console.error('Error notificarRecargaMP:', err.message); }
};

// Mapea los estados de Mercado Pago a los estados internos
const mapEstado = (mpStatus) => {
  if (mpStatus === 'approved') return 'acreditado';
  if (mpStatus === 'in_process' || mpStatus === 'pending' || mpStatus === 'authorized') return 'pendiente';
  return 'rechazado'; // rejected, cancelled, refunded, etc.
};

const MONTO_MAXIMO = 1000000;

// Estados de un pago cuyo saldo ya se acreditó alguna vez
const YA_ACREDITADOS = ['acreditado', 'devuelto_parcial', 'devuelto', 'contracargo', 'en_disputa'];
const redondear = n => Math.round(Number(n) * 100) / 100;

// Mercado Pago cambió un pago que ya habíamos acreditado: devolución (total o
// parcial), contracargo o disputa. Lo devuelto se descuenta del saldo del
// alumno con un movimiento 'reversion'; el saldo puede quedar negativo y así
// el alumno no compra hasta que la familia recargue. monto_revertido lleva la
// cuenta de lo ya descontado, así un aviso repetido no descuenta dos veces.
// Se llama con la fila de pagos bloqueada (FOR UPDATE) dentro de la transacción.
const aplicarCambiosPosteriores = async (db, pago, pagoData) => {
  const monto = Number(pago.monto);
  const yaRevertido = Number(pago.monto_revertido || 0);
  const reembolsado = Number(pagoData.transaction_amount_refunded || 0);
  let objetivo = yaRevertido;
  let estado = pago.estado;
  let motivo = 'Devolución';

  if (pagoData.status === 'charged_back') {
    objetivo = monto; estado = 'contracargo'; motivo = 'Contracargo';
  } else if (pagoData.status === 'refunded' || pagoData.status === 'cancelled') {
    objetivo = monto; estado = 'devuelto';
  } else if (pagoData.status === 'in_mediation') {
    estado = 'en_disputa';
  } else if (pagoData.status === 'approved') {
    if (reembolsado > 0) {
      objetivo = Math.min(monto, reembolsado);
      estado = objetivo >= monto ? 'devuelto' : 'devuelto_parcial';
    } else if (estado === 'en_disputa') {
      estado = yaRevertido > 0 ? 'devuelto_parcial' : 'acreditado'; // la disputa se resolvió a favor
    }
  }
  objetivo = redondear(Math.max(objetivo, yaRevertido)); // nunca se "des-revierte"
  const delta = redondear(objetivo - yaRevertido);

  let saldoNuevo = null;
  if (delta > 0) {
    const a = await db.query('UPDATE alumnos SET saldo = saldo - $1 WHERE id = $2 RETURNING saldo', [delta, pago.alumno_id]);
    saldoNuevo = a.rows[0]?.saldo;
    await db.query(
      `INSERT INTO transacciones (alumno_id, monto, tipo, lugar, descripcion, colegio_id)
       VALUES ($1, $2, 'reversion', 'Mercado Pago', $3, $4)`,
      [pago.alumno_id, delta, `${motivo} de recarga MP:${pagoData.id}`, pago.colegio_id]
    );
  }
  if (estado !== pago.estado || delta > 0) {
    await db.query(
      'UPDATE pagos SET estado = $1, monto_revertido = $2, detalle = $3, actualizado_en = NOW() WHERE id = $4',
      [estado, objetivo, pagoData.status_detail || pagoData.status || pago.detalle, pago.id]
    );
  }
  return { estado, revertido: delta, motivo, saldoNuevo };
};

// Un intento de recarga que no se pagó en este plazo pasa a 'vencido'. La
// preferencia de MP vence al mismo tiempo, así el link ya no se puede pagar.
// Los links de pago del colegio viajan por WhatsApp/email: tienen más tiempo.
const HORAS_VENCIMIENTO = 24;
const HORAS_VENCIMIENTO_LINK = 72;

const vencimientoPreferencia = (horas) => new Date(Date.now() + horas * 3600 * 1000).toISOString();

// Marca como vencidos los intentos que nunca llegaron a tener un pago en MP
// (checkout abierto y abandonado). Los que tienen mp_payment_id quedan
// pendientes: son pagos en proceso (ej. efectivo) que MP todavía puede aprobar.
const vencerPagosPendientes = async () => {
  const r = await pool.query(
`UPDATE pagos SET estado = 'vencido', detalle = 'Sin pagar a tiempo', actualizado_en = NOW()
     WHERE estado = 'pendiente' AND mp_payment_id IS NULL
       AND creado_en < NOW() - make_interval(hours => CASE WHEN origen = 'link' THEN ${HORAS_VENCIMIENTO_LINK} ELSE ${HORAS_VENCIMIENTO} END)`
  );
  return r.rowCount;
};

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
// Otro pago de Mercado Pago con la misma referencia que una recarga ya
// acreditada con otro pago (ej.: la familia eligió pagar en Rapipago y después
// pagó con tarjeta, o pagó dos veces). Cada pago se trata por separado:
//   - aprobado y todavía sin acreditar → se acredita (la plata entró)
//   - devuelto, cancelado o contracargo, y se había acreditado → se descuenta
//   - cualquier otra cosa (ej.: el cupón de Rapipago que venció) → nada
// Antes se lo tomaba como un cambio del pago acreditado: si vencía el cupón,
// se le descontaba al alumno la recarga que sí había pagado con tarjeta.
const aplicarOtroPago = async (db, pago, pagoData) => {
  const paymentId = String(pagoData.id);
  const ref = `MP:${paymentId}`;
  const acreditada = (await db.query(
    "SELECT 1 FROM transacciones WHERE tipo = 'recarga' AND descripcion = $1", [ref]
  )).rows.length > 0;
  const monto = Number(pago.monto);

  if (pagoData.status === 'approved' && !acreditada) {
    const esperado = Number(pago.monto_total ?? pago.monto);
    if (Number(pagoData.transaction_amount) + 0.01 < esperado) return { accion: 'monto_inconsistente' };
    const tx = await db.query(
      `INSERT INTO transacciones (alumno_id, monto, tipo, lugar, descripcion, colegio_id)
       VALUES ($1, $2, 'recarga', 'Mercado Pago', $3, $4) ON CONFLICT DO NOTHING RETURNING id`,
      [pago.alumno_id, monto, ref, pago.colegio_id]
    );
    if (!tx.rows.length) return { accion: null };
    await db.query('UPDATE alumnos SET saldo = saldo + $1 WHERE id = $2', [monto, pago.alumno_id]);
    return { accion: 'acreditado', monto };
  }

  if (['refunded', 'cancelled', 'charged_back'].includes(pagoData.status) && acreditada) {
    const yaRevertida = (await db.query(
      "SELECT 1 FROM transacciones WHERE tipo = 'reversion' AND descripcion LIKE $1", [`% ${ref}`]
    )).rows.length > 0;
    if (yaRevertida) return { accion: null };
    const motivo = pagoData.status === 'charged_back' ? 'Contracargo' : 'Devolución';
    const a = await db.query('UPDATE alumnos SET saldo = saldo - $1 WHERE id = $2 RETURNING saldo', [monto, pago.alumno_id]);
    await db.query(
      `INSERT INTO transacciones (alumno_id, monto, tipo, lugar, descripcion, colegio_id)
       VALUES ($1, $2, 'reversion', 'Mercado Pago', $3, $4)`,
      [pago.alumno_id, monto, `${motivo} de recarga ${ref}`, pago.colegio_id]
    );
    return { accion: 'revertido', monto, motivo, saldoNuevo: a.rows[0]?.saldo };
  }
  return { accion: null };
};

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
      if (!/^\d+_\d+_/.test(ref)) {
        await db.query('ROLLBACK');
        return { estado: null, acreditado: false, pago: null };
      }
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

    if (YA_ACREDITADOS.includes(pago.estado) && pago.mp_payment_id && pago.mp_payment_id !== paymentId) {
      const otro = await aplicarOtroPago(db, pago, pagoData);
      await db.query('COMMIT');
      if (otro.accion === 'acreditado') {
        await registrar(null, pago.colegio_id, 'Recarga pagada dos veces',
          `Pago MP ${paymentId} con la misma referencia que el ${pago.mp_payment_id}: se acreditaron ${otro.monto} al alumno #${pago.alumno_id}`).catch(() => {});
        await notificarRecargaMP(pago.padre_id, pago.alumno_id, otro.monto);
        return { estado: pago.estado, acreditado: true, pago };
      }
      if (otro.accion === 'revertido') {
        await registrar(null, pago.colegio_id, `Recarga revertida por Mercado Pago (${otro.motivo.toLowerCase()})`,
          `Pago MP ${paymentId}: se descontaron ${otro.monto} del alumno #${pago.alumno_id}`).catch(() => {});
        await notificarReversion({ colegioId: pago.colegio_id, alumnoId: pago.alumno_id, monto: otro.monto, motivo: otro.motivo, saldoNuevo: otro.saldoNuevo });
        return { estado: pago.estado, acreditado: false, pago, revertido: otro.monto };
      }
      if (otro.accion === 'monto_inconsistente') console.error(`Pago MP ${paymentId}: monto menor al esperado, no se acreditó`);
      return { estado: pago.estado, acreditado: false, pago };
    }

    if (YA_ACREDITADOS.includes(pago.estado)) {
      // Ya se acreditó antes: sólo pueden venir devoluciones, contracargos o disputas
      const cambio = await aplicarCambiosPosteriores(db, pago, pagoData);
      await db.query('COMMIT');
      if (cambio.revertido > 0) {
        await registrar(null, pago.colegio_id, `Recarga revertida por Mercado Pago (${cambio.motivo.toLowerCase()})`,
          `Pago MP ${paymentId}: se descontaron ${cambio.revertido} del alumno #${pago.alumno_id}`).catch(() => {});
        await notificarReversion({ colegioId: pago.colegio_id, alumnoId: pago.alumno_id, monto: cambio.revertido, motivo: cambio.motivo, saldoNuevo: cambio.saldoNuevo });
      }
      return { estado: cambio.estado, acreditado: false, pago, revertido: cambio.revertido };
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
      title: `Recarga KoleTap — ${alumno.nombre}`,
      description: `Saldo para consumos en el colegio de ${alumno.nombre}`,
      category_id: 'services',
      quantity: 1,
      unit_price: calc.monto,
      currency_id: 'ARS',
    }];
    if (calc.comision > 0) {
      items.push({
        id: 'cargo_servicio',
        title: 'Cargo por servicio KoleTap',
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
      statement_descriptor: 'KOLETAP',
      external_reference: externalReference,
      notification_url: notificationUrl(alumno.colegio_id),
      expires: true,
      expiration_date_to: vencimientoPreferencia(HORAS_VENCIMIENTO),
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
      description: `Recarga KoleTap alumno ${alumno_id}`,
      installments: Number(installments) || 1,
      payment_method_id,
      issuer_id,
      payer: {
        email: payer?.email || email,
        identification: payer?.identification
      },
      statement_descriptor: 'KOLETAP',
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

const ESTADOS_PAGO = ['pendiente', 'acreditado', 'rechazado', 'vencido', 'devuelto', 'devuelto_parcial', 'contracargo', 'en_disputa'];

// Historial de recargas del padre logueado (últimas 50), opcionalmente
// filtrado por estado: ?estado=pendiente|acreditado|rechazado|vencido
const getHistorialPagos = async (req, res) => {
  const padreId = req.padre.id;
  const { estado } = req.query;
  if (estado && !ESTADOS_PAGO.includes(estado)) return res.status(400).json({ error: 'Estado inválido' });
  try {
    const result = await pool.query(
      `SELECT p.id, p.monto, p.comision, p.monto_total, p.estado, p.detalle, p.creado_en, p.actualizado_en,
              a.nombre AS alumno_nombre
       FROM pagos p
       JOIN alumnos a ON a.id = p.alumno_id
       WHERE p.padre_id = $1 AND ($2::text IS NULL OR p.estado = $2)
       ORDER BY p.creado_en DESC
       LIMIT 50`,
      [padreId, estado || null]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error getHistorialPagos:', err);
    res.status(500).json({ error: 'Error al obtener historial de pagos' });
  }
};

// Historial de recargas por Mercado Pago de todo el colegio (panel admin).
// Filtros: estado, q (alumno, padre o email), desde/hasta (YYYY-MM-DD).
// El resumen por estado ignora el filtro de estado (para los contadores).
const getRecargasColegio = async (req, res) => {
  const { estado, q, desde, hasta, page = 1, limit = 50 } = req.query;
  if (estado && !ESTADOS_PAGO.includes(estado)) return res.status(400).json({ error: 'Estado inválido' });
  const fecha = /^\d{4}-\d{2}-\d{2}$/;
  if ((desde && !fecha.test(desde)) || (hasta && !fecha.test(hasta))) return res.status(400).json({ error: 'Fecha inválida' });

  const limitNum = Math.min(Math.max(parseInt(limit) || 50, 1), 200);
  const pageNum = Math.max(parseInt(page) || 1, 1);

  // creado_en se guarda en UTC: los días del filtro son días de Argentina
  const fechaAR = `(p.creado_en AT TIME ZONE 'UTC' AT TIME ZONE 'America/Argentina/Buenos_Aires')::date`;
  // Filtros comunes ($1..$4); el de estado se agrega sólo a la lista
  const params = [req.empleado.colegio_id, q ? `%${q.trim()}%` : null, desde || null, hasta || null];
  const where = `
    p.colegio_id = $1
    AND ($2::text IS NULL OR a.nombre ILIKE $2 OR pa.nombre ILIKE $2 OR pa.email ILIKE $2)
    AND ($3::date IS NULL OR ${fechaAR} >= $3::date)
    AND ($4::date IS NULL OR ${fechaAR} <= $4::date)`;
  const from = `FROM pagos p JOIN alumnos a ON a.id = p.alumno_id LEFT JOIN padres pa ON pa.id = p.padre_id`;

  try {
    const [lista, resumen] = await Promise.all([
      pool.query(
        `SELECT p.id, p.monto, p.comision, p.monto_total, p.estado, p.detalle, p.mp_payment_id, p.origen,
                p.creado_en, p.actualizado_en,
                a.id AS alumno_id, a.nombre AS alumno_nombre, pa.nombre AS padre_nombre, pa.email AS padre_email,
                COUNT(*) OVER() AS total_filtrado
         ${from}
         WHERE ${where} AND ($5::text IS NULL OR p.estado = $5)
         ORDER BY p.creado_en DESC
         LIMIT $6 OFFSET $7`,
        [...params, estado || null, limitNum, (pageNum - 1) * limitNum]
      ),
      pool.query(
        `SELECT p.estado, COUNT(*)::int AS cantidad,
                COALESCE(SUM(p.monto), 0) AS monto, COALESCE(SUM(p.comision), 0) AS comision,
                COALESCE(SUM(p.monto_total), 0) AS monto_total
         ${from}
         WHERE ${where}
         GROUP BY p.estado`,
        params
      ),
    ]);

    const total = lista.rows.length ? parseInt(lista.rows[0].total_filtrado) : 0;
    const porEstado = Object.fromEntries(ESTADOS_PAGO.map(e => [e, { cantidad: 0, monto: '0', comision: '0', monto_total: '0' }]));
    resumen.rows.forEach(r => { porEstado[r.estado] = { cantidad: r.cantidad, monto: r.monto, comision: r.comision, monto_total: r.monto_total }; });

    res.json({
      data: lista.rows.map(({ total_filtrado, ...r }) => r),
      total,
      page: pageNum,
      limit: limitNum,
      pages: Math.max(Math.ceil(total / limitNum), 1),
      resumen: porEstado,
    });
  } catch (err) {
    console.error('Error getRecargasColegio:', err.message);
    res.status(500).json({ error: 'Error al obtener las recargas' });
  }
};

// El colegio genera un link de pago para un alumno (padres que no usan la
// app): mismo circuito que la app — modelo B, split y comisión — pero sin
// padre asociado. El padre paga como invitado (tarjeta, Rapipago, Pago
// Fácil) y el webhook acredita el saldo.
const crearLinkPago = async (req, res) => {
  const { alumno_id, monto } = req.body;
  if (!montoValido(monto)) return res.status(400).json({ error: 'Monto inválido' });

  try {
    const r = await pool.query(
      `SELECT a.id, a.nombre, a.colegio_id, a.activo, c.comision_pct
       FROM alumnos a JOIN colegios c ON c.id = a.colegio_id
       WHERE a.id = $1 AND a.colegio_id = $2`,
      [alumno_id, req.empleado.colegio_id]
    );
    const alumno = r.rows[0];
    if (!alumno) return res.status(404).json({ error: 'Alumno no encontrado' });
    if (!alumno.activo) return res.status(400).json({ error: 'El alumno está inactivo' });

    const calc = calcularRecarga(monto, alumno.comision_pct);
    const { client, split } = await clienteColegio(alumno.colegio_id);
    const externalReference = `link_${alumno.id}_${calc.monto}_${Date.now()}`;
    const expira = vencimientoPreferencia(HORAS_VENCIMIENTO_LINK);

    const items = [{
      id: `recarga_${alumno.id}`,
      title: `Recarga KoleTap — ${alumno.nombre}`,
      description: `Saldo para consumos en el colegio de ${alumno.nombre}`,
      category_id: 'services',
      quantity: 1,
      unit_price: calc.monto,
      currency_id: 'ARS',
    }];
    if (calc.comision > 0) {
      items.push({
        id: 'cargo_servicio',
        title: 'Cargo por servicio KoleTap',
        description: 'Comisión de la plataforma',
        category_id: 'services',
        quantity: 1,
        unit_price: calc.comision,
        currency_id: 'ARS',
      });
    }
    const body = {
      items,
      statement_descriptor: 'KOLETAP',
      external_reference: externalReference,
      notification_url: notificationUrl(alumno.colegio_id),
      expires: true,
      expiration_date_to: expira,
    };
    if (split && calc.comision > 0) body.marketplace_fee = calc.comision;

    await pool.query(
      `INSERT INTO pagos (padre_id, alumno_id, monto, comision, monto_total, estado, external_reference, detalle, colegio_id, origen)
       VALUES (NULL, $1, $2, $3, $4, 'pendiente', $5, 'Link de pago', $6, 'link')`,
      [alumno.id, calc.monto, calc.comision, calc.total, externalReference, alumno.colegio_id]
    );

    let result;
    try {
      result = await new Preference(client).create({ body });
    } catch (err) {
      await pool.query(
        `UPDATE pagos SET estado = 'rechazado', detalle = 'Error al crear el link', actualizado_en = NOW()
         WHERE external_reference = $1`,
        [externalReference]
      ).catch(() => {});
      throw err;
    }

    await registrar(req.empleado.id, alumno.colegio_id, 'Link de pago', `${alumno.nombre} — ${calc.monto}`);
    res.json({ url: result.init_point, expira, alumno: alumno.nombre, ...calc });
  } catch (err) {
    console.error('Error crearLinkPago:', err.message);
    res.status(500).json({ error: 'Error al generar el link de pago' });
  }
};

module.exports = { crearLinkPago, crearPreferencia, procesarPago, webhook, verificarPago, getHistorialPagos, getRecargasColegio, acreditarPago, vencerPagosPendientes };
