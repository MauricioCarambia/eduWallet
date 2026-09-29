/**
 * Bloqueo por medio de pago: la familia puede bloquear sólo el QR de la
 * credencial o sólo la tarjeta/llavero (ej. se perdió la credencial impresa
 * pero la tarjeta sigue en su lugar). alumnos.activo sigue siendo el
 * bloqueo general de todas las compras.
 *
 * Idempotente. Corre sola al iniciar el servidor (src/index.js); también
 * se puede ejecutar a mano con: node src/db/migracion_bloqueo_medios.js
 */

const pool = require('./conexion');

const migrarBloqueoMedios = async () => {
  await pool.query(`
    ALTER TABLE alumnos ADD COLUMN IF NOT EXISTS qr_bloqueado BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE alumnos ADD COLUMN IF NOT EXISTS tarjeta_bloqueada BOOLEAN NOT NULL DEFAULT false;
  `);
  console.log('✅ Bloqueo por medio de pago verificado');
};

if (require.main === module) {
  migrarBloqueoMedios()
    .catch(err => { console.error('❌ Error en migración:', err.message); process.exitCode = 1; })
    .finally(() => pool.end());
}

module.exports = { migrarBloqueoMedios };
