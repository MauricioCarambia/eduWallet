const pool = require('../db/conexion');

const abrirCaja = async (req, res) => {
  const { empleado_id, local, fondo } = req.body;
  try {
    const resultado = await pool.query(
      `INSERT INTO cajas (empleado_id, local, fondo, ventas, tx_count, abierta)
       VALUES ($1, $2, $3, 0, 0, true) RETURNING *`,
      [empleado_id, local, fondo || 0]
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
       WHERE id = $1 RETURNING *`,
      [id]
    );
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
       ORDER BY c.apertura DESC`
    );
    res.json(resultado.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

module.exports = { abrirCaja, cerrarCaja, getCajas };