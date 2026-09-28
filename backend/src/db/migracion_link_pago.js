/**
 * Links de pago generados por el colegio desde el admin (para padres que
 * no usan la app): el pago no está asociado a un padre, así que
 * pagos.padre_id pasa a ser opcional, y pagos.origen distingue 'app' de
 * 'link'.
 *
 * Idempotente. Corre sola al iniciar el servidor (src/index.js); también
 * se puede ejecutar a mano con: node src/db/migracion_link_pago.js
 */

const pool = require('./conexion');

const migrarLinkPago = async () => {
  await pool.query(`
    ALTER TABLE pagos ALTER COLUMN padre_id DROP NOT NULL;
    ALTER TABLE pagos ADD COLUMN IF NOT EXISTS origen VARCHAR(10) NOT NULL DEFAULT 'app';
    ALTER TABLE pagos DROP CONSTRAINT IF EXISTS pagos_origen_check;
    ALTER TABLE pagos ADD CONSTRAINT pagos_origen_check CHECK (origen IN ('app', 'link'));
  `);
  console.log('✅ Links de pago en pagos verificado');
};

if (require.main === module) {
  migrarLinkPago()
    .catch(err => { console.error('❌ Error en migración:', err.message); process.exitCode = 1; })
    .finally(() => pool.end());
}

module.exports = { migrarLinkPago };
