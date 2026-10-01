/**
 * Modo offline del POS:
 * - transacciones.id_venta: número único que el POS le pone a cada venta. Si la
 *   misma venta llega dos veces (se cortó internet a mitad del cobro y después
 *   se sincronizó), se toma una sola vez.
 * - transacciones.offline: la venta se hizo sin internet y se sincronizó después.
 * - transacciones.sincronizada_en: cuándo llegó al servidor (fecha = cuándo se vendió).
 * - configuracion.tope_offline: cuánto puede gastar un alumno por día con la
 *   caja sin internet (aunque tenga más saldo).
 * - cajas.id_local: número que le pone el POS a una caja abierta sin internet;
 *   al sincronizar se crea una sola vez y las ventas hechas en ella la encuentran.
 * - dispositivos_pos: cada equipo del POS avisa cada pocos minutos que está
 *   conectado y cuántas ventas tiene sin subir (el admin ve los que no avisan).
 *
 * Idempotente. Corre sola al iniciar el servidor (src/index.js); también
 * se puede ejecutar a mano con: node src/db/migracion_offline.js
 */

const pool = require('./conexion');

const migrarOffline = async () => {
  await pool.query(`
    ALTER TABLE transacciones ADD COLUMN IF NOT EXISTS id_venta VARCHAR(64);
    ALTER TABLE transacciones ADD COLUMN IF NOT EXISTS offline BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE transacciones ADD COLUMN IF NOT EXISTS sincronizada_en TIMESTAMP;
    CREATE UNIQUE INDEX IF NOT EXISTS uq_transacciones_id_venta
      ON transacciones (colegio_id, id_venta) WHERE id_venta IS NOT NULL;
    ALTER TABLE configuracion ADD COLUMN IF NOT EXISTS tope_offline NUMERIC(12,2) NOT NULL DEFAULT 5000;
    ALTER TABLE cajas ADD COLUMN IF NOT EXISTS id_local VARCHAR(64);
    CREATE UNIQUE INDEX IF NOT EXISTS uq_cajas_id_local ON cajas (colegio_id, id_local) WHERE id_local IS NOT NULL;
    CREATE TABLE IF NOT EXISTS dispositivos_pos (
      id VARCHAR(64) NOT NULL,
      colegio_id INTEGER NOT NULL,
      empleado_id INTEGER,
      local VARCHAR(100),
      equipo VARCHAR(80),
      pendientes INTEGER NOT NULL DEFAULT 0,
      con_error INTEGER NOT NULL DEFAULT 0,
      pendientes_desde TIMESTAMP,
      ultimo_contacto TIMESTAMP NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
      PRIMARY KEY (colegio_id, id)
    );
  `);
  console.log('✅ Modo offline verificado');
};

if (require.main === module) {
  migrarOffline()
    .catch(err => { console.error('❌ Error en migración:', err.message); process.exitCode = 1; })
    .finally(() => pool.end());
}

module.exports = { migrarOffline };
