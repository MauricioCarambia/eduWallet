const pool = require('../db/conexion');
const { registrar } = require('./auditoriaController');

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

// Zona fija del empleado (kiosco, librería, comedor...) o null si no tiene
const zonaDelEmpleado = async (empleado) => {
  if (!empleado.local_id) return null;
  const r = await pool.query('SELECT nombre FROM locales WHERE id = $1 AND colegio_id = $2', [empleado.local_id, empleado.colegio_id]);
  return r.rows[0]?.nombre || null;
};

// Cada zona gestiona sus productos: un empleado con zona fija sólo puede
// tocar los de su zona; uno sin zona, todos. El admin del colegio no llega
// acá (lo corta soloPersonalPos en las rutas).
const puedeGestionar = async (empleado, local) => {
  const zona = await zonaDelEmpleado(empleado);
  return zona === null || zona === local;
};

const productoDelColegio = async (id, colegioId) =>
  (await pool.query('SELECT * FROM productos WHERE id = $1 AND colegio_id = $2 AND activo = true', [id, colegioId])).rows[0];

const validarDatos = ({ nombre, precio }) => {
  if (!nombre?.trim()) return 'El nombre es obligatorio';
  const p = Number(precio);
  if (!Number.isFinite(p) || p <= 0) return 'El precio tiene que ser mayor a 0';
  return null;
};

const crearProducto = async (req, res) => {
  const { nombre, precio, stock, categoria } = req.body;
  const error = validarDatos(req.body);
  if (error) return res.status(400).json({ error });
  try {
    // Un empleado con zona fija siempre crea en su zona
    const zona = await zonaDelEmpleado(req.empleado);
    const local = zona || req.body.local;
    const existe = await pool.query('SELECT 1 FROM locales WHERE colegio_id = $1 AND nombre = $2', [req.empleado.colegio_id, local]);
    if (existe.rows.length === 0) return res.status(400).json({ error: 'Zona inválida' });

    const resultado = await pool.query(
      `INSERT INTO productos (nombre, precio, stock, categoria, local, colegio_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [nombre.trim(), Number(precio), Math.max(0, parseInt(stock) || 0), categoria, local, req.empleado.colegio_id]
    );
    await registrar(req.empleado.id, req.empleado.colegio_id, 'Nuevo producto', `${nombre.trim()} — $${Number(precio)} (${local})`);
    res.json(resultado.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

// Editar nombre, precio y categoría
const actualizarProducto = async (req, res) => {
  const { id } = req.params;
  const { nombre, precio, categoria } = req.body;
  const error = validarDatos(req.body);
  if (error) return res.status(400).json({ error });
  try {
    const producto = await productoDelColegio(id, req.empleado.colegio_id);
    if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });
    if (!(await puedeGestionar(req.empleado, producto.local))) {
      return res.status(403).json({ error: `Sólo podés modificar productos de tu zona` });
    }
    const resultado = await pool.query(
      'UPDATE productos SET nombre = $1, precio = $2, categoria = $3 WHERE id = $4 RETURNING *',
      [nombre.trim(), Number(precio), categoria || producto.categoria, id]
    );
    const cambios = [
      producto.nombre !== nombre.trim() && `nombre: ${producto.nombre} → ${nombre.trim()}`,
      Number(producto.precio) !== Number(precio) && `precio: $${Number(producto.precio)} → $${Number(precio)}`,
    ].filter(Boolean).join(', ');
    await registrar(req.empleado.id, req.empleado.colegio_id, 'Producto editado', `${nombre.trim()} (${producto.local})${cambios ? ' — ' + cambios : ''}`);
    res.json(resultado.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

const actualizarStock = async (req, res) => {
  const { id } = req.params;
  const { delta } = req.body;
  try {
    const producto = await productoDelColegio(id, req.empleado.colegio_id);
    if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });
    if (!(await puedeGestionar(req.empleado, producto.local))) {
      return res.status(403).json({ error: 'Sólo podés modificar productos de tu zona' });
    }
    const resultado = await pool.query(
      `UPDATE productos SET stock = GREATEST(0, stock + $1)
       WHERE id = $2 AND colegio_id = $3 RETURNING *`,
      [delta, id, req.empleado.colegio_id]
    );
    res.json(resultado.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

const eliminarProducto = async (req, res) => {
  const { id } = req.params;
  try {
    const producto = await productoDelColegio(id, req.empleado.colegio_id);
    if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });
    if (!(await puedeGestionar(req.empleado, producto.local))) {
      return res.status(403).json({ error: 'Sólo podés eliminar productos de tu zona' });
    }
    await pool.query('UPDATE productos SET activo = false WHERE id = $1', [id]);
    await registrar(req.empleado.id, req.empleado.colegio_id, 'Producto eliminado', `${producto.nombre} (${producto.local})`);
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

module.exports = { getProductos, crearProducto, actualizarProducto, actualizarStock, eliminarProducto, getStockBajo };
