/**
 * Cambio de nombre de la aplicación: EduWallet → EduPass en los datos
 * guardados (nombre y código del colegio, configuración, movimientos y
 * auditoría viejos que lo mencionan).
 *
 * Idempotente. Corre sola al iniciar el servidor (src/index.js); también
 * se puede ejecutar a mano con: node src/db/migracion_nombre_edupass.js
 */

const pool = require('./conexion');

const migrarNombreEdupass = async () => {
  await pool.query(`
    UPDATE colegios SET nombre = replace(nombre, 'EduWallet', 'EduPass') WHERE nombre LIKE '%EduWallet%';
    UPDATE colegios SET slug = 'edupass'
      WHERE slug = 'eduwallet' AND NOT EXISTS (SELECT 1 FROM colegios WHERE slug = 'edupass');
    UPDATE configuracion SET nombre_colegio = replace(nombre_colegio, 'EduWallet', 'EduPass') WHERE nombre_colegio LIKE '%EduWallet%';
    UPDATE transacciones SET lugar = replace(lugar, 'EduWallet', 'EduPass') WHERE lugar LIKE '%EduWallet%';
    UPDATE auditoria SET accion = replace(accion, 'EduWallet', 'EduPass') WHERE accion LIKE '%EduWallet%';
  `);
  console.log('✅ Nombre EduPass verificado en los datos');
};

if (require.main === module) {
  migrarNombreEdupass()
    .catch(err => { console.error('❌ Error en migración:', err.message); process.exitCode = 1; })
    .finally(() => pool.end());
}

module.exports = { migrarNombreEdupass };
