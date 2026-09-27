/**
 * Split de pagos (Marketplace de Mercado Pago), modelo B:
 * el padre elige cuánto saldo cargar y paga ese monto + la comisión de la
 * plataforma. MP divide el pago: el colegio cobra el saldo y la plataforma
 * se queda con la comisión (marketplace_fee).
 *
 * - pagos.monto sigue siendo el saldo que se acredita al alumno
 * - pagos.comision y pagos.monto_total (lo que efectivamente paga el padre)
 * - colegios/empleados.mp_token_expira para renovar el token de OAuth
 * - índices únicos para que un mismo pago de MP no se acredite dos veces
 *   (webhook y /verificar pueden llegar al mismo tiempo)
 *
 * Idempotente. Corre sola al iniciar el servidor (src/index.js); también
 * se puede ejecutar a mano con: node src/db/migracion_split.js
 */

const pool = require('./conexion');

const migrarSplit = async () => {
  const client = await pool.connect();
  try {
    await client.query(`ALTER TABLE pagos ADD COLUMN IF NOT EXISTS comision DECIMAL(10,2) NOT NULL DEFAULT 0`);
    await client.query(`ALTER TABLE pagos ADD COLUMN IF NOT EXISTS monto_total DECIMAL(10,2)`);
    await client.query(`UPDATE pagos SET monto_total = monto WHERE monto_total IS NULL`);
    await client.query(`ALTER TABLE colegios ADD COLUMN IF NOT EXISTS mp_token_expira TIMESTAMP`);
    await client.query(`ALTER TABLE empleados ADD COLUMN IF NOT EXISTS mp_token_expira TIMESTAMP`);

    // Antes de crear los índices únicos, avisar si ya hay duplicados: en ese
    // caso no se crean (las columnas sí) y hay que revisarlos a mano
    const dupTx = await client.query(`
      SELECT descripcion, COUNT(*) FROM transacciones
      WHERE tipo = 'recarga' AND descripcion LIKE 'MP:%'
      GROUP BY descripcion HAVING COUNT(*) > 1`);
    const dupPagos = await client.query(`
      SELECT external_reference, COUNT(*) FROM pagos
      WHERE external_reference IS NOT NULL
      GROUP BY external_reference HAVING COUNT(*) > 1`);
    if (dupTx.rows.length || dupPagos.rows.length) {
      console.error('❌ Split: hay pagos acreditados más de una vez, no se crearon los índices únicos:');
      dupTx.rows.forEach(r => console.error(`   transacciones ${r.descripcion}: ${r.count} veces`));
      dupPagos.rows.forEach(r => console.error(`   pagos ${r.external_reference}: ${r.count} veces`));
      return false;
    }

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_transacciones_recarga_mp
        ON transacciones (descripcion)
        WHERE tipo = 'recarga' AND descripcion LIKE 'MP:%'`);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_pagos_external_reference ON pagos (external_reference)`);
    console.log('✅ Migración de split de pagos verificada');
    return true;
  } finally {
    client.release();
  }
};

if (require.main === module) {
  migrarSplit()
    .then(ok => { process.exitCode = ok ? 0 : 1; })
    .catch(err => { console.error('❌ Error en migración:', err.message); process.exitCode = 1; })
    .finally(() => pool.end());
}

module.exports = { migrarSplit };
