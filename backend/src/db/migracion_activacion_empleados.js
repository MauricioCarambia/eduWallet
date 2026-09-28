/**
 * Activación de cuentas de empleados: el admin da de alta al empleado sin
 * PIN y el sistema genera un código de un solo uso; el empleado lo usa para
 * elegir su propio PIN. Así el admin nunca conoce el PIN de nadie.
 *
 * - empleados.pin pasa a ser opcional (NULL = cuenta pendiente de activar)
 * - empleados.codigo_activacion (hash) y codigo_activacion_expira
 *
 * Los empleados existentes conservan su PIN. Idempotente. Corre sola al
 * iniciar el servidor (src/index.js); también se puede ejecutar a mano con:
 * node src/db/migracion_activacion_empleados.js
 */

const pool = require('./conexion');

const migrarActivacionEmpleados = async () => {
  await pool.query(`
    ALTER TABLE empleados ALTER COLUMN pin DROP NOT NULL;
    ALTER TABLE empleados ADD COLUMN IF NOT EXISTS codigo_activacion VARCHAR(100);
    ALTER TABLE empleados ADD COLUMN IF NOT EXISTS codigo_activacion_expira TIMESTAMP;
  `);
  console.log('✅ Activación de cuentas de empleados verificado');
};

if (require.main === module) {
  migrarActivacionEmpleados()
    .catch(err => { console.error('❌ Error en migración:', err.message); process.exitCode = 1; })
    .finally(() => pool.end());
}

module.exports = { migrarActivacionEmpleados };
