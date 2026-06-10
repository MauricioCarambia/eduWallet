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
      { tabla: 'padres',        columna: 'reset_token',        definicion: 'VARCHAR(200)' },
      { tabla: 'padres',        columna: 'reset_token_expiry', definicion: 'TIMESTAMP' },
      { tabla: 'configuracion', columna: 'logo',               definicion: 'TEXT' },
    ];

    for (const { tabla, columna, definicion } of columnas) {
      await client.query(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.tables WHERE table_name = '${tabla}'
          ) AND NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = '${tabla}' AND column_name = '${columna}'
          ) THEN
            ALTER TABLE ${tabla} ADD COLUMN ${columna} ${definicion};
          END IF;
        END $$;
      `);
    }
    console.log('✅ Columnas opcionales verificadas');

    // ─── 6. Tabla configuracion (si no existe) ───────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS configuracion (
        id                SERIAL PRIMARY KEY,
        nombre_colegio    VARCHAR(150) DEFAULT 'EduWallet',
        direccion         VARCHAR(200),
        telefono          VARCHAR(50),
        email_admin       VARCHAR(150),
        email_smtp        VARCHAR(150),
        email_smtp_pass   VARCHAR(200),
        email_smtp_host   VARCHAR(100) DEFAULT 'smtp.gmail.com',
        email_smtp_port   INTEGER DEFAULT 587,
        umbral_saldo_bajo DECIMAL(10,2) DEFAULT 200,
        umbral_stock_bajo INTEGER DEFAULT 3,
        moneda            VARCHAR(10) DEFAULT 'ARS',
        logo              TEXT
      );
    `);
    console.log('✅ Tabla configuracion verificada');

    // ─── 7. Tabla pagos (historial de recargas con estados) ─────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS pagos (
        id                 SERIAL PRIMARY KEY,
        padre_id           INTEGER NOT NULL REFERENCES padres(id)  ON DELETE CASCADE,
        alumno_id          INTEGER NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
        monto              DECIMAL(10,2) NOT NULL CHECK (monto > 0),
        estado             VARCHAR(20) NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'acreditado', 'rechazado')),
        mp_payment_id      VARCHAR(50),
        external_reference VARCHAR(100),
        detalle            VARCHAR(100),
        creado_en          TIMESTAMP DEFAULT NOW(),
        actualizado_en     TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_pagos_padre_id  ON pagos (padre_id);
      CREATE INDEX IF NOT EXISTS idx_pagos_alumno_id ON pagos (alumno_id);
      CREATE INDEX IF NOT EXISTS idx_pagos_estado    ON pagos (estado);
    `);
    console.log('✅ Tabla pagos verificada');

    // ─── 8. Tabla push_subscriptions (notificaciones push PWA) ──────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id        SERIAL PRIMARY KEY,
        padre_id  INTEGER NOT NULL REFERENCES padres(id) ON DELETE CASCADE,
        endpoint  TEXT NOT NULL UNIQUE,
        p256dh    VARCHAR(200) NOT NULL,
        auth      VARCHAR(100) NOT NULL,
        creado_en TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_push_subs_padre_id ON push_subscriptions (padre_id);
    `);
    console.log('✅ Tabla push_subscriptions verificada');

    // ─── 9. Quitar columna "deuda" (no usada) ────────────────────────────────
    await client.query(`
      ALTER TABLE alumnos DROP CONSTRAINT IF EXISTS chk_alumnos_deuda_nn;
      ALTER TABLE alumnos DROP COLUMN IF EXISTS deuda;
    `);
    console.log('✅ Columna deuda eliminada (no se usaba)');

    // ─── 10. Código de vinculación padre-alumno ──────────────────────────────
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'alumnos' AND column_name = 'codigo_vinculacion'
        ) THEN
          ALTER TABLE alumnos ADD COLUMN codigo_vinculacion VARCHAR(10) UNIQUE;
        END IF;
      END $$;
    `);
    const sinCodigo = await client.query(`SELECT id FROM alumnos WHERE codigo_vinculacion IS NULL`);
    const generarCodigo = () => Math.random().toString(36).slice(2, 10).toUpperCase();
    for (const { id } of sinCodigo.rows) {
      let codigo;
      let asignado = false;
      while (!asignado) {
        codigo = generarCodigo();
        try {
          await client.query('UPDATE alumnos SET codigo_vinculacion = $1 WHERE id = $2', [codigo, id]);
          asignado = true;
        } catch (err) {
          if (err.code !== '23505') throw err; // colisión de UNIQUE, reintentar
        }
      }
    }
    console.log('✅ Códigos de vinculación generados');

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
