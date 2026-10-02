/**
 * Métricas de la plataforma (panel del superadmin).
 * - transacciones.duracion_ms: cuánto tardó la venta en el POS, desde el
 *   primer producto o el alumno identificado hasta el cobro. Es la base de la
 *   "velocidad del recreo".
 *
 * Idempotente. Corre sola al iniciar el servidor (src/index.js); también
 * se puede ejecutar a mano con: node src/db/migracion_metricas.js
 */

const pool = require('./conexion');

const migrarMetricas = async () => {
  await pool.query(`
    ALTER TABLE transacciones ADD COLUMN IF NOT EXISTS duracion_ms INTEGER;
    CREATE INDEX IF NOT EXISTS ix_transacciones_colegio_fecha ON transacciones (colegio_id, fecha);
  `);
  console.log('✅ Métricas verificadas');
};

if (require.main === module) {
  migrarMetricas()
    .catch(err => { console.error('❌ Error en migración:', err.message); process.exitCode = 1; })
    .finally(() => pool.end());
}

module.exports = { migrarMetricas };
