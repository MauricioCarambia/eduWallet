const { MercadoPagoConfig, Preference, Payment } = require("mercadopago");
const pool = require("../db/conexion");
const { enviarPush } = require("../services/pushService");
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

const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN,
});

// Mapea los estados de Mercado Pago a los estados internos
const mapEstado = (mpStatus) => {
  if (mpStatus === 'approved') return 'acreditado';
  if (mpStatus === 'in_process' || mpStatus === 'pending' || mpStatus === 'authorized') return 'pendiente';
  return 'rechazado'; // rejected, cancelled, refunded, etc.
};

const crearPreferencia = async (req, res) => {
  console.log('Creando preferencia:', req.body)
  const { monto, alumno_id } = req.body;
  const padreId = req.padre.id;
  try {
    const padreRes = await pool.query('SELECT * FROM padres WHERE id = $1', [padreId]);
    const alumnoRes = await pool.query('SELECT * FROM alumnos WHERE id = $1', [alumno_id]);
    if (alumnoRes.rows.length === 0) return res.status(404).json({ error: 'Alumno no encontrado' });

    const padre = padreRes.rows[0];
    const alumno = alumnoRes.rows[0];
    const externalReference = `${padreId}_${alumno_id}_${monto}_${Date.now()}`;

    const preference = new Preference(client);
    const result = await preference.create({
      body: {
        items: [{
          id: `recarga_${alumno_id}`,
          title: `Recarga EduWallet — ${alumno.nombre}`,
          quantity: 1,
          unit_price: Number(monto),
          currency_id: 'ARS',
        }],
        payer: { name: padre.nombre, email: padre.email },
        back_urls: {
          success: `${process.env.PADRES_URL}/recargar?status=success&alumno=${alumno_id}&monto=${monto}`,
          failure: `${process.env.PADRES_URL}/recargar?status=failure`,
          pending: `${process.env.PADRES_URL}/recargar?status=pending`,
        },
        auto_return: 'approved',
        external_reference: externalReference,
        notification_url: `${process.env.BACKEND_URL}/api/pagos/webhook`,
      }
    });

    // Registramos el intento de recarga como "pendiente"
    await pool.query(
      `INSERT INTO pagos (padre_id, alumno_id, monto, estado, external_reference, detalle)
       VALUES ($1, $2, $3, 'pendiente', $4, 'Mercado Pago (checkout)')`,
      [padreId, alumno_id, monto, externalReference]
    );

    res.json({ init_point: result.init_point, preference_id: result.id });
  } catch (err) {
    console.error('Error crearPreferencia:', JSON.stringify(err))
    res.status(500).json({ error: 'Error al crear preferencia de pago' });
  }
};

const procesarPago = async (req, res) => {
  console.log('Body recibido:', JSON.stringify(req.body, null, 2));
  const { token, payment_method_id, issuer_id, installments, monto, alumno_id, email, payer } = req.body;
  const padreId = req.padre.id;

  try {
    const vinculo = await pool.query(
      'SELECT id FROM padres_alumnos WHERE padre_id = $1 AND alumno_id = $2',
      [padreId, alumno_id]
    );
    if (vinculo.rows.length === 0) return res.status(403).json({ error: 'Sin acceso a este alumno' });

    const externalReference = `${padreId}_${alumno_id}_${monto}_${Date.now()}`;

    const payment = new Payment(client);
    const result = await payment.create({
      body: {
        transaction_amount: Number(monto),
        token,
        description: `Recarga EduWallet alumno ${alumno_id}`,
        installments: Number(installments) || 1,
        payment_method_id,
        issuer_id,
        payer: {
          email: payer?.email || email,
          identification: payer?.identification
        },
        external_reference: externalReference,
        notification_url: `${process.env.BACKEND_URL}/api/pagos/webhook`,
      }
    });

    const estado = mapEstado(result.status);

    // Registramos el intento de pago en el historial
    await pool.query(
      `INSERT INTO pagos (padre_id, alumno_id, monto, estado, mp_payment_id, external_reference, detalle)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [padreId, alumno_id, monto, estado, String(result.id), externalReference, result.status_detail || null]
    );

    if (result.status === 'approved') {
      const existe = await pool.query(
        'SELECT id FROM transacciones WHERE descripcion = $1',
        [`MP:${result.id}`]
      );
      if (existe.rows.length === 0) {
        await pool.query('UPDATE alumnos SET saldo = saldo + $1 WHERE id = $2', [monto, alumno_id]);
        await pool.query(
          `INSERT INTO transacciones (alumno_id, monto, tipo, lugar, descripcion)
           VALUES ($1, $2, 'recarga', 'Mercado Pago', $3)`,
          [alumno_id, monto, `MP:${result.id}`]
        );
      }
      const alumno = await pool.query('SELECT saldo FROM alumnos WHERE id = $1', [alumno_id]);
      await notificarRecargaMP(padreId, alumno_id, monto);
      return res.json({ status: 'approved', saldo: alumno.rows[0].saldo, payment_id: result.id });
    }

    if (result.status === 'in_process') return res.json({ status: 'pending' });
    res.json({ status: result.status, detail: result.status_detail });
  } catch (err) {
    console.error('Error procesarPago:', err);

    // Registramos el intento fallido en el historial (si tenemos los datos mínimos)
    try {
      await pool.query(
        `INSERT INTO pagos (padre_id, alumno_id, monto, estado, detalle)
         VALUES ($1, $2, $3, 'rechazado', 'Error al procesar el pago')`,
        [padreId, alumno_id, monto]
      );
    } catch (e) { console.error('Error registrando pago fallido:', e.message); }

    res.status(500).json({ error: 'Error al procesar el pago' });
  }
};

const webhook = async (req, res) => {
  const { type, data } = req.body;
  if (type !== "payment") return res.sendStatus(200);
  try {
    const payment = new Payment(client);
    const pagoData = await payment.get({ id: data.id });
    const ref = pagoData.external_reference;
    const [padreId, alumnoId, monto] = ref.split("_");
    const estado = mapEstado(pagoData.status);

    // actualizar (o crear) el registro en pagos
    const existePago = await pool.query('SELECT id FROM pagos WHERE external_reference = $1', [ref]);
    if (existePago.rows.length > 0) {
      await pool.query(
        `UPDATE pagos SET estado = $1, mp_payment_id = $2, detalle = $3, actualizado_en = NOW() WHERE external_reference = $4`,
        [estado, String(data.id), pagoData.status_detail || null, ref]
      );
    } else {
      await pool.query(
        `INSERT INTO pagos (padre_id, alumno_id, monto, estado, mp_payment_id, external_reference, detalle)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [padreId, alumnoId, monto, estado, String(data.id), ref, pagoData.status_detail || null]
      );
    }

    if (pagoData.status !== "approved") return res.sendStatus(200);

    const existe = await pool.query(
      "SELECT id FROM transacciones WHERE descripcion = $1",
      [`MP:${data.id}`],
    );
    if (existe.rows.length > 0) return res.sendStatus(200);
    await pool.query("UPDATE alumnos SET saldo = saldo + $1 WHERE id = $2", [
      monto,
      alumnoId,
    ]);
    await pool.query(
      `INSERT INTO transacciones (alumno_id, monto, tipo, lugar, descripcion)
       VALUES ($1, $2, 'recarga', 'Mercado Pago', $3)`,
      [alumnoId, monto, `MP:${data.id}`],
    );
    await notificarRecargaMP(padreId, alumnoId, monto);
    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
};

const verificarPago = async (req, res) => {
  const { payment_id, alumno_id, monto } = req.query;
  try {
    const payment = new Payment(client);
    const pagoData = await payment.get({ id: payment_id });
    const estado = mapEstado(pagoData.status);
    const ref = pagoData.external_reference;

    // actualizar (o crear) el registro en pagos
    if (ref) {
      const existePago = await pool.query('SELECT id FROM pagos WHERE external_reference = $1', [ref]);
      if (existePago.rows.length > 0) {
        await pool.query(
          `UPDATE pagos SET estado = $1, mp_payment_id = $2, detalle = $3, actualizado_en = NOW() WHERE external_reference = $4`,
          [estado, String(payment_id), pagoData.status_detail || null, ref]
        );
      }
    }

    if (pagoData.status !== "approved") {
      return res.json({ status: pagoData.status });
    }
    const existe = await pool.query(
      "SELECT id FROM transacciones WHERE descripcion = $1",
      [`MP:${payment_id}`],
    );
    if (existe.rows.length === 0) {
      await pool.query("UPDATE alumnos SET saldo = saldo + $1 WHERE id = $2", [
        monto,
        alumno_id,
      ]);
      await pool.query(
        `INSERT INTO transacciones (alumno_id, monto, tipo, lugar, descripcion)
         VALUES ($1, $2, 'recarga', 'Mercado Pago', $3)`,
        [alumno_id, monto, `MP:${payment_id}`],
      );
      await notificarRecargaMP(req.padre.id, alumno_id, monto);
    }
    const alumno = await pool.query("SELECT saldo FROM alumnos WHERE id = $1", [
      alumno_id,
    ]);
    res.json({ status: "approved", saldo: alumno.rows[0].saldo });
  } catch (err) {
    res.status(500).json({ error: "Error al verificar pago" });
  }
};

// Historial de recargas (con estados pendiente/acreditado/rechazado) para el padre logueado
const getHistorialPagos = async (req, res) => {
  const padreId = req.padre.id;
  try {
    const result = await pool.query(
      `SELECT p.id, p.monto, p.estado, p.detalle, p.creado_en, p.actualizado_en,
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

module.exports = { crearPreferencia, procesarPago, webhook, verificarPago, getHistorialPagos };
