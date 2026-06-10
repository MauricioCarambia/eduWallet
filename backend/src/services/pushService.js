const webpush = require('web-push');
const pool = require('../db/conexion');
require('dotenv').config();

const PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@eduwallet.com';

const habilitado = Boolean(PUBLIC_KEY && PRIVATE_KEY);

if (habilitado) {
  webpush.setVapidDetails(SUBJECT, PUBLIC_KEY, PRIVATE_KEY);
} else {
  console.log('⚠ Notificaciones push deshabilitadas: faltan VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY');
}

// Envía una notificación push a todas las suscripciones de un padre.
// payload: { title, body, url }
const enviarPush = async (padreId, payload) => {
  if (!habilitado) return;
  try {
    const subs = await pool.query(
      'SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE padre_id = $1',
      [padreId]
    );

    for (const sub of subs.rows) {
      const subscription = {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth }
      };
      try {
        await webpush.sendNotification(subscription, JSON.stringify(payload));
      } catch (err) {
        // 404/410 = la suscripción ya no es válida, la borramos
        if (err.statusCode === 404 || err.statusCode === 410) {
          await pool.query('DELETE FROM push_subscriptions WHERE id = $1', [sub.id]);
        } else {
          console.error('Error enviando push:', err.message);
        }
      }
    }
  } catch (err) {
    console.error('Error en enviarPush:', err.message);
  }
};

module.exports = { enviarPush, habilitado, PUBLIC_KEY };
