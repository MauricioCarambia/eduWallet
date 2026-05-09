const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');
const pool = require('../db/conexion');
require('dotenv').config();

const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN
});

const crearPreferencia = async (req, res) => {
  const { monto, alumno_id } = req.body;
  const padreId = req.padre.id;
  try {
    const padreRes = await pool.query('SELECT * FROM padres WHERE id = $1', [padreId]);
    const alumnoRes = await pool.query('SELECT * FROM alumnos WHERE id = $1', [alumno_id]);
    if (alumnoRes.rows.length === 0) return res.status(404).json({ error: 'Alumno no encontrado' });

    const padre = padreRes.rows[0];
    const alumno = alumnoRes.rows[0];

    const preference = new Preference(client);
const result = await payment.create({
  body: {
    transaction_amount: Number(monto),
    token,
    description: `Recarga EduWallet alumno ${alumno_id}`,
    installments: Number(installments),
    payment_method_id,
    issuer_id,
    payer: { email },
    external_reference: `${padreId}_${alumno_id}_${monto}_${Date.now()}`,
    notification_url: `https://eduwallet-production.up.railway.app/api/pagos/webhook`,
  }
});

    res.json({
      preference_id: result.id,
      public_key: process.env.MP_PUBLIC_KEY
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear preferencia de pago' });
  }
};

const procesarPago = async (req, res) => {
   console.log('Body recibido:', JSON.stringify(req.body, null, 2));
  const { token, payment_method_id, issuer_id, installments, monto, alumno_id, email } = req.body;
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
        installments: Number(installments),
        payment_method_id,
        issuer_id,
        payer: { email },
        external_reference: `${padreId}_${alumno_id}_${monto}_${Date.now()}`,
      notification_url: `https://eduwallet-production.up.railway.app/api/pagos/webhook`,
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

    if (result.status === 'in_process') {
      return res.json({ status: 'pending' });
    }

    res.json({ status: result.status, detail: result.status_detail });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al procesar el pago' });
  }
};

const webhook = async (req, res) => {
  const { type, data } = req.body;
  if (type !== 'payment') return res.sendStatus(200);
  try {
    const payment = new Payment(client);
    const pagoData = await payment.get({ id: data.id });
    if (pagoData.status !== 'approved') return res.sendStatus(200);
    const ref = pagoData.external_reference;
    const [padreId, alumnoId, monto] = ref.split('_');
    const existe = await pool.query(
      'SELECT id FROM transacciones WHERE descripcion = $1',
      [`MP:${data.id}`]
    );
    if (existe.rows.length > 0) return res.sendStatus(200);
    await pool.query('UPDATE alumnos SET saldo = saldo + $1 WHERE id = $2', [monto, alumnoId]);
    await pool.query(
      `INSERT INTO transacciones (alumno_id, monto, tipo, lugar, descripcion)
       VALUES ($1, $2, 'recarga', 'Mercado Pago', $3)`,
      [alumnoId, monto, `MP:${data.id}`]
    );
    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
};

module.exports = { crearPreferencia, procesarPago, webhook };