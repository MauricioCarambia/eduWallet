/**
 * Liquidaciones a concesionarios.
 * La plata de las recargas entra a la cuenta del colegio; cuando una zona la
 * opera un concesionario, el colegio le liquida lo vendido en esa zona menos
 * su canon.
 * - zonas_operador: quién opera cada zona (sin fila = la opera el colegio):
 *   un concesionario o un empleado encargado (tipo, empleado_id), y el canon o
 *   comisión (% que se queda el colegio; con un encargado suele ser 0).
 * - liquidaciones: cada corte, con sus totales y si ya se pagó.
 * - transacciones.liquidacion_id: en qué liquidación entró cada venta o
 *   anulación, así nada se liquida dos veces y lo que se sube tarde (ventas
 *   sin conexión) o se anula después entra en la próxima.
 *
 * Idempotente. Corre sola al iniciar el servidor (src/index.js); también
 * se puede ejecutar a mano con: node src/db/migracion_liquidaciones.js
 */

const pool = require('./conexion');

const migrarLiquidaciones = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS zonas_operador (
      id SERIAL PRIMARY KEY,
      colegio_id INTEGER NOT NULL,
      local VARCHAR(100) NOT NULL,
      operador VARCHAR(120) NOT NULL,
      contacto VARCHAR(120),
      email VARCHAR(150),
      telefono VARCHAR(40),
      cuenta_pago VARCHAR(120),
      canon_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
      creado_en TIMESTAMP NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
      UNIQUE (colegio_id, local)
    );

    CREATE TABLE IF NOT EXISTS liquidaciones (
      id SERIAL PRIMARY KEY,
      colegio_id INTEGER NOT NULL,
      local VARCHAR(100) NOT NULL,
      operador VARCHAR(120) NOT NULL,
      desde DATE,
      hasta DATE NOT NULL,
      ventas NUMERIC(12,2) NOT NULL DEFAULT 0,
      cantidad_ventas INTEGER NOT NULL DEFAULT 0,
      anulaciones NUMERIC(12,2) NOT NULL DEFAULT 0,
      cantidad_anulaciones INTEGER NOT NULL DEFAULT 0,
      canon_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
      canon NUMERIC(12,2) NOT NULL DEFAULT 0,
      ajuste NUMERIC(12,2) NOT NULL DEFAULT 0,
      ajuste_motivo VARCHAR(200),
      total NUMERIC(12,2) NOT NULL DEFAULT 0,
      estado VARCHAR(12) NOT NULL DEFAULT 'pendiente',
      creado_en TIMESTAMP NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
      creado_por INTEGER,
      pagada_en TIMESTAMP,
      pagada_por INTEGER,
      referencia_pago VARCHAR(200)
    );
    CREATE INDEX IF NOT EXISTS ix_liquidaciones_colegio ON liquidaciones (colegio_id, local);

    ALTER TABLE zonas_operador ADD COLUMN IF NOT EXISTS tipo VARCHAR(15) NOT NULL DEFAULT 'concesionario';
    ALTER TABLE zonas_operador ADD COLUMN IF NOT EXISTS empleado_id INTEGER;
    ALTER TABLE liquidaciones ADD COLUMN IF NOT EXISTS tipo_operador VARCHAR(15) NOT NULL DEFAULT 'concesionario';

    ALTER TABLE transacciones ADD COLUMN IF NOT EXISTS liquidacion_id INTEGER;
    CREATE INDEX IF NOT EXISTS ix_transacciones_sin_liquidar ON transacciones (colegio_id, lugar)
      WHERE liquidacion_id IS NULL AND tipo IN ('compra', 'anulacion');
    CREATE INDEX IF NOT EXISTS ix_transacciones_liquidacion ON transacciones (liquidacion_id) WHERE liquidacion_id IS NOT NULL;
  `);
  console.log('✅ Liquidaciones verificadas');
};

if (require.main === module) {
  migrarLiquidaciones()
    .catch(err => { console.error('❌ Error en migración:', err.message); process.exitCode = 1; })
    .finally(() => pool.end());
}

module.exports = { migrarLiquidaciones };
