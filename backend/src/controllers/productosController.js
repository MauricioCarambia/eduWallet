const pool = require('../db/conexion');
const { registrar } = require('./auditoriaController');
const { normalizarAlergenos, deducirAlergenos } = require('../services/reglasCompra');

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
  if (!String(nombre ?? '').trim()) return 'El nombre es obligatorio';
  const p = Number(precio);
  if (!Number.isFinite(p) || p <= 0) return 'El precio tiene que ser mayor a 0';
  return null;
};

// Código de barras tal como lo tipea el lector (sin espacios); vacío = sin código
const normalizarCodigoBarras = v => {
  const c = String(v ?? '').replace(/\s+/g, '');
  return c ? c.slice(0, 50) : null;
};

// Grupo de variedades (ej. "Alfajores"); vacío = producto suelto
const normalizarGrupo = v => {
  const g = String(v ?? '').trim().replace(/\s+/g, ' ');
  return g ? g.slice(0, 80) : null;
};

// Categorías del POS; lo que venga de un Excel se lleva a la más parecida
const CATEGORIAS = ['comida', 'bebida', 'golosina', 'útil', 'otro'];
const normalizarCategoria = v => {
  const t = String(v ?? '').trim().toLowerCase();
  if (!t) return null;
  if (CATEGORIAS.includes(t)) return t;
  const s = t.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (s.startsWith('comida')) return 'comida';
  if (s.startsWith('bebida')) return 'bebida';
  if (s.startsWith('golosina')) return 'golosina';
  if (s.startsWith('util') || s.startsWith('libreria')) return 'útil';
  return 'otro';
};

const CODIGO_REPETIDO = 'Ese código de barras ya está en otro producto de esta zona';
const esRepetido = err => err.code === '23505';

const crearProducto = async (req, res) => {
  const { nombre, precio, stock } = req.body;
  const error = validarDatos(req.body);
  if (error) return res.status(400).json({ error });
  const categoria = normalizarCategoria(req.body.categoria) || 'otro';
  const codigo = normalizarCodigoBarras(req.body.codigo_barras);
  const alergenos = normalizarAlergenos(req.body.alergenos);
  try {
    // Un empleado con zona fija siempre crea en su zona
    const zona = await zonaDelEmpleado(req.empleado);
    const local = zona || req.body.local;
    const existe = await pool.query('SELECT 1 FROM locales WHERE colegio_id = $1 AND nombre = $2', [req.empleado.colegio_id, local]);
    if (existe.rows.length === 0) return res.status(400).json({ error: 'Zona inválida' });

    const resultado = await pool.query(
      `INSERT INTO productos (nombre, precio, stock, categoria, local, colegio_id, codigo_barras, alergenos, grupo)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [String(nombre).trim(), Number(precio), Math.max(0, parseInt(stock) || 0), categoria, local, req.empleado.colegio_id, codigo, alergenos, normalizarGrupo(req.body.grupo)]
    );
    await registrar(req.empleado.id, req.empleado.colegio_id, 'Nuevo producto', `${String(nombre).trim()} — ${Number(precio)} (${local})`);
    res.json(resultado.rows[0]);
  } catch (err) {
    if (esRepetido(err)) return res.status(409).json({ error: CODIGO_REPETIDO });
    res.status(500).json({ error: 'Error del servidor' });
  }
};

// Editar nombre, precio, categoría y código de barras
const actualizarProducto = async (req, res) => {
  const { id } = req.params;
  const { precio } = req.body;
  const nombre = String(req.body.nombre ?? '');
  const error = validarDatos(req.body);
  if (error) return res.status(400).json({ error });
  try {
    const producto = await productoDelColegio(id, req.empleado.colegio_id);
    if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });
    if (!(await puedeGestionar(req.empleado, producto.local))) {
      return res.status(403).json({ error: `Sólo podés modificar productos de tu zona` });
    }
    const resultado = await pool.query(
      'UPDATE productos SET nombre = $1, precio = $2, categoria = $3, codigo_barras = $4, alergenos = $5, grupo = $6 WHERE id = $7 RETURNING *',
      [nombre.trim(), Number(precio), normalizarCategoria(req.body.categoria) || producto.categoria,
        'codigo_barras' in req.body ? normalizarCodigoBarras(req.body.codigo_barras) : producto.codigo_barras,
        Array.isArray(req.body.alergenos) ? normalizarAlergenos(req.body.alergenos) : producto.alergenos,
        'grupo' in req.body ? normalizarGrupo(req.body.grupo) : producto.grupo, id]
    );
    const cambios = [
      producto.nombre !== nombre.trim() && `nombre: ${producto.nombre} → ${nombre.trim()}`,
      Number(producto.precio) !== Number(precio) && `precio: $${Number(producto.precio)} → $${Number(precio)}`,
    ].filter(Boolean).join(', ');
    await registrar(req.empleado.id, req.empleado.colegio_id, 'Producto editado', `${nombre.trim()} (${producto.local})${cambios ? ' — ' + cambios : ''}`);
    res.json(resultado.rows[0]);
  } catch (err) {
    if (esRepetido(err)) return res.status(409).json({ error: CODIGO_REPETIDO });
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

// Importar la lista de productos de una zona (Excel / CSV leído en el POS).
// Cada fila se busca por código de barras y, si no tiene o no está, por nombre:
// si existe se actualiza (precio, categoría, código y stock si vino), si no se
// crea. Las filas con errores se informan y no frenan al resto.
const MAX_IMPORTAR = 1000;

const importarProductos = async (req, res) => {
  const filas = req.body.productos;
  if (!Array.isArray(filas) || filas.length === 0) return res.status(400).json({ error: 'No hay productos para importar' });
  if (filas.length > MAX_IMPORTAR) return res.status(400).json({ error: `Se pueden importar hasta ${MAX_IMPORTAR} productos por vez` });

  const colegioId = req.empleado.colegio_id;
  let db;
  try {
    const zona = await zonaDelEmpleado(req.empleado);
    const local = zona || req.body.local;
    const existe = await pool.query('SELECT 1 FROM locales WHERE colegio_id = $1 AND nombre = $2', [colegioId, local]);
    if (existe.rows.length === 0) return res.status(400).json({ error: 'Zona inválida' });

    let creados = 0, actualizados = 0;
    const errores = [];
    db = await pool.connect();
    await db.query('BEGIN');
    for (let i = 0; i < filas.length; i++) {
      const f = filas[i] || {};
      const fila = Number.isInteger(f.fila) ? f.fila : i + 2;
      const error = validarDatos(f);
      if (error) { errores.push({ fila, error }); continue; }
      const stockVacio = f.stock === undefined || f.stock === null || String(f.stock).trim() === '';
      const stock = stockVacio ? null : Number(f.stock);
      if (!stockVacio && (!Number.isInteger(stock) || stock < 0)) { errores.push({ fila, error: 'El stock tiene que ser un número entero, 0 o más' }); continue; }

      const nombre = String(f.nombre).trim().slice(0, 100);
      const precio = Number(f.precio);
      const categoria = normalizarCategoria(f.categoria);
      const codigo = normalizarCodigoBarras(f.codigo_barras);
      const alergenos = String(f.alergenos ?? '').trim() ? deducirAlergenos(f.alergenos) : null;
      const grupo = normalizarGrupo(f.grupo);

      let previo = null;
      if (codigo) {
        previo = (await db.query('SELECT id FROM productos WHERE colegio_id = $1 AND local = $2 AND activo = true AND codigo_barras = $3', [colegioId, local, codigo])).rows[0];
      }
      if (!previo) {
        previo = (await db.query('SELECT id FROM productos WHERE colegio_id = $1 AND local = $2 AND activo = true AND lower(nombre) = lower($3) ORDER BY id LIMIT 1', [colegioId, local, nombre])).rows[0];
      }

      // Un savepoint por fila: si una choca (código repetido) no se pierde el resto
      await db.query('SAVEPOINT fila');
      try {
        if (previo) {
          await db.query(
            `UPDATE productos SET nombre = $1, precio = $2, categoria = COALESCE($3, categoria),
               codigo_barras = COALESCE($4, codigo_barras), stock = COALESCE($5, stock), alergenos = COALESCE($7, alergenos),
               grupo = COALESCE($8, grupo)
             WHERE id = $6`,
            [nombre, precio, categoria, codigo, stock, previo.id, alergenos, grupo]
          );
          actualizados++;
        } else {
          await db.query(
            `INSERT INTO productos (nombre, precio, stock, categoria, local, colegio_id, codigo_barras, alergenos, grupo)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [nombre, precio, stock ?? 0, categoria || 'otro', local, colegioId, codigo, alergenos || [], grupo]
          );
          creados++;
        }
        await db.query('RELEASE SAVEPOINT fila');
      } catch (err) {
        await db.query('ROLLBACK TO SAVEPOINT fila');
        if (!esRepetido(err)) throw err;
        errores.push({ fila, error: CODIGO_REPETIDO });
      }
    }
    await db.query('COMMIT');
    if (creados + actualizados > 0) {
      await registrar(req.empleado.id, colegioId, 'Productos importados', `${creados} nuevos, ${actualizados} actualizados (${local})`);
    }
    res.json({ creados, actualizados, errores });
  } catch (err) {
    if (db) await db.query('ROLLBACK').catch(() => {});
    res.status(500).json({ error: 'Error del servidor' });
  } finally {
    db?.release();
  }
};

