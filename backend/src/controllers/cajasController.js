const pool = require('../db/conexion');

const abrirCaja = async (req, res) => {
  const { empleado_id, local, fondo } = req.body;
  try {
    const resultado = await pool.query(
      `INSERT INTO cajas (empleado_id, local, fondo, ventas, tx_count, abierta, colegio_id)
       VALUES ($1, $2, $3, 0, 0, true, $4) RETURNING *`,
      [empleado_id, local, fondo || 0, req.empleado.colegio_id]
    );
    res.json(resultado.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

const cerrarCaja = async (req, res) => {
  const { id } = req.params;
  try {
    const resultado = await pool.query(
      `UPDATE cajas SET abierta = false, cierre = NOW()
       WHERE id = $1 AND colegio_id = $2 RETURNING *`,
      [id, req.empleado.colegio_id]
    );
    if (resultado.rows.length === 0) return res.status(404).json({ error: 'Caja no encontrada' });
    res.json(resultado.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

const getCajas = async (req, res) => {
  try {
    const resultado = await pool.query(
      `SELECT c.*, e.nombre as empleado_nombre
       FROM cajas c
       LEFT JOIN empleados e ON c.empleado_id = e.id
       WHERE c.colegio_id = $1
       ORDER BY c.apertura DESC`,
      [req.empleado.colegio_id]
    );
    res.json(resultado.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

module.exports = { abrirCaja, cerrarCaja, getCajas };
