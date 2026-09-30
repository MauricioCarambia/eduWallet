/**
 * Cambio de nombre de la aplicación: EduWallet / EduPass → KoleTap en los
 * datos guardados (nombre y código del colegio, configuración, movimientos y
 * auditoría viejos que lo mencionan).
 *
 * Idempotente. Corre sola al iniciar el servidor (src/index.js); también
 * se puede ejecutar a mano con: node src/db/migracion_nombre_koletap.js
 */

const pool = require('./conexion');

const migrarNombreKoletap = async () => {
  await pool.query(`
    UPDATE colegios SET nombre = regexp_replace(nombre, 'EduWallet|EduPass', 'KoleTap', 'g') WHERE nombre ~ 'EduWallet|EduPass';
    UPDATE colegios SET slug = 'koletap'
      WHERE slug IN ('eduwallet', 'edupass') AND NOT EXISTS (SELECT 1 FROM colegios WHERE slug = 'koletap');
    UPDATE configuracion SET nombre_colegio = regexp_replace(nombre_colegio, 'EduWallet|EduPass', 'KoleTap', 'g') WHERE nombre_colegio ~ 'EduWallet|EduPass';
    UPDATE transacciones SET lugar = regexp_replace(lugar, 'EduWallet|EduPass', 'KoleTap', 'g') WHERE lugar ~ 'EduWallet|EduPass';
    UPDATE auditoria SET accion = regexp_replace(accion, 'EduWallet|EduPass', 'KoleTap', 'g') WHERE accion ~ 'EduWallet|EduPass';
  `);
  console.log('✅ Nombre KoleTap verificado en los datos');
};

if (require.main === module) {
  migrarNombreKoletap()
    .catch(err => { console.error('❌ Error en migración:', err.message); process.exitCode = 1; })
    .finally(() => pool.end());
}

module.exports = { migrarNombreKoletap };
