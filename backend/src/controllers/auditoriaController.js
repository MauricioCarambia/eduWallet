const pool = require('../db/conexion');

const getAuditoria = async (req, res) => {
  try {
    const resultado = await pool.query(`
      SELECT a.*, e.nombre as empleado_nombre
      FROM auditoria a
      LEFT JOIN empleados e ON a.empleado_id = e.id
      ORDER BY a.fecha DESC
      LIMIT 200
    `);
    res.json(resultado.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

const registrar = async (empleado_id, accion, detalle) => {
  try {
    await pool.query(
      'INSERT INTO auditoria (empleado_id, accion, detalle) VALUES ($1, $2, $3)',
      [empleado_id, accion, detalle]
    );
  } catch (err) {
    console.error('Error al registrar auditoría:', err);
  }
};

module.exports = { getAuditoria, registrar };