const pool = require('../db/conexion');
const { PUBLIC_KEY, habilitado } = require('../services/pushService');

const getClavePublica = (req, res) => {
  if (!habilitado) return res.status(503).json({ error: 'Notificaciones push no configuradas' });
  res.json({ publicKey: PUBLIC_KEY });
};

const suscribir = async (req, res) => {
  const padreId = req.padre.id;
  const { endpoint, keys } = req.body;
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return res.status(400).json({ error: 'Suscripción inválida' });
  }
  try {
    await pool.query(
      `INSERT INTO push_subscriptions (padre_id, endpoint, p256dh, auth)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (endpoint) DO UPDATE SET padre_id = $1, p256dh = $3, auth = $4`,
      [padreId, endpoint, keys.p256dh, keys.auth]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('Error suscribir push:', err.message);
    res.status(500).json({ error: 'Error al guardar la suscripción' });
  }
};

const desuscribir = async (req, res) => {
  const padreId = req.padre.id;
  const { endpoint } = req.body;
  try {
    if (endpoint) {
      await pool.query('DELETE FROM push_subscriptions WHERE padre_id = $1 AND endpoint = $2', [padreId, endpoint]);
    } else {
      await pool.query('DELETE FROM push_subscriptions WHERE padre_id = $1', [padreId]);
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar la suscripción' });
  }
};

module.exports = { getClavePublica, suscribir, desuscribir };
