/**
 * Consultas que llegan desde el formulario de la página de EduWallet.
 * Se guardan siempre, aunque falle el aviso por email.
 *
 * Idempotente. Corre sola al iniciar el servidor (src/index.js); también
 * se puede ejecutar a mano con: node src/db/migracion_contactos.js
 */

const pool = require('./conexion');

const migrarContactos = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS contactos (
      id          SERIAL PRIMARY KEY,
      nombre      VARCHAR(100) NOT NULL,
      colegio     VARCHAR(150) NOT NULL,
      cargo       VARCHAR(60),
      email       VARCHAR(150),
      telefono    VARCHAR(40),
      alumnos     VARCHAR(30),
      mensaje     TEXT,
      ip          VARCHAR(64),
      creado_en   TIMESTAMP DEFAULT NOW()
    );
  `);
  console.log('✅ Tabla de contactos verificada');
};

if (require.main === module) {
  migrarContactos()
    .catch(err => { console.error('❌ Error en migración:', err.message); process.exitCode = 1; })
    .finally(() => pool.end());
}

module.exports = { migrarContactos };
