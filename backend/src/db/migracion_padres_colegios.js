/**
 * Pertenencia padre–colegio. Las cuentas de padres son globales (un padre
 * puede tener hijos en varios colegios); hasta ahora el colegio se deducía
 * de los alumnos vinculados, así que un padre sin alumnos desaparecía del
 * admin y "eliminar padre" borraba la cuenta aunque tuviera hijos en otro
 * colegio.
 *
 * La primera vez que se crea la tabla se completa con los vínculos actuales
 * y con el historial de pagos. Después no se vuelve a completar, para no
 * re-agregar padres que un colegio quitó.
 *
 * Idempotente. Corre sola al iniciar el servidor (src/index.js); también
 * se puede ejecutar a mano con: node src/db/migracion_padres_colegios.js
 */

const pool = require('./conexion');

const migrarPadresColegios = async () => {
  const existe = await pool.query(`SELECT to_regclass('public.padres_colegios') AS tabla`);
  if (existe.rows[0].tabla) return;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`
      CREATE TABLE padres_colegios (
        padre_id   INTEGER NOT NULL REFERENCES padres(id)   ON DELETE CASCADE,
        colegio_id INTEGER NOT NULL REFERENCES colegios(id) ON DELETE CASCADE,
        creado_en  TIMESTAMP DEFAULT NOW(),
        PRIMARY KEY (padre_id, colegio_id)
      );
      CREATE INDEX idx_padres_colegios_colegio ON padres_colegios (colegio_id);
    `);
    const r = await client.query(`
      INSERT INTO padres_colegios (padre_id, colegio_id)
      SELECT pa.padre_id, a.colegio_id FROM padres_alumnos pa JOIN alumnos a ON a.id = pa.alumno_id
      UNION
      SELECT padre_id, colegio_id FROM pagos WHERE padre_id IS NOT NULL
      ON CONFLICT DO NOTHING
    `);
    await client.query('COMMIT');
    console.log(`✅ Tabla padres_colegios creada (${r.rowCount} pertenencias)`);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
};

// Anota al padre como parte del colegio (al vincularlo a un alumno)
const registrarPadreEnColegio = (padreId, colegioId, db = pool) =>
  db.query(
    'INSERT INTO padres_colegios (padre_id, colegio_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [padreId, colegioId]
  );

if (require.main === module) {
  migrarPadresColegios()
    .catch(err => { console.error('❌ Error en migración:', err.message); process.exitCode = 1; })
    .finally(() => pool.end());
}

module.exports = { migrarPadresColegios, registrarPadreEnColegio };
