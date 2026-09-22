/**
 * Migración a multi-tenant (SaaS): agrega la tabla `colegios` y una columna
 * `colegio_id` en cada tabla que antes era global, para que un mismo backend
 * pueda servir a varios colegios de forma aislada.
 *
 * Idempotente: se puede correr varias veces sin romper nada.
 * Ejecutar con: node src/db/migracion_multitenant.js
 */

const pool = require('./conexion');

const slugify = (texto) =>
  texto
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'colegio';

const migrar = async () => {
  const client = await pool.connect();
  try {
    console.log('🔄 Iniciando migración multi-tenant...\n');

    await client.query(`
      CREATE TABLE IF NOT EXISTS colegios (
        id               SERIAL PRIMARY KEY,
        nombre           VARCHAR(150) NOT NULL,
        slug             VARCHAR(80) UNIQUE NOT NULL,
        comision_pct     DECIMAL(5,2) DEFAULT 5,
        plan             VARCHAR(20) DEFAULT 'compartido' CHECK (plan IN ('compartido', 'dedicado')),
        activo           BOOLEAN DEFAULT true,
        mp_access_token  TEXT,
        mp_refresh_token TEXT,
        mp_user_id       VARCHAR(50),
        creado_en        TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ Tabla colegios verificada');

    // ─── Colegio por defecto para los datos que ya existen ───────────────────
    let colegioIdDefault;
    const existente = await client.query('SELECT id FROM colegios ORDER BY id LIMIT 1');
    if (existente.rows.length > 0) {
      colegioIdDefault = existente.rows[0].id;
    } else {
      const configRes = await client.query('SELECT nombre_colegio FROM configuracion LIMIT 1');
      const nombre = configRes.rows[0]?.nombre_colegio?.trim() || 'Mi Colegio';
      let slug = slugify(nombre);
      let sufijo = 0;
      while (true) {
        const slugProbado = sufijo === 0 ? slug : `${slug}-${sufijo}`;
        const choque = await client.query('SELECT id FROM colegios WHERE slug = $1', [slugProbado]);
        if (choque.rows.length === 0) { slug = slugProbado; break; }
        sufijo++;
      }
      const nuevo = await client.query(
        `INSERT INTO colegios (nombre, slug) VALUES ($1, $2) RETURNING id`,
        [nombre, slug]
      );
      colegioIdDefault = nuevo.rows[0].id;
      console.log(`✅ Colegio por defecto creado: "${nombre}" (slug: ${slug})`);
    }

    // ─── Agregar colegio_id a las tablas que antes eran globales ─────────────
    const tablasConColegio = ['empleados', 'alumnos', 'productos', 'transacciones', 'cajas', 'auditoria', 'pagos'];
    for (const tabla of tablasConColegio) {
      await client.query(`ALTER TABLE ${tabla} ADD COLUMN IF NOT EXISTS colegio_id INTEGER REFERENCES colegios(id)`);
      await client.query(`UPDATE ${tabla} SET colegio_id = $1 WHERE colegio_id IS NULL`, [colegioIdDefault]);
      await client.query(`ALTER TABLE ${tabla} ALTER COLUMN colegio_id SET NOT NULL`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_${tabla}_colegio_id ON ${tabla} (colegio_id)`);
    }
    console.log('✅ colegio_id agregado a: ' + tablasConColegio.join(', '));

    // configuracion pasa de singleton a una fila por colegio
    await client.query(`ALTER TABLE configuracion ADD COLUMN IF NOT EXISTS colegio_id INTEGER REFERENCES colegios(id)`);
    await client.query(`UPDATE configuracion SET colegio_id = $1 WHERE colegio_id IS NULL`, [colegioIdDefault]);
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'configuracion_colegio_id_key') THEN
          ALTER TABLE configuracion ADD CONSTRAINT configuracion_colegio_id_key UNIQUE (colegio_id);
        END IF;
      END $$;
    `);
    console.log('✅ configuracion: colegio_id agregado (una fila por colegio)');

    // usuario de empleados: unico por colegio, no global
    await client.query(`ALTER TABLE empleados DROP CONSTRAINT IF EXISTS empleados_usuario_key`);
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'empleados_colegio_usuario_key') THEN
          ALTER TABLE empleados ADD CONSTRAINT empleados_colegio_usuario_key UNIQUE (colegio_id, usuario);
        END IF;
      END $$;
    `);
    console.log('✅ empleados: usuario ahora es único por colegio (no global)');

    console.log(`\n✅ Migración multi-tenant completada. Colegio por defecto: id=${colegioIdDefault}`);
  } catch (err) {
    console.error('\n❌ Error en migración:', err.message);
    process.exit(1);
  } finally {
    client.release();
    process.exit(0);
  }
};

migrar();
