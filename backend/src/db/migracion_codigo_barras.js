/**
 * Código de barras de los productos: se escanea con el mismo lector de la
 * credencial para cargar productos y para agregarlos al carrito en el POS.
 * El mismo código no puede estar en dos productos activos de la misma zona.
 *
 * Idempotente. Corre sola al iniciar el servidor (src/index.js); también
 * se puede ejecutar a mano con: node src/db/migracion_codigo_barras.js
 */

const pool = require('./conexion');

const migrarCodigoBarras = async () => {
  await pool.query(`
    ALTER TABLE productos ADD COLUMN IF NOT EXISTS codigo_barras VARCHAR(50);
    CREATE UNIQUE INDEX IF NOT EXISTS uq_productos_codigo_barras
      ON productos (colegio_id, local, codigo_barras)
      WHERE activo = true AND codigo_barras IS NOT NULL;
  `);
  console.log('✅ Código de barras en productos verificado');
};

if (require.main === module) {
  migrarCodigoBarras()
    .catch(err => { console.error('❌ Error en migración:', err.message); process.exitCode = 1; })
    .finally(() => pool.end());
}

module.exports = { migrarCodigoBarras };
