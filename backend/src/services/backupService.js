const pool = require('../db/conexion');
const { enviarEmailBackup } = require('./emailService');

const TABLAS_CON_COLEGIO = ['empleados', 'alumnos', 'productos', 'transacciones', 'cajas', 'auditoria', 'configuracion'];
const TABLAS_VIA_ALUMNO = ['padres', 'padres_alumnos'];

const generarSQL = async (colegioId) => {
  const tablas = [...TABLAS_CON_COLEGIO, ...TABLAS_VIA_ALUMNO];
  let sql = `-- EduWallet Backup\n-- Fecha: ${new Date().toLocaleString('es-AR')}\n\n`;

  for (const tabla of tablas) {
    try {
      const query = TABLAS_CON_COLEGIO.includes(tabla)
        ? { text: `SELECT * FROM ${tabla} WHERE colegio_id = $1`, values: [colegioId] }
        : tabla === 'padres_alumnos'
        ? { text: `SELECT pa.* FROM padres_alumnos pa JOIN alumnos a ON a.id = pa.alumno_id WHERE a.colegio_id = $1`, values: [colegioId] }
        : { text: `SELECT DISTINCT p.* FROM padres p JOIN padres_alumnos pa ON pa.padre_id = p.id JOIN alumnos a ON a.id = pa.alumno_id WHERE a.colegio_id = $1`, values: [colegioId] };
      const res = await pool.query(query);
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

const hacerBackup = async (colegioId, enviarEmail = false) => {
  try {
    console.log('Iniciando backup...');
    const sql = await generarSQL(colegioId);
    const fecha = new Date().toISOString().slice(0, 10);
    const nombre = `eduwallet-backup-${fecha}.sql`;

    if (enviarEmail) {
      await enviarEmailBackup({ colegioId, sql, nombre });
    }

    console.log('Backup completado');
    return { sql, nombre };
  } catch (err) {
    console.error('Error en backup:', err.message);
    throw err;
  }
};

module.exports = { hacerBackup, generarSQL };