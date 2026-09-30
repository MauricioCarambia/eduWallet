const cron = require('node-cron');
const { cierreDiario, ZONA } = require('./services/tareasDiarias');

let tareasInicializadas = false;

// Estas tareas corren sólo si el servidor está despierto a esa hora. Como en
// Render se duerme cuando no se usa, el cierre diario también lo hace el
// primer pedido de cada día (middleware alDia en app.js), y una tabla evita
// que se haga dos veces. Los horarios son de Argentina.
if (!tareasInicializadas) {
  tareasInicializadas = true;

  // Medianoche: cerrar cajas del día anterior, gasto diario en 0 y, en
  // segundo plano, backups, renovación de tokens de MP y conciliación
  cron.schedule('0 0 * * *', async () => {
    try {
      await cierreDiario();
    } catch (err) {
      console.error('Error en el cierre diario:', err.message);
    }
  }, { timezone: ZONA });

  // Vencer intentos de recarga que nunca se pagaron (más de 24 h) — cada hora
  cron.schedule('0 * * * *', async () => {
    try {
      const { vencerPagosPendientes } = require('./controllers/pagosController');
      const n = await vencerPagosPendientes();
      if (n > 0) console.log(`${n} recarga(s) sin pagar marcadas como vencidas`);
    } catch (err) {
      console.error('Error venciendo recargas pendientes:', err.message);
    }
  }, { timezone: ZONA });

  console.log('Tareas programadas activas');
}
