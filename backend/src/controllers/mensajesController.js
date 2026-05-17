const pool = require('../db/conexion');
const { enviarMensajeAdmin } = require('../services/emailService');

const enviarMensaje = async (req, res) => {
  const { asunto, mensaje, destinatarios, todos } = req.body;

  if (!asunto || !mensaje) {
    return res.status(400).json({ error: 'Asunto y mensaje son requeridos' });
  }

  try {
    let emails = [];

    if (todos) {
      const res2 = await pool.query('SELECT email FROM padres WHERE activo = true');
      emails = res2.rows.map(r => r.email);
    } else {
      emails = destinatarios || [];
    }

    if (emails.length === 0) {
      return res.status(400).json({ error: 'No hay destinatarios' });
    }

    const resultado = await enviarMensajeAdmin({ asunto, mensaje, destinatarios: emails });
    res.json({ mensaje: `Enviado a ${resultado.enviados} padres`, ...resultado });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al enviar mensajes' });
  }
};

module.exports = { enviarMensaje };