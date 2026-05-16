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

  // Backup diario a las 3am
  cron.schedule('0 3 * * *', async () => {
    try {
      const { hacerBackup } = require('./services/backupService');
      await hacerBackup(true);
      console.log('Backup diario completado');
    } catch (err) {
      console.error('Error en backup diario:', err.message);
    }
  });

  console.log('Tareas programadas activas');
}