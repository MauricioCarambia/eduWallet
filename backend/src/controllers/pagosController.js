const { MercadoPagoConfig, Preference, Payment } = require("mercadopago");
const pool = require("../db/conexion");
require("dotenv").config();

const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN,
});

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
        external_reference: `${padreId}_${alumno_id}_${monto}_${Date.now()}`,
        notification_url: `${process.env.BACKEND_URL}/api/pagos/webhook`,
      }
    });

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
        external_reference: `${padreId}_${alumno_id}_${monto}_${Date.now()}`,
        notification_url: `${process.env.BACKEND_URL}/api/pagos/webhook`,
      }
    });

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
      return res.json({ status: 'approved', saldo: alumno.rows[0].saldo, payment_id: result.id });
    }

    if (result.status === 'in_process') return res.json({ status: 'pending' });
    res.json({ status: result.status, detail: result.status_detail });
  } catch (err) {
    console.error('Error procesarPago:', err);
    res.status(500).json({ error: 'Error al procesar el pago' });
  }
};

const webhook = async (req, res) => {
  const { type, data } = req.body;
  if (type !== "payment") return res.sendStatus(200);
  try {
    const payment = new Payment(client);
    const pagoData = await payment.get({ id: data.id });
    if (pagoData.status !== "approved") return res.sendStatus(200);
    const ref = pagoData.external_reference;
    const [padreId, alumnoId, monto] = ref.split("_");
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
    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
};

const verificarPago = async (req, res) => {
  const { payment_id, alumno_id, monto } = req.query;
  const padreId = req.padre.id;
  try {
    const payment = new Payment(client);
    const pagoData = await payment.get({ id: payment_id });
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
    }
    const alumno = await pool.query("SELECT saldo FROM alumnos WHERE id = $1", [
      alumno_id,
    ]);
    res.json({ status: "approved", saldo: alumno.rows[0].saldo });
  } catch (err) {
    res.status(500).json({ error: "Error al verificar pago" });
  }
};

module.exports = { crearPreferencia, procesarPago, webhook, verificarPago };
