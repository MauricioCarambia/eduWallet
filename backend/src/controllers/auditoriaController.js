const pool = require('../db/conexion');

const getAuditoria = async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const limitNum = Math.min(Math.max(parseInt(limit) || 50, 1), 200);
    const offset   = (Math.max(parseInt(page) || 1, 1) - 1) * limitNum;

    const [dataRes, countRes] = await Promise.all([
      pool.query(
        `SELECT a.*, e.nombre as empleado_nombre
         FROM auditoria a
         LEFT JOIN empleados e ON a.empleado_id = e.id
         WHERE a.colegio_id = $1
         ORDER BY a.fecha DESC
         LIMIT $2 OFFSET $3`,
        [req.empleado.colegio_id, limitNum, offset]
      ),
      pool.query('SELECT COUNT(*) FROM auditoria WHERE colegio_id = $1', [req.empleado.colegio_id])
    ]);

    res.json({
      data:  dataRes.rows,
      total: parseInt(countRes.rows[0].count),
      page:  parseInt(page),
      limit: limitNum,
      pages: Math.ceil(parseInt(countRes.rows[0].count) / limitNum)
    });
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

const registrar = async (empleado_id, colegio_id, accion, detalle) => {
  try {
    await pool.query(
      'INSERT INTO auditoria (empleado_id, colegio_id, accion, detalle) VALUES ($1, $2, $3, $4)',
      [empleado_id, colegio_id, accion, detalle]
    );
  } catch (err) {
    console.error('Error al registrar auditoría:', err);
  }
};

module.exports = { getAuditoria, registrar };