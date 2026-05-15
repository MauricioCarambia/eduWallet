const pool = require('../db/conexion');
const { enviarEmailBackup } = require('./emailService');

const generarSQL = async () => {
  const tablas = ['empleados', 'alumnos', 'productos', 'transacciones', 'cajas', 'auditoria', 'padres', 'padres_alumnos', 'configuracion'];
  let sql = `-- EduWallet Backup\n-- Fecha: ${new Date().toLocaleString('es-AR')}\n\n`;

  for (const tabla of tablas) {
    try {
      const res = await pool.query(`SELECT * FROM ${tabla}`);
      if (res.rows.length === 0) {
        sql += `-- Tabla ${tabla}: sin datos\n\n`;
        continue;
      }
      sql += `-- Tabla: ${tabla} (${res.rows.length} registros)\n`;
      for (const row of res.rows) {
        const cols = Object.keys(row).join(', ');
        const vals = Object.values(row).map(v => {
          if (v === null) return 'NULL';
          if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
          if (typeof v === 'number') return v;
          if (v instanceof Date) return `'${v.toISOString()}'`;
          return `'${String(v).replace(/'/g, "''")}'`;
        }).join(', ');
        sql += `INSERT INTO ${tabla} (${cols}) VALUES (${vals});\n`;
      }
      sql += '\n';
    } catch (err) {
      sql += `-- Error exportando ${tabla}: ${err.message}\n\n`;
    }
  }
  return sql;
};

const hacerBackup = async (enviarEmail = false) => {
  try {
    console.log('Iniciando backup...');
    const sql = await generarSQL();
    const fecha = new Date().toISOString().slice(0, 10);
    const nombre = `eduwallet-backup-${fecha}.sql`;

    if (enviarEmail) {
      await enviarEmailBackup({ sql, nombre });
    }

    console.log('Backup completado');
    return { sql, nombre };
  } catch (err) {
    console.error('Error en backup:', err.message);
    throw err;
  }
};

module.exports = { hacerBackup, generarSQL };