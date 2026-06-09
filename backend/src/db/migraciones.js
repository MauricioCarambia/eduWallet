/**
 * Script de migraciones — se ejecuta una vez sobre una DB existente.
 * Es idempotente: usa bloques DO $$ ... $$ para no fallar si ya existen.
 *
 * Ejecutar con: node src/db/migraciones.js
 */

const pool = require('./conexion');

const migrar = async () => {
  const client = await pool.connect();
  try {
    console.log('🔄 Iniciando migraciones...\n');

    // ─── 1. Tablas faltantes (padres y padres_alumnos) ───────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS padres (
        id         SERIAL PRIMARY KEY,
        nombre     VARCHAR(100) NOT NULL,
        email      VARCHAR(150) UNIQUE NOT NULL,
        password   VARCHAR(200) NOT NULL,
        activo     BOOLEAN DEFAULT true,
        creado_en  TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS padres_alumnos (
        id        SERIAL PRIMARY KEY,
        padre_id  INTEGER NOT NULL REFERENCES padres(id)  ON DELETE CASCADE,
        alumno_id INTEGER NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
        relacion  VARCHAR(50) DEFAULT 'tutor',
        UNIQUE(padre_id, alumno_id)
      );
    `);
    console.log('✅ Tablas padres / padres_alumnos verificadas');

    // ─── 2. CHECK — montos no negativos ──────────────────────────────────────
    const checks = [
      { tabla: 'alumnos',       nombre: 'chk_alumnos_saldo_nn',         expr: 'saldo >= 0' },
      { tabla: 'alumnos',       nombre: 'chk_alumnos_gasto_nn',         expr: 'gasto_hoy >= 0' },
      { tabla: 'alumnos',       nombre: 'chk_alumnos_limite_pos',       expr: 'limite_diario > 0' },
      { tabla: 'alumnos',       nombre: 'chk_alumnos_deuda_nn',         expr: 'deuda >= 0' },
      { tabla: 'productos',     nombre: 'chk_productos_precio_pos',     expr: 'precio > 0' },
      { tabla: 'productos',     nombre: 'chk_productos_stock_nn',       expr: 'stock >= 0' },
      { tabla: 'transacciones', nombre: 'chk_transacciones_monto_pos',  expr: 'monto > 0' },
      { tabla: 'cajas',         nombre: 'chk_cajas_fondo_nn',           expr: 'fondo >= 0' },
      { tabla: 'cajas',         nombre: 'chk_cajas_ventas_nn',          expr: 'ventas >= 0' },
      { tabla: 'cajas',         nombre: 'chk_cajas_tx_count_nn',        expr: 'tx_count >= 0' },
    ];

    for (const { tabla, nombre, expr } of checks) {
      await client.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = '${nombre}'
          ) THEN
            ALTER TABLE ${tabla} ADD CONSTRAINT ${nombre} CHECK (${expr});
          END IF;
        END $$;
      `);
    }
    console.log('✅ Constraints de montos no negativos aplicados');

    // ─── 3. CHECK — valores de enumeración ───────────────────────────────────
    const enums = [
      {
        tabla:  'empleados',
        nombre: 'chk_empleados_rol_valido',
        expr:   "rol IN ('admin', 'staff')"
      },
      {
        tabla:  'transacciones',
        nombre: 'chk_transacciones_tipo_valido',
        expr:   "tipo IN ('compra', 'recarga', 'anulacion', 'ajuste')"
      },
    ];

    for (const { tabla, nombre, expr } of enums) {
      await client.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = '${nombre}'
          ) THEN
            ALTER TABLE ${tabla} ADD CONSTRAINT ${nombre} CHECK (${expr});
          END IF;
        END $$;
      `);
    }
    console.log('✅ Constraints de enumeración aplicados');

    // ─── 4. Índices para consultas frecuentes ─────────────────────────────────
    const indices = [
      { nombre: 'idx_transacciones_alumno_id', tabla: 'transacciones', columna: 'alumno_id' },
      { nombre: 'idx_transacciones_fecha',     tabla: 'transacciones', columna: 'fecha DESC' },
      { nombre: 'idx_transacciones_tipo',      tabla: 'transacciones', columna: 'tipo' },
      { nombre: 'idx_transacciones_lugar',     tabla: 'transacciones', columna: 'lugar' },
      { nombre: 'idx_auditoria_fecha',         tabla: 'auditoria',     columna: 'fecha DESC' },
      { nombre: 'idx_auditoria_empleado_id',   tabla: 'auditoria',     columna: 'empleado_id' },
      { nombre: 'idx_alumnos_activo',          tabla: 'alumnos',       columna: 'activo' },
      { nombre: 'idx_alumnos_curso',           tabla: 'alumnos',       columna: 'curso' },
      { nombre: 'idx_padres_alumnos_padre',    tabla: 'padres_alumnos', columna: 'padre_id' },
      { nombre: 'idx_padres_alumnos_alumno',   tabla: 'padres_alumnos', columna: 'alumno_id' },
    ];

    for (const { nombre, tabla, columna } of indices) {
      await client.query(`
        CREATE INDEX IF NOT EXISTS ${nombre} ON ${tabla} (${columna});
      `);
    }
    console.log('✅ Índices creados');

    // ─── 5. Columnas opcionales / nuevas ─────────────────────────────────────
    const columnas = [
      { tabla: 'alumnos', columna: 'deuda',              definicion: 'DECIMAL(10,2) DEFAULT 0' },
      { tabla: 'padres',  columna: 'reset_token',        definicion: 'VARCHAR(200)' },
      { tabla: 'padres',  columna: 'reset_token_expiry', definicion: 'TIMESTAMP' },
    ];

    for (const { tabla, columna, definicion } of columnas) {
      await client.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = '${tabla}' AND column_name = '${columna}'
          ) THEN
            ALTER TABLE ${tabla} ADD COLUMN ${columna} ${definicion};
          END IF;
        END $$;
      `);
    }
    console.log('✅ Columnas opcionales verificadas');

    console.log('\n✅ Migraciones completadas exitosamente.');
  } catch (err) {
    console.error('\n❌ Error en migración:', err.message);
    process.exit(1);
  } finally {
    client.release();
    process.exit(0);
  }
};

migrar();
