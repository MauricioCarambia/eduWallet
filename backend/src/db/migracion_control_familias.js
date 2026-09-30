/**
 * Control de las familias, alergias, avisos y conciliación:
 *
 * - alumnos: reglas de compra de la familia (restricciones JSONB y límite
 *   semanal), alérgenos estructurados y si la venta con alérgeno se bloquea.
 *   El saldo puede quedar negativo (contracargo de una recarga ya gastada).
 * - productos: alérgenos que contiene cada uno.
 * - transaccion_items: el detalle de cada compra, para contar unidades por
 *   categoría (ej.: máximo 1 bebida por día).
 * - padres: qué avisos quiere recibir cada uno y por qué medio.
 * - pagos: devoluciones, contracargos y disputas de Mercado Pago.
 * - transacciones: tipo 'reversion' (se descuenta una recarga devuelta).
 * - conciliaciones: cada revisión Mercado Pago ↔ saldo y lo que encontró.
 *
 * Idempotente. Corre sola al iniciar el servidor (src/index.js); también
 * se puede ejecutar a mano con: node src/db/migracion_control_familias.js
 */

const pool = require('./conexion');

// Alérgenos que se pueden deducir del texto libre que ya tenían los alumnos
const DEDUCIR_ALERGENOS = [
  ['mani', 'man[ií]'],
  ['frutos_secos', 'frutos? secos|nuez|nueces|almendra|avellana|casta[ñn]a'],
  ['gluten', 'gluten|tacc|cel[ií]ac|trigo'],
  ['leche', 'leche|lact|l[aá]cteo'],
  ['huevo', 'huevo'],
  ['soja', 'soja'],
  ['pescado', 'pescado|marisco|crust[aá]ceo'],
  ['sesamo', 's[eé]samo'],
];

const migrarControlFamilias = async () => {
  await pool.query(`
    ALTER TABLE alumnos ADD COLUMN IF NOT EXISTS restricciones JSONB NOT NULL DEFAULT '{}'::jsonb;
    ALTER TABLE alumnos ADD COLUMN IF NOT EXISTS limite_semanal DECIMAL(10,2);
    ALTER TABLE alumnos ADD COLUMN IF NOT EXISTS alergenos TEXT[] NOT NULL DEFAULT '{}';
    ALTER TABLE alumnos ADD COLUMN IF NOT EXISTS bloquear_alergenos BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE alumnos DROP CONSTRAINT IF EXISTS alumnos_saldo_check;
    ALTER TABLE alumnos DROP CONSTRAINT IF EXISTS chk_alumnos_saldo_nn;

    ALTER TABLE productos ADD COLUMN IF NOT EXISTS alergenos TEXT[] NOT NULL DEFAULT '{}';

    CREATE TABLE IF NOT EXISTS transaccion_items (
      id             SERIAL PRIMARY KEY,
      transaccion_id INTEGER NOT NULL REFERENCES transacciones(id) ON DELETE CASCADE,
      producto_id    INTEGER REFERENCES productos(id) ON DELETE SET NULL,
      nombre         VARCHAR(100) NOT NULL,
      categoria      VARCHAR(50),
      cantidad       INTEGER NOT NULL CHECK (cantidad > 0),
      precio         DECIMAL(10,2) NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_transaccion_items_tx ON transaccion_items (transaccion_id);

    ALTER TABLE padres ADD COLUMN IF NOT EXISTS notif_compras VARCHAR(10) NOT NULL DEFAULT 'todas';
    ALTER TABLE padres ADD COLUMN IF NOT EXISTS notif_compras_minimo DECIMAL(10,2) NOT NULL DEFAULT 10000;
    ALTER TABLE padres ADD COLUMN IF NOT EXISTS notif_saldo_bajo BOOLEAN NOT NULL DEFAULT true;
    ALTER TABLE padres ADD COLUMN IF NOT EXISTS umbral_saldo_bajo DECIMAL(10,2) NOT NULL DEFAULT 5000;
    ALTER TABLE padres ADD COLUMN IF NOT EXISTS notif_bloqueos BOOLEAN NOT NULL DEFAULT true;
    ALTER TABLE padres ADD COLUMN IF NOT EXISTS notif_rechazos BOOLEAN NOT NULL DEFAULT true;
    ALTER TABLE padres ADD COLUMN IF NOT EXISTS notif_email BOOLEAN NOT NULL DEFAULT true;
    ALTER TABLE padres ADD COLUMN IF NOT EXISTS notif_push BOOLEAN NOT NULL DEFAULT true;
    ALTER TABLE padres DROP CONSTRAINT IF EXISTS chk_padres_notif_compras;
    ALTER TABLE padres ADD CONSTRAINT chk_padres_notif_compras CHECK (notif_compras IN ('todas', 'mayores', 'ninguna'));

    ALTER TABLE pagos ADD COLUMN IF NOT EXISTS monto_revertido DECIMAL(10,2) NOT NULL DEFAULT 0;
    ALTER TABLE pagos DROP CONSTRAINT IF EXISTS pagos_estado_check;
    ALTER TABLE pagos ADD CONSTRAINT pagos_estado_check CHECK (estado IN
      ('pendiente', 'acreditado', 'rechazado', 'vencido', 'devuelto', 'devuelto_parcial', 'contracargo', 'en_disputa'));

    ALTER TABLE transacciones DROP CONSTRAINT IF EXISTS transacciones_tipo_check;
    ALTER TABLE transacciones DROP CONSTRAINT IF EXISTS chk_transacciones_tipo_valido;
    ALTER TABLE transacciones ADD CONSTRAINT chk_transacciones_tipo_valido CHECK (tipo IN
      ('compra', 'recarga', 'anulacion', 'ajuste', 'reversion'));

    CREATE TABLE IF NOT EXISTS conciliaciones (
      id           SERIAL PRIMARY KEY,
      colegio_id   INTEGER NOT NULL REFERENCES colegios(id),
      origen       VARCHAR(10) NOT NULL DEFAULT 'auto',
      empleado_id  INTEGER REFERENCES empleados(id) ON DELETE SET NULL,
      dias         INTEGER NOT NULL,
      revisados    INTEGER NOT NULL DEFAULT 0,
      corregidas   INTEGER NOT NULL DEFAULT 0,
      diferencias  JSONB NOT NULL DEFAULT '[]'::jsonb,
      ejecutado_en TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_conciliaciones_colegio ON conciliaciones (colegio_id, ejecutado_en DESC);
  `);

  // Alumnos que tenían la alergia escrita a mano: se pasan a la lista
  // estructurada (sólo si todavía no tienen ninguna cargada)
  for (const [clave, patron] of DEDUCIR_ALERGENOS) {
    await pool.query(
      `UPDATE alumnos SET alergenos = array_append(alergenos, $1)
       WHERE alergias ~* $2 AND NOT ($1 = ANY(alergenos))
         AND NOT EXISTS (SELECT 1 FROM auditoria WHERE accion = 'Migración de alergias' AND colegio_id = alumnos.colegio_id)`,
      [clave, patron]
    );
  }
  await pool.query(
    `INSERT INTO auditoria (colegio_id, accion, detalle)
     SELECT c.id, 'Migración de alergias', 'Alérgenos deducidos del texto de alergias de cada alumno'
     FROM colegios c
     WHERE NOT EXISTS (SELECT 1 FROM auditoria WHERE accion = 'Migración de alergias' AND colegio_id = c.id)`
  );

  console.log('✅ Control de familias, alergias, avisos y conciliación verificados');
};

if (require.main === module) {
  migrarControlFamilias()
    .catch(err => { console.error('❌ Error en migración:', err.message); process.exitCode = 1; })
    .finally(() => pool.end());
}

module.exports = { migrarControlFamilias };
