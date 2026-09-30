/**
 * Columnas del correo propio del colegio en configuracion. La base de producción
 * se creó sin ellas y el guardado de Configuración (incluido el logo) fallaba.
 *
 * Idempotente. Corre sola al iniciar el servidor (src/index.js); también
 * se puede ejecutar a mano con: node src/db/migracion_config_email.js
 */

const pool = require('./conexion');

const migrarConfigEmail = async () => {
  await pool.query(`
    ALTER TABLE configuracion ADD COLUMN IF NOT EXISTS email_smtp VARCHAR(150);
    ALTER TABLE configuracion ADD COLUMN IF NOT EXISTS email_smtp_pass VARCHAR(200);
    ALTER TABLE configuracion ADD COLUMN IF NOT EXISTS email_smtp_host VARCHAR(100) DEFAULT 'smtp.gmail.com';
    ALTER TABLE configuracion ADD COLUMN IF NOT EXISTS email_smtp_port INTEGER DEFAULT 587;
  `);
  console.log('✅ Columnas de correo en configuración verificadas');
};

if (require.main === module) {
  migrarConfigEmail()
    .catch(err => { console.error('❌ Error en migración:', err.message); process.exitCode = 1; })
    .finally(() => pool.end());
}

module.exports = { migrarConfigEmail };
