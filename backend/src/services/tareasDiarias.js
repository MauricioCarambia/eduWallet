// Tareas de cada día (hora de Argentina) que no pueden depender de que el
// servidor esté despierto a la medianoche: en Render el servidor se duerme
// cuando no se usa y un cron en memoria no corre. Por eso el cierre diario lo
// hace el primer pedido del día (o el cron, si el servidor está despierto):
//   - cierra las cajas abiertas en días anteriores
//   - pone en 0 el gasto del día de los alumnos
// y después, en segundo plano, los backups, la conciliación con Mercado Pago,
// la renovación de tokens y las liquidaciones automáticas de las zonas. La tabla tareas_estado asegura que se haga una
// sola vez por día aunque lleguen varios pedidos juntos o haya varios servidores.
const pool = require('../db/conexion');

const ZONA = 'America/Argentina/Buenos_Aires';
const hoyAR = () => new Intl.DateTimeFormat('en-CA', { timeZone: ZONA }).format(new Date()); // AAAA-MM-DD

const cerrarCajasDeDiasAnteriores = () =>
  pool.query(
    `UPDATE cajas SET abierta = false, cierre = NOW()
     WHERE abierta = true
       AND (apertura AT TIME ZONE 'UTC' AT TIME ZONE '${ZONA}')::date < (NOW() AT TIME ZONE '${ZONA}')::date`
  );

// Tareas largas del día: no bloquean el pedido que las disparó
const tareasEnSegundoPlano = () => {
  setImmediate(async () => {
    try {
      const { hacerBackup } = require('./backupService');
      const colegios = await pool.query('SELECT id FROM colegios WHERE activo = true');
      for (const { id } of colegios.rows) {
        await hacerBackup(id, true).catch(err => console.error(`Error en backup diario del colegio ${id}:`, err.message));
      }
    } catch (err) { console.error('Error en backups diarios:', err.message); }
    try {
      const { renovarTokensPorVencer } = require('./mercadoPagoService');
      await renovarTokensPorVencer();
    } catch (err) { console.error('Error renovando tokens de Mercado Pago:', err.message); }
    try {
      const { conciliarTodos } = require('../controllers/conciliacionController');
      await conciliarTodos();
    } catch (err) { console.error('Error en la conciliación diaria:', err.message); }
    try {
      const { liquidarAutomaticas } = require('../controllers/liquidacionesController');
      await liquidarAutomaticas();
    } catch (err) { console.error('Error en las liquidaciones automáticas:', err.message); }
  });
};

// Hace el cierre del día si todavía no se hizo. Devuelve true si lo hizo este llamado.
const cierreDiario = async () => {
  const dia = hoyAR();
  const r = await pool.query(
    `INSERT INTO tareas_estado (clave, dia, actualizado) VALUES ('cierre_diario', $1, NOW())
     ON CONFLICT (clave) DO UPDATE SET dia = EXCLUDED.dia, actualizado = NOW()
       WHERE tareas_estado.dia < EXCLUDED.dia
     RETURNING clave`,
    [dia]
  );
  if (r.rows.length === 0) return false; // ya lo hizo otro pedido (u otro servidor)

  const cajas = await cerrarCajasDeDiasAnteriores();
  await pool.query('UPDATE alumnos SET gasto_hoy = 0 WHERE gasto_hoy <> 0');
  console.log(`Cierre diario ${dia}: ${cajas.rowCount} caja(s) cerrada(s) y gasto diario en 0`);
  tareasEnSegundoPlano();
  return true;
};

// Vencer recargas sin pagar: como mucho una vez por hora
let ultimoVencimiento = 0;
const vencerSiHaceFalta = () => {
  if (Date.now() - ultimoVencimiento < 60 * 60 * 1000) return;
  ultimoVencimiento = Date.now();
  setImmediate(async () => {
    try {
      const { vencerPagosPendientes } = require('../controllers/pagosController');
      const n = await vencerPagosPendientes();
      if (n > 0) console.log(`${n} recarga(s) sin pagar marcadas como vencidas`);
    } catch (err) { console.error('Error venciendo recargas pendientes:', err.message); }
  });
};

// Middleware: antes de atender el primer pedido del día, deja el día al día
let diaListo = null;
let enCurso = null;
const alDia = async (req, res, next) => {
  try {
    vencerSiHaceFalta();
    const dia = hoyAR();
    if (diaListo !== dia) {
      enCurso = enCurso || cierreDiario().finally(() => { enCurso = null; });
      await enCurso;
      diaListo = dia;
    }
  } catch (err) {
    console.error('Error en el cierre diario:', err.message);
  }
  next();
};

module.exports = { alDia, cierreDiario, cerrarCajasDeDiasAnteriores, hoyAR, ZONA };
