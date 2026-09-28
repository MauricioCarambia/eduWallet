const cron = require('node-cron');
const pool = require('./db/conexion');

let tareasInicializadas = false;

if (!tareasInicializadas) {
  tareasInicializadas = true;

  // Reset gasto diario a medianoche
  cron.schedule('0 0 * * *', async () => {
    try {
      await pool.query('UPDATE alumnos SET gasto_hoy = 0');
      console.log('Gasto diario reseteado correctamente');
    } catch (err) {
      console.error('Error al resetear gasto diario:', err.message);
    }
  });

  // Cerrar cajas abiertas a medianoche
  cron.schedule('0 0 * * *', async () => {
    try {
      await pool.query(`UPDATE cajas SET abierta = false, cierre = NOW() WHERE abierta = true`);
      console.log('Cajas cerradas automáticamente');
    } catch (err) {
      console.error('Error al cerrar cajas:', err.message);
    }
  });

  // Backup diario a las 3am — uno por cada colegio activo
  cron.schedule('0 3 * * *', async () => {
    try {
      const { hacerBackup } = require('./services/backupService');
      const colegios = await pool.query('SELECT id FROM colegios WHERE activo = true');
      for (const { id } of colegios.rows) {
        try {
          await hacerBackup(id, true);
        } catch (err) {
          console.error(`Error en backup diario del colegio ${id}:`, err.message);
        }
      }
      console.log(`Backup diario completado (${colegios.rows.length} colegios)`);
    } catch (err) {
      console.error('Error en backup diario:', err.message);
    }
  });

  // Vencer intentos de recarga que nunca se pagaron (más de 24 h) — cada hora
  cron.schedule('0 * * * *', async () => {
    try {
      const { vencerPagosPendientes } = require('./controllers/pagosController');
      const n = await vencerPagosPendientes();
      if (n > 0) console.log(`${n} recarga(s) sin pagar marcadas como vencidas`);
    } catch (err) {
      console.error('Error venciendo recargas pendientes:', err.message);
    }
  });

  // Renovar tokens de Mercado Pago (OAuth) que vencen pronto — 4am
  cron.schedule('0 4 * * *', async () => {
    try {
      const { renovarTokensPorVencer } = require('./services/mercadoPagoService');
      await renovarTokensPorVencer();
    } catch (err) {
      console.error('Error renovando tokens de Mercado Pago:', err.message);
    }
  });

  console.log('Tareas programadas activas');
}