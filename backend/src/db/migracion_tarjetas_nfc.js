/**
 * Tarjetas NFC de los alumnos: alumnos.nfc_uid es el UID tal como se
 * muestra, y alumnos.nfc_claves todas sus variantes (hex, bytes invertidos,
 * decimal) para reconocer la tarjeta con cualquier tipo de lector (ver
 * services/tarjetasService.js).
 *
 * Idempotente. Corre sola al iniciar el servidor (src/index.js); también
 * se puede ejecutar a mano con: node src/db/migracion_tarjetas_nfc.js
 */

const pool = require('./conexion');

const migrarTarjetasNfc = async () => {
  await pool.query(`
    ALTER TABLE alumnos ADD COLUMN IF NOT EXISTS nfc_uid VARCHAR(40);
    ALTER TABLE alumnos ADD COLUMN IF NOT EXISTS nfc_claves TEXT[];
    CREATE INDEX IF NOT EXISTS idx_alumnos_nfc_claves ON alumnos USING GIN (nfc_claves);
  `);
  console.log('✅ Tarjetas NFC en alumnos verificado');
};

if (require.main === module) {
  migrarTarjetasNfc()
    .catch(err => { console.error('❌ Error en migración:', err.message); process.exitCode = 1; })
    .finally(() => pool.end());
}

module.exports = { migrarTarjetasNfc };
