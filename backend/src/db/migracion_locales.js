/**
 * Agrega la tabla `locales` para que cada colegio defina sus propias zonas
 * de venta (Kiosco, Librería, Comedor, Fotocopiadora, etc.) en vez de tener
 * "Kiosco"/"Librería" hardcodeado en el frontend.
 *
 * Idempotente. Ejecutar con: node src/db/migracion_locales.js
 */

const pool = require('./conexion');

const migrar = async () => {
  const client = await pool.connect();
  try {
    console.log('🔄 Creando tabla locales...\n');

    await client.query(`
      CREATE TABLE IF NOT EXISTS locales (
        id         SERIAL PRIMARY KEY,
        colegio_id INTEGER NOT NULL REFERENCES colegios(id),
        nombre     VARCHAR(50) NOT NULL,
        activo     BOOLEAN DEFAULT true,
        creado_en  TIMESTAMP DEFAULT NOW(),
        UNIQUE (colegio_id, nombre)
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_locales_colegio_id ON locales (colegio_id)`);
    console.log('✅ Tabla locales creada');

    // Para cada colegio: si no tiene locales, los deriva de los que ya
    // usaban sus productos/cajas, o crea Kiosco/Librería por defecto.
    const colegios = await client.query('SELECT id FROM colegios');
    for (const { id: colegioId } of colegios.rows) {
      const existentes = await client.query('SELECT id FROM locales WHERE colegio_id = $1', [colegioId]);
      if (existentes.rows.length > 0) continue;

      const usados = await client.query(
        `SELECT DISTINCT local FROM productos WHERE colegio_id = $1 AND local IS NOT NULL
         UNION
         SELECT DISTINCT local FROM cajas WHERE colegio_id = $1 AND local IS NOT NULL`,
        [colegioId]
      );

      const nombres = usados.rows.map(r => r.local).filter(Boolean);
      const aCrear = nombres.length > 0 ? nombres : ['Kiosco', 'Librería'];

      for (const nombre of aCrear) {
        await client.query(
          'INSERT INTO locales (colegio_id, nombre) VALUES ($1, $2) ON CONFLICT (colegio_id, nombre) DO NOTHING',
          [colegioId, nombre]
        );
      }
      console.log(`✅ Colegio ${colegioId}: locales creados (${aCrear.join(', ')})`);
    }

    console.log('\n✅ Migración de locales completada.');
  } catch (err) {
    console.error('\n❌ Error en migración:', err.message);
    process.exit(1);
  } finally {
    client.release();
    process.exit(0);
  }
};

migrar();
