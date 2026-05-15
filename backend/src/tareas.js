const cron = require('node-cron');
const pool = require('./db/conexion');

// Se ejecuta todos los días a medianoche
cron.schedule('0 0 * * *', async () => {
  try {
    await pool.query('UPDATE alumnos SET gasto_hoy = 0');
    console.log('Gasto diario reseteado correctamente');
  } catch (err) {
    console.error('Error al resetear gasto diario:', err);
  }
});

// Se ejecuta todos los días a medianoche
cron.schedule('0 0 * * *', async () => {
  try {
    await pool.query(`
      UPDATE cajas SET abierta = false, cierre = NOW()
      WHERE abierta = true
    `);
    console.log('Cajas abiertas cerradas automáticamente');
  } catch (err) {
    console.error('Error al cerrar cajas:', err);
  }
});

cron.schedule('0 3 * * *', async () => {
  try {
    await hacerBackup(true) // true = enviar por email
    console.log('Backup diario completado y enviado por email')
  } catch (err) {
    console.error('Error en backup diario:', err.message)
  }
})
console.log('Tareas programadas activas');