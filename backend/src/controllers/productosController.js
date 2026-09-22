const pool = require('../db/conexion');

const getProductos = async (req, res) => {
  try {
    const resultado = await pool.query(
      'SELECT * FROM productos WHERE activo = true AND colegio_id = $1 ORDER BY local, nombre',
      [req.empleado.colegio_id]
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
      `INSERT INTO productos (nombre, precio, stock, categoria, local, colegio_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [nombre, precio, stock || 0, categoria, local, req.empleado.colegio_id]
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
       WHERE id = $2 AND colegio_id = $3 RETURNING *`,
      [delta, id, req.empleado.colegio_id]
    );
    if (resultado.rows.length === 0) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(resultado.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

const eliminarProducto = async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query(
      'UPDATE productos SET activo = false WHERE id = $1 AND colegio_id = $2',
      [id, req.empleado.colegio_id]
    );
    res.json({ mensaje: 'Producto eliminado' });
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

// Productos con stock por debajo (o igual) del umbral configurado
const getStockBajo = async (req, res) => {
  try {
    const config = await pool.query('SELECT umbral_stock_bajo FROM configuracion WHERE colegio_id = $1', [req.empleado.colegio_id]);
    const umbral = config.rows[0]?.umbral_stock_bajo ?? 5;
    const resultado = await pool.query(
      `SELECT id, nombre, stock, categoria, local
       FROM productos
       WHERE activo = true AND stock <= $1 AND colegio_id = $2
       ORDER BY stock ASC, nombre`,
      [umbral, req.empleado.colegio_id]
    );
    res.json({ umbral, productos: resultado.rows });
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

module.exports = { getProductos, crearProducto, actualizarStock, eliminarProducto, getStockBajo };
