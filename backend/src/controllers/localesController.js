const pool = require('../db/conexion');

const getLocales = async (req, res) => {
  try {
    const soloActivos = req.query.todos !== '1';
    const condicion = soloActivos ? 'AND activo = true' : '';
    const resultado = await pool.query(
      `SELECT * FROM locales WHERE colegio_id = $1 ${condicion} ORDER BY nombre`,
      [req.empleado.colegio_id]
    );
    res.json(resultado.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

const crearLocal = async (req, res) => {
  const { nombre } = req.body;
  if (!nombre?.trim()) return res.status(400).json({ error: 'Nombre requerido' });
  try {
    const resultado = await pool.query(
      'INSERT INTO locales (colegio_id, nombre) VALUES ($1, $2) RETURNING *',
      [req.empleado.colegio_id, nombre.trim()]
    );
    res.json(resultado.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Ya existe un local con ese nombre' });
    res.status(500).json({ error: 'Error del servidor' });
  }
};

const toggleLocal = async (req, res) => {
  const { id } = req.params;
  try {
    const resultado = await pool.query(
      'UPDATE locales SET activo = NOT activo WHERE id = $1 AND colegio_id = $2 RETURNING *',
      [id, req.empleado.colegio_id]
    );
    if (resultado.rows.length === 0) return res.status(404).json({ error: 'Local no encontrado' });
    res.json(resultado.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

module.exports = { getLocales, crearLocal, toggleLocal };
