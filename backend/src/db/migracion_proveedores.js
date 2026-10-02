/**
 * Proveedores, su catálogo, pedidos y recepción de mercadería (POS).
 * - productos.costo: precio de compra por unidad que pone el empleado; la
 *   ganancia es precio (venta) − costo.
 * - proveedores: compartidos entre las zonas del colegio.
 * - proveedor_productos: lo que vende cada proveedor (precio de compra por
 *   unidad, código, categoría y unidades por bulto, ej. caja x 12).
 * - pedidos_proveedor / pedido_items: lo que pide una zona; al recibirlo se
 *   tilda o se cuenta cada producto y se suma al stock de venta.
 *
 * Idempotente. Corre sola al iniciar el servidor (src/index.js); también
 * se puede ejecutar a mano con: node src/db/migracion_proveedores.js
 */

const pool = require('./conexion');

const migrarProveedores = async () => {
  await pool.query(`
    ALTER TABLE productos ADD COLUMN IF NOT EXISTS costo NUMERIC(12,2);

    CREATE TABLE IF NOT EXISTS proveedores (
      id SERIAL PRIMARY KEY,
      colegio_id INTEGER NOT NULL,
      nombre VARCHAR(120) NOT NULL,
      telefono VARCHAR(40),
      contacto VARCHAR(120),
      notas TEXT,
      activo BOOLEAN NOT NULL DEFAULT true,
      creado_en TIMESTAMP NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
    );
    CREATE INDEX IF NOT EXISTS ix_proveedores_colegio ON proveedores (colegio_id);

    CREATE TABLE IF NOT EXISTS proveedor_productos (
      id SERIAL PRIMARY KEY,
      colegio_id INTEGER NOT NULL,
      proveedor_id INTEGER NOT NULL REFERENCES proveedores(id),
      nombre VARCHAR(120) NOT NULL,
      precio_compra NUMERIC(12,2) NOT NULL DEFAULT 0,
      codigo_barras VARCHAR(50),
      categoria VARCHAR(30),
      unidades_bulto INTEGER NOT NULL DEFAULT 1,
      notas TEXT,
      activo BOOLEAN NOT NULL DEFAULT true
    );
    CREATE INDEX IF NOT EXISTS ix_proveedor_productos ON proveedor_productos (proveedor_id);

    CREATE TABLE IF NOT EXISTS pedidos_proveedor (
      id SERIAL PRIMARY KEY,
      colegio_id INTEGER NOT NULL,
      proveedor_id INTEGER NOT NULL REFERENCES proveedores(id),
      local VARCHAR(100) NOT NULL,
      empleado_id INTEGER,
      estado VARCHAR(20) NOT NULL DEFAULT 'pedido',
      notas TEXT,
      creado_en TIMESTAMP NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
      recibido_en TIMESTAMP,
      recibido_por INTEGER
    );
    CREATE INDEX IF NOT EXISTS ix_pedidos_proveedor ON pedidos_proveedor (colegio_id, estado);

    CREATE TABLE IF NOT EXISTS pedido_items (
      id SERIAL PRIMARY KEY,
      pedido_id INTEGER NOT NULL REFERENCES pedidos_proveedor(id) ON DELETE CASCADE,
      proveedor_producto_id INTEGER REFERENCES proveedor_productos(id),
      nombre VARCHAR(120) NOT NULL,
      codigo_barras VARCHAR(50),
      categoria VARCHAR(30),
      unidades_bulto INTEGER NOT NULL DEFAULT 1,
      bultos INTEGER NOT NULL DEFAULT 1,
      precio_compra NUMERIC(12,2) NOT NULL DEFAULT 0,
      cantidad_recibida INTEGER,
      precio_recibido NUMERIC(12,2),
      producto_id INTEGER
    );
    CREATE INDEX IF NOT EXISTS ix_pedido_items ON pedido_items (pedido_id);
  `);
  console.log('✅ Proveedores y pedidos verificados');
};

if (require.main === module) {
  migrarProveedores()
    .catch(err => { console.error('❌ Error en migración:', err.message); process.exitCode = 1; })
    .finally(() => pool.end());
}

module.exports = { migrarProveedores };
