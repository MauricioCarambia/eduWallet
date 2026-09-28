/**
 * Segundo contacto (padre / madre) en la ficha del alumno. El primero
 * sigue siendo alumnos.tutor / alumnos.tutor_tel.
 *
 * Idempotente. Corre sola al iniciar el servidor (src/index.js); también
 * se puede ejecutar a mano con: node src/db/migracion_contacto2.js
 */

const pool = require('./conexion');

const migrarContacto2 = async () => {
  await pool.query(`
    ALTER TABLE alumnos ADD COLUMN IF NOT EXISTS contacto2 VARCHAR(100);
    ALTER TABLE alumnos ADD COLUMN IF NOT EXISTS contacto2_tel VARCHAR(50);
  `);
  console.log('✅ Segundo contacto en alumnos verificado');
};

if (require.main === module) {
  migrarContacto2()
    .catch(err => { console.error('❌ Error en migración:', err.message); process.exitCode = 1; })
    .finally(() => pool.end());
}

module.exports = { migrarContacto2 };
