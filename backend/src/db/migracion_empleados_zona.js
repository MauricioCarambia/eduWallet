/**
 * Cada empleado (staff) puede quedar asignado a un local fijo (kiosco,
 * librería, comedor, etc.) — si tiene local_id, el POS lo bloquea a esa
 * zona en vez de dejarlo elegir. Admin y empleados sin asignar (local_id
 * NULL) siguen sin restricción, como hasta ahora.
 *
 * También agrega las columnas para que cada empleado conecte su propia
 * cuenta de Mercado Pago (para cobrar las ventas de su turno al cerrar
 * caja) — mismo patrón que colegios.mp_access_token.
 *
 * Idempotente. Ejecutar con: node src/db/migracion_empleados_zona.js
 */

const pool = require('./conexion');

const migrar = async () => {
  const client = await pool.connect();
  try {
    console.log('🔄 Agregando zona y credenciales de MP a empleados...\n');

    await client.query(`ALTER TABLE empleados ADD COLUMN IF NOT EXISTS local_id INTEGER REFERENCES locales(id)`);
    await client.query(`ALTER TABLE empleados ADD COLUMN IF NOT EXISTS mp_access_token TEXT`);
    await client.query(`ALTER TABLE empleados ADD COLUMN IF NOT EXISTS mp_refresh_token TEXT`);
    await client.query(`ALTER TABLE empleados ADD COLUMN IF NOT EXISTS mp_user_id VARCHAR(50)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_empleados_local_id ON empleados (local_id)`);

    console.log('✅ Migración completada.');
  } catch (err) {
    console.error('\n❌ Error en migración:', err.message);
    process.exit(1);
  } finally {
    client.release();
    process.exit(0);
  }
};

migrar();
