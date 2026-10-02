const pool = require('../db/conexion');
const { enviarMensajeAdmin } = require('../services/emailService');

const enviarMensaje = async (req, res) => {
  const { asunto, mensaje, destinatarios, todos } = req.body;

  if (!asunto || !mensaje) {
    return res.status(400).json({ error: 'Asunto y mensaje son requeridos' });
  }
  if (String(asunto).length > 200 || String(mensaje).length > 10000) {
    return res.status(400).json({ error: 'El asunto o el mensaje son demasiado largos' });
  }

  try {
    // Solo familias del colegio (las mismas que lista Padres): antes se mandaba
    // a cualquier email que llegara en el pedido
    const familias = await pool.query(
      `SELECT DISTINCT lower(p.email) AS email FROM padres_colegios pc JOIN padres p ON p.id = pc.padre_id
       WHERE pc.colegio_id = $1 AND p.activo = true AND p.email IS NOT NULL`,
      [req.empleado.colegio_id]
    );
    const delColegio = familias.rows.map(r => r.email);
    const pedidos = new Set((Array.isArray(destinatarios) ? destinatarios : []).map(e => String(e).trim().toLowerCase()));
    const emails = todos ? delColegio : delColegio.filter(e => pedidos.has(e));

    if (emails.length === 0) {
      return res.status(400).json({ error: 'No hay destinatarios' });
    }

    const resultado = await enviarMensajeAdmin({ colegioId: req.empleado.colegio_id, asunto: String(asunto), mensaje: String(mensaje), destinatarios: emails });
    if (resultado.enviados === 0) {
      return res.status(502).json({ error: `No se pudo enviar el mensaje${resultado.motivo ? `: ${resultado.motivo}` : ''}`, ...resultado });
    }
    res.json({
      mensaje: resultado.errores
        ? `Enviado a ${resultado.enviados} de ${emails.length} familias. ${resultado.errores} no se pudieron enviar${resultado.motivo ? ` (${resultado.motivo})` : ''}.`
        : `Enviado a ${resultado.enviados} familia${resultado.enviados > 1 ? 's' : ''}`,
      ...resultado,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al enviar mensajes' });
  }
};

module.exports = { enviarMensaje };