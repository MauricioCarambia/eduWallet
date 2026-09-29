/**
 * QR de credencial aleatorio. El formato viejo era "QR-" + la hora de alta
 * (ej. QR-1790467851679): se podía adivinar el QR de otro alumno y pagar con
 * su saldo. Se reemplaza por códigos aleatorios "EW" + 12 caracteres.
 *
 * - regenera sólo los QR con el formato viejo (idempotente: los nuevos no
 *   coinciden con el patrón)
 * - índice único sobre alumnos.qr
 *
 * Corre sola al iniciar el servidor (src/index.js); también se puede
 * ejecutar a mano con: node src/db/migracion_qr_seguro.js
 */

const pool = require('./conexion');
const { nuevoCodigoQr } = require('../services/credencialesService');

const migrarQrSeguro = async () => {
  const viejos = await pool.query(`SELECT id FROM alumnos WHERE qr IS NULL OR qr ~ '^QR-[0-9]{10,}'`);
  for (const { id } of viejos.rows) {
    await pool.query('UPDATE alumnos SET qr = $1 WHERE id = $2', [nuevoCodigoQr(), id]);
  }
  await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS uq_alumnos_qr ON alumnos (qr)');
  console.log(`✅ QR de credenciales seguros verificado${viejos.rows.length ? ` (${viejos.rows.length} regenerados)` : ''}`);
};

if (require.main === module) {
  migrarQrSeguro()
    .catch(err => { console.error('❌ Error en migración:', err.message); process.exitCode = 1; })
    .finally(() => pool.end());
}

module.exports = { migrarQrSeguro };