// Más vendidos de una zona en los últimos 30 días (sin ventas anuladas):
// la Venta del POS arranca mostrando estos
const getMasVendidos = async (req, res) => {
  try {
    const zona = (await zonaDelEmpleado(req.empleado)) || req.query.local;
    if (!zona) return res.json([]);
    const resultado = await pool.query(
      `SELECT ti.producto_id, SUM(ti.cantidad)::int AS cantidad
       FROM transaccion_items ti
       JOIN transacciones t ON t.id = ti.transaccion_id
       WHERE t.colegio_id = $1 AND t.tipo = 'compra' AND t.lugar = $2
         AND t.fecha > NOW() - INTERVAL '30 days'
         AND COALESCE(t.descripcion, '') NOT LIKE '[ANULADA]%'
         AND ti.producto_id IS NOT NULL
       GROUP BY ti.producto_id
       ORDER BY cantidad DESC
       LIMIT 20`,
      [req.empleado.colegio_id, zona]
    );
    res.json(resultado.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

// Productos con stock por debajo (o igual) del umbral configurado
const getStockBajo = async (req, res) => {
  try {
    const config = await pool.query('SELECT umbral_stock_bajo FROM configuracion WHERE colegio_id = $1', [req.empleado.colegio_id]);
    const umbral = config.rows[0]?.umbral_stock_bajo ?? 5;
    // Un empleado con zona fija sólo ve las alertas de su zona; sin zona, todas
    const zona = await zonaDelEmpleado(req.empleado);
    const resultado = await pool.query(
      `SELECT id, nombre, stock, categoria, local
       FROM productos
       WHERE activo = true AND stock <= $1 AND colegio_id = $2
         AND ($3::text IS NULL OR local = $3)
       ORDER BY stock ASC, nombre`,
      [umbral, req.empleado.colegio_id, zona]
    );
    res.json({ umbral, productos: resultado.rows });
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

module.exports = { getProductos, crearProducto, actualizarProducto, actualizarStock, eliminarProducto, getStockBajo, getMasVendidos, importarProductos };
