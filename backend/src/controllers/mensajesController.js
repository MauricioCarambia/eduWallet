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
      const res2 = await pool.query(
        `SELECT DISTINCT p.email FROM padres p
         JOIN padres_alumnos pa ON pa.padre_id = p.id
         JOIN alumnos a ON a.id = pa.alumno_id
         WHERE p.activo = true AND a.colegio_id = $1`,
        [req.empleado.colegio_id]
      );
      emails = res2.rows.map(r => r.email);
    } else {
      emails = destinatarios || [];
    }

    if (emails.length === 0) {
      return res.status(400).json({ error: 'No hay destinatarios' });
    }

    const resultado = await enviarMensajeAdmin({ colegioId: req.empleado.colegio_id, asunto, mensaje, destinatarios: emails });
    res.json({ mensaje: `Enviado a ${resultado.enviados} padres`, ...resultado });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al enviar mensajes' });
  }
};

module.exports = { enviarMensaje };