/**
 * Grupo de productos: variedades de lo mismo (alfajores, gaseosas, cuadernos).
 * Cada variedad sigue siendo un producto con su precio, stock y código; en la
 * Venta del POS se muestran juntas en una tarjeta que abre las variedades.
 *
 * Idempotente. Corre sola al iniciar el servidor (src/index.js); también
 * se puede ejecutar a mano con: node src/db/migracion_grupo_productos.js
 */

const pool = require('./conexion');

const migrarGrupoProductos = async () => {
  await pool.query(`ALTER TABLE productos ADD COLUMN IF NOT EXISTS grupo VARCHAR(80);`);
  console.log('✅ Grupo de productos verificado');
};

if (require.main === module) {
  migrarGrupoProductos()
    .catch(err => { console.error('❌ Error en migración:', err.message); process.exitCode = 1; })
    .finally(() => pool.end());
}

module.exports = { migrarGrupoProductos };
