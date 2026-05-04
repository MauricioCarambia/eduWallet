const pool = require('../db/conexion');

const getProductos = async (req, res) => {
  try {
    const resultado = await pool.query(
      'SELECT * FROM productos WHERE activo = true ORDER BY local, nombre'
    );
    res.json(resultado.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

const crearProducto = async (req, res) => {
  const { nombre, precio, stock, categoria, local } = req.body;
  try {
    const resultado = await pool.query(
      `INSERT INTO productos (nombre, precio, stock, categoria, local)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [nombre, precio, stock || 0, categoria, local]
    );
    res.json(resultado.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

const actualizarStock = async (req, res) => {
  const { id } = req.params;
  const { delta } = req.body;
  try {
    const resultado = await pool.query(
      `UPDATE productos SET stock = GREATEST(0, stock + $1)
       WHERE id = $2 RETURNING *`,
      [delta, id]
    );
    res.json(resultado.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

const eliminarProducto = async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query(
      'UPDATE productos SET activo = false WHERE id = $1',
      [id]
    );
    res.json({ mensaje: 'Producto eliminado' });
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

module.exports = { getProductos, crearProducto, actualizarStock, eliminarProducto };