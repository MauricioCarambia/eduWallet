/**
 * Nuevo estado 'vencido' para los intentos de recarga que nunca se pagaron
 * (el padre abrió el checkout de Mercado Pago y lo abandonó). Los marca
 * una tarea programada en src/tareas.js.
 *
 * Idempotente. Corre sola al iniciar el servidor (src/index.js); también
 * se puede ejecutar a mano con: node src/db/migracion_pagos_vencidos.js
 */

const pool = require('./conexion');

const migrarPagosVencidos = async () => {
  await pool.query(`
    ALTER TABLE pagos DROP CONSTRAINT IF EXISTS pagos_estado_check;
    ALTER TABLE pagos ADD CONSTRAINT pagos_estado_check
      CHECK (estado IN ('pendiente', 'acreditado', 'rechazado', 'vencido'));
  `);
  console.log('✅ Estado "vencido" en pagos verificado');
};

if (require.main === module) {
  migrarPagosVencidos()
    .catch(err => { console.error('❌ Error en migración:', err.message); process.exitCode = 1; })
    .finally(() => pool.end());
}

module.exports = { migrarPagosVencidos };
