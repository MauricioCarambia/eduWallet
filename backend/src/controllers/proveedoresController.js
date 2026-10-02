// Proveedores (compartidos entre las zonas del colegio), su catálogo, los
// pedidos de cada zona y la recepción de la mercadería.
//
// Precios: el catálogo guarda el precio de compra por UNIDAD; los pedidos se
// arman por bultos (ej. 2 cajas x 12 = 24 unidades). Al recibir, lo que llegó
// se suma al stock del producto de venta de la zona (el que tenga el mismo
// código de barras o, si no, el mismo nombre; si no existe se crea) y su
// precio de compra pasa a ser el recibido.

const pool = require('../db/conexion');
const { registrar } = require('./auditoriaController');

const CATEGORIAS = ['comida', 'bebida', 'golosina', 'útil', 'otro'];
const ESTADOS = ['pedido', 'recibido', 'incompleto', 'cancelado'];
const MAX_ITEMS = 500;

const texto = (v, max = 120) => { const t = String(v ?? '').trim().replace(/\s+/g, ' '); return t ? t.slice(0, max) : null; };
const codigoBarras = v => { const c = String(v ?? '').replace(/\s+/g, ''); return c ? c.slice(0, 50) : null; };
const monto = v => { const n = Number(v); return Number.isFinite(n) && n >= 0 && n <= 10000000 ? Math.round(n * 100) / 100 : null; };
const entero = (v, min = 0, max = 100000) => { const n = Number(v); return Number.isInteger(n) && n >= min && n <= max ? n : null; };
const categoria = v => (CATEGORIAS.includes(v) ? v : 'otro');

// Zona fija del empleado o, si no tiene, la que mande (si existe en el colegio)
const zonaDe = async (empleado, pedida) => {
  if (empleado.local_id) {
    const r = await pool.query('SELECT nombre FROM locales WHERE id = $1 AND colegio_id = $2', [empleado.local_id, empleado.colegio_id]);
    return r.rows[0]?.nombre || null;
  }
  if (!pedida) return null;
  const r = await pool.query('SELECT nombre FROM locales WHERE colegio_id = $1 AND nombre = $2', [empleado.colegio_id, pedida]);
  return r.rows[0]?.nombre || null;
};

const proveedorDelColegio = async (id, colegioId) =>
  (await pool.query('SELECT * FROM proveedores WHERE id = $1 AND colegio_id = $2 AND activo', [id, colegioId])).rows[0];

// ─── Proveedores ────────────────────────────────────────────────────────────
const getProveedores = async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT p.*,
              (SELECT COUNT(*)::int FROM proveedor_productos pp WHERE pp.proveedor_id = p.id AND pp.activo) AS productos,
              (SELECT COUNT(*)::int FROM pedidos_proveedor pe WHERE pe.proveedor_id = p.id AND pe.estado = 'pedido') AS pedidos_abiertos
       FROM proveedores p WHERE p.colegio_id = $1 AND p.activo ORDER BY p.nombre`,
      [req.empleado.colegio_id]
    );
    res.json(r.rows);
  } catch (err) {
    console.error(err); res.status(500).json({ error: 'Error del servidor' });
  }
};

const datosProveedor = b => ({ nombre: texto(b.nombre), telefono: texto(b.telefono, 40), contacto: texto(b.contacto), notas: texto(b.notas, 500) });

const crearProveedor = async (req, res) => {
  const d = datosProveedor(req.body || {});
  if (!d.nombre) return res.status(400).json({ error: 'El nombre del proveedor es obligatorio' });
  try {
    const r = await pool.query(
      'INSERT INTO proveedores (colegio_id, nombre, telefono, contacto, notas) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [req.empleado.colegio_id, d.nombre, d.telefono, d.contacto, d.notas]
    );
    await registrar(req.empleado.id, req.empleado.colegio_id, 'Proveedor nuevo', d.nombre);
    res.json(r.rows[0]);
  } catch (err) {
    console.error(err); res.status(500).json({ error: 'Error del servidor' });
  }
};

const actualizarProveedor = async (req, res) => {
  const d = datosProveedor(req.body || {});
  if (!d.nombre) return res.status(400).json({ error: 'El nombre del proveedor es obligatorio' });
  try {
    const r = await pool.query(
      'UPDATE proveedores SET nombre = $1, telefono = $2, contacto = $3, notas = $4 WHERE id = $5 AND colegio_id = $6 AND activo RETURNING *',
      [d.nombre, d.telefono, d.contacto, d.notas, req.params.id, req.empleado.colegio_id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Proveedor no encontrado' });
    res.json(r.rows[0]);
  } catch (err) {
    console.error(err); res.status(500).json({ error: 'Error del servidor' });
  }
};

const eliminarProveedor = async (req, res) => {
  try {
    const r = await pool.query('UPDATE proveedores SET activo = false WHERE id = $1 AND colegio_id = $2 RETURNING nombre', [req.params.id, req.empleado.colegio_id]);
    if (!r.rows.length) return res.status(404).json({ error: 'Proveedor no encontrado' });
    await registrar(req.empleado.id, req.empleado.colegio_id, 'Proveedor eliminado', r.rows[0].nombre);
    res.json({ ok: true });
  } catch (err) {
    console.error(err); res.status(500).json({ error: 'Error del servidor' });
  }
};

// ─── Catálogo de cada proveedor ─────────────────────────────────────────────
const getCatalogo = async (req, res) => {
  try {
    if (!(await proveedorDelColegio(req.params.id, req.empleado.colegio_id))) return res.status(404).json({ error: 'Proveedor no encontrado' });
    const r = await pool.query('SELECT * FROM proveedor_productos WHERE proveedor_id = $1 AND activo ORDER BY categoria, nombre', [req.params.id]);
    res.json(r.rows);
  } catch (err) {
    console.error(err); res.status(500).json({ error: 'Error del servidor' });
  }
};

const datosItem = b => {
  const d = {
    nombre: texto(b.nombre),
    precio_compra: monto(b.precio_compra),
    codigo_barras: codigoBarras(b.codigo_barras),
    categoria: categoria(b.categoria),
    unidades_bulto: b.unidades_bulto === undefined || b.unidades_bulto === '' ? 1 : entero(Number(b.unidades_bulto), 1, 1000),
    notas: texto(b.notas, 300),
  };
  if (!d.nombre) return { error: 'El nombre del producto es obligatorio' };
  if (d.precio_compra === null) return { error: 'El precio de compra tiene que ser un número' };
  if (d.unidades_bulto === null) return { error: 'Las unidades por bulto tienen que ser un número entero entre 1 y 1000' };
  return { d };
};

const crearItem = async (req, res) => {
  const { d, error } = datosItem(req.body || {});
  if (error) return res.status(400).json({ error });
  try {
    if (!(await proveedorDelColegio(req.params.id, req.empleado.colegio_id))) return res.status(404).json({ error: 'Proveedor no encontrado' });
    const r = await pool.query(
      `INSERT INTO proveedor_productos (colegio_id, proveedor_id, nombre, precio_compra, codigo_barras, categoria, unidades_bulto, notas)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [req.empleado.colegio_id, req.params.id, d.nombre, d.precio_compra, d.codigo_barras, d.categoria, d.unidades_bulto, d.notas]
    );
    res.json(r.rows[0]);
  } catch (err) {
    console.error(err); res.status(500).json({ error: 'Error del servidor' });
  }
};

const actualizarItem = async (req, res) => {
  const { d, error } = datosItem(req.body || {});
  if (error) return res.status(400).json({ error });
  try {
    const r = await pool.query(
      `UPDATE proveedor_productos SET nombre = $1, precio_compra = $2, codigo_barras = $3, categoria = $4, unidades_bulto = $5, notas = $6
       WHERE id = $7 AND colegio_id = $8 AND activo RETURNING *`,
      [d.nombre, d.precio_compra, d.codigo_barras, d.categoria, d.unidades_bulto, d.notas, req.params.itemId, req.empleado.colegio_id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(r.rows[0]);
  } catch (err) {
    console.error(err); res.status(500).json({ error: 'Error del servidor' });
  }
};

const eliminarItem = async (req, res) => {
  try {
    const r = await pool.query('UPDATE proveedor_productos SET activo = false WHERE id = $1 AND colegio_id = $2 RETURNING id', [req.params.itemId, req.empleado.colegio_id]);
    if (!r.rows.length) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err); res.status(500).json({ error: 'Error del servidor' });
  }
};

// Importar la lista de precios del proveedor (filas ya leídas del Excel en el POS):
// si el producto ya está (mismo código o nombre) se actualiza; si no, se crea
const importarCatalogo = async (req, res) => {
  const filas = req.body?.productos;
  if (!Array.isArray(filas) || filas.length === 0) return res.status(400).json({ error: 'No hay productos para importar' });
  if (filas.length > 1000) return res.status(400).json({ error: 'Se pueden importar hasta 1000 productos por vez' });
  const db = await pool.connect();
  try {
    if (!(await proveedorDelColegio(req.params.id, req.empleado.colegio_id))) return res.status(404).json({ error: 'Proveedor no encontrado' });
    await db.query('BEGIN');
    let creados = 0, actualizados = 0;
    const errores = [];
    for (let i = 0; i < filas.length; i++) {
      const fila = Number.isInteger(filas[i]?.fila) ? filas[i].fila : i + 2;
      const { d, error } = datosItem(filas[i] || {});
      if (error) { errores.push({ fila, error }); continue; }
      const previo = (await db.query(
        `SELECT id FROM proveedor_productos WHERE proveedor_id = $1 AND activo
           AND (($2::text IS NOT NULL AND codigo_barras = $2) OR lower(nombre) = lower($3)) ORDER BY id LIMIT 1`,
        [req.params.id, d.codigo_barras, d.nombre])).rows[0];
      if (previo) {
        await db.query(
          `UPDATE proveedor_productos SET nombre = $1, precio_compra = $2, codigo_barras = COALESCE($3, codigo_barras), categoria = $4, unidades_bulto = $5 WHERE id = $6`,
          [d.nombre, d.precio_compra, d.codigo_barras, d.categoria, d.unidades_bulto, previo.id]);
        actualizados++;
      } else {
        await db.query(
          `INSERT INTO proveedor_productos (colegio_id, proveedor_id, nombre, precio_compra, codigo_barras, categoria, unidades_bulto)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [req.empleado.colegio_id, req.params.id, d.nombre, d.precio_compra, d.codigo_barras, d.categoria, d.unidades_bulto]);
        creados++;
      }
    }
    await db.query('COMMIT');
    res.json({ creados, actualizados, errores });
  } catch (err) {
    await db.query('ROLLBACK').catch(() => {});
    console.error(err); res.status(500).json({ error: 'Error del servidor' });
  } finally {
    db.release();
  }
};

// ─── Pedidos ────────────────────────────────────────────────────────────────
const conItems = async pedidos => {
  if (!pedidos.length) return pedidos;
  const items = await pool.query('SELECT * FROM pedido_items WHERE pedido_id = ANY($1::int[]) ORDER BY id', [pedidos.map(p => p.id)]);
  return pedidos.map(p => {
    const propios = items.rows.filter(i => i.pedido_id === p.id);
    const totalPedido = propios.reduce((s, i) => s + Number(i.precio_compra) * i.bultos * i.unidades_bulto, 0);
    const totalRecibido = propios.reduce((s, i) => s + Number(i.precio_recibido ?? i.precio_compra) * (i.cantidad_recibida || 0), 0);
    return { ...p, items: propios, total_pedido: totalPedido, total_recibido: totalRecibido };
  });
};

const getPedidos = async (req, res) => {
  try {
    const zona = req.empleado.local_id ? await zonaDe(req.empleado) : (req.query.local || null);
    const estado = ESTADOS.includes(req.query.estado) ? req.query.estado : null;
    const r = await pool.query(
      `SELECT pe.*, pr.nombre AS proveedor_nombre, pr.telefono AS proveedor_telefono, e.nombre AS empleado_nombre, er.nombre AS recibido_por_nombre
       FROM pedidos_proveedor pe
       JOIN proveedores pr ON pr.id = pe.proveedor_id
       LEFT JOIN empleados e ON e.id = pe.empleado_id
       LEFT JOIN empleados er ON er.id = pe.recibido_por
       WHERE pe.colegio_id = $1 AND ($2::text IS NULL OR pe.local = $2) AND ($3::text IS NULL OR pe.estado = $3)
       ORDER BY (pe.estado = 'pedido') DESC, pe.creado_en DESC LIMIT 200`,
      [req.empleado.colegio_id, zona, estado]
    );
    res.json(await conItems(r.rows));
  } catch (err) {
    console.error(err); res.status(500).json({ error: 'Error del servidor' });
  }
};

// items: [{ proveedor_producto_id, bultos }]
const crearPedido = async (req, res) => {
  const b = req.body || {};
  const items = Array.isArray(b.items) ? b.items.filter(i => entero(Number(i.bultos), 1) !== null) : [];
  if (items.length === 0) return res.status(400).json({ error: 'El pedido está vacío' });
  if (items.length > MAX_ITEMS) return res.status(400).json({ error: 'Demasiados productos en el pedido' });
  const db = await pool.connect();
  try {
    const proveedor = await proveedorDelColegio(b.proveedor_id, req.empleado.colegio_id);
    if (!proveedor) return res.status(404).json({ error: 'Proveedor no encontrado' });
    const zona = await zonaDe(req.empleado, b.local);
    if (!zona) return res.status(400).json({ error: 'Zona inválida' });
    const catalogo = (await db.query('SELECT * FROM proveedor_productos WHERE proveedor_id = $1 AND activo AND id = ANY($2::int[])',
      [proveedor.id, items.map(i => Number(i.proveedor_producto_id))])).rows;
    const porId = new Map(catalogo.map(c => [c.id, c]));
    if (items.some(i => !porId.has(Number(i.proveedor_producto_id)))) return res.status(400).json({ error: 'Algún producto ya no está en el catálogo del proveedor' });

    await db.query('BEGIN');
    const pe = (await db.query(
      'INSERT INTO pedidos_proveedor (colegio_id, proveedor_id, local, empleado_id, notas) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [req.empleado.colegio_id, proveedor.id, zona, req.empleado.id, texto(b.notas, 500)])).rows[0];
    for (const i of items) {
      const c = porId.get(Number(i.proveedor_producto_id));
      await db.query(
        `INSERT INTO pedido_items (pedido_id, proveedor_producto_id, nombre, codigo_barras, categoria, unidades_bulto, bultos, precio_compra)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [pe.id, c.id, c.nombre, c.codigo_barras, c.categoria, c.unidades_bulto, Number(i.bultos), c.precio_compra]);
    }
    await db.query('COMMIT');
    await registrar(req.empleado.id, req.empleado.colegio_id, 'Pedido a proveedor', `${proveedor.nombre} para ${zona}: ${items.length} producto${items.length > 1 ? 's' : ''}`);
    res.json((await conItems([{ ...pe, proveedor_nombre: proveedor.nombre, proveedor_telefono: proveedor.telefono }]))[0]);
  } catch (err) {
    await db.query('ROLLBACK').catch(() => {});
    console.error(err); res.status(500).json({ error: 'Error del servidor' });
  } finally {
    db.release();
  }
};

const pedidoAbierto = async (id, colegioId, db = pool) =>
  (await db.query(`SELECT * FROM pedidos_proveedor WHERE id = $1 AND colegio_id = $2 FOR UPDATE`, [id, colegioId])).rows[0];

const cancelarPedido = async (req, res) => {
  try {
    const r = await pool.query(
      `UPDATE pedidos_proveedor SET estado = 'cancelado' WHERE id = $1 AND colegio_id = $2 AND estado = 'pedido' RETURNING id`,
      [req.params.id, req.empleado.colegio_id]);
    if (!r.rows.length) return res.status(400).json({ error: 'Sólo se pueden cancelar pedidos que todavía no llegaron' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err); res.status(500).json({ error: 'Error del servidor' });
  }
};

// Recepción: items [{ id, cantidad_recibida (unidades), precio_recibido?, precio_venta? }]
// precio_venta hace falta sólo para los productos que todavía no se venden en la zona
const recibirPedido = async (req, res) => {
  const recibidos = Array.isArray(req.body?.items) ? req.body.items : [];
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    const pe = await pedidoAbierto(req.params.id, req.empleado.colegio_id, db);
    if (!pe) { await db.query('ROLLBACK'); return res.status(404).json({ error: 'Pedido no encontrado' }); }
    if (pe.estado !== 'pedido') { await db.query('ROLLBACK'); return res.status(400).json({ error: 'Este pedido ya se recibió o se canceló' }); }
    if (req.empleado.local_id && (await zonaDe(req.empleado)) !== pe.local) { await db.query('ROLLBACK'); return res.status(403).json({ error: `Este pedido es de ${pe.local}` }); }

    const items = (await db.query('SELECT * FROM pedido_items WHERE pedido_id = $1 ORDER BY id', [pe.id])).rows;
    const porId = new Map(recibidos.map(r => [Number(r.id), r]));
    let completo = true, unidades = 0, total = 0;
    const nuevos = [];
    for (const it of items) {
      const r = porId.get(it.id) || {};
      const pedidas = it.bultos * it.unidades_bulto;
      const cantidad = entero(Number(r.cantidad_recibida ?? 0), 0, 100000);
      if (cantidad === null) { await db.query('ROLLBACK'); return res.status(400).json({ error: `Cantidad inválida en ${it.nombre}` }); }
      const precio = r.precio_recibido === undefined || r.precio_recibido === '' || r.precio_recibido === null ? Number(it.precio_compra) : monto(r.precio_recibido);
      if (precio === null) { await db.query('ROLLBACK'); return res.status(400).json({ error: `Precio de compra inválido en ${it.nombre}` }); }
      if (cantidad < pedidas) completo = false;

      let productoId = null;
      if (cantidad > 0) {
        // producto de venta de la zona: mismo código de barras o mismo nombre
        let prod = (await db.query(
          `SELECT * FROM productos WHERE colegio_id = $1 AND local = $2 AND activo
             AND (($3::text IS NOT NULL AND codigo_barras = $3) OR lower(nombre) = lower($4))
           ORDER BY (codigo_barras = $3) DESC NULLS LAST, id LIMIT 1`,
          [pe.colegio_id, pe.local, it.codigo_barras, it.nombre])).rows[0];
        if (prod) {
          await db.query('UPDATE productos SET stock = stock + $1, costo = $2, codigo_barras = COALESCE(codigo_barras, $3) WHERE id = $4',
            [cantidad, precio, it.codigo_barras, prod.id]);
        } else {
          const venta = monto(r.precio_venta);
          if (!venta) { await db.query('ROLLBACK'); return res.status(400).json({ error: `Poné el precio de venta de ${it.nombre} (todavía no se vende en ${pe.local})`, item_id: it.id, falta_precio_venta: true }); }
          prod = (await db.query(
            `INSERT INTO productos (nombre, precio, stock, categoria, local, colegio_id, codigo_barras, costo)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [it.nombre, venta, cantidad, it.categoria || 'otro', pe.local, pe.colegio_id, it.codigo_barras, precio])).rows[0];
          nuevos.push(it.nombre);
        }
        productoId = prod.id;
        unidades += cantidad;
        total += precio * cantidad;
      }
      await db.query('UPDATE pedido_items SET cantidad_recibida = $1, precio_recibido = $2, producto_id = $3 WHERE id = $4', [cantidad, precio, productoId, it.id]);
      // el precio de compra del catálogo queda actualizado con el que llegó
      if (it.proveedor_producto_id && precio !== Number(it.precio_compra)) {
        await db.query('UPDATE proveedor_productos SET precio_compra = $1 WHERE id = $2', [precio, it.proveedor_producto_id]);
      }
    }
    const estado = completo ? 'recibido' : 'incompleto';
    await db.query(`UPDATE pedidos_proveedor SET estado = $1, recibido_en = NOW() AT TIME ZONE 'UTC', recibido_por = $2 WHERE id = $3`, [estado, req.empleado.id, pe.id]);
    await db.query('COMMIT');
    await registrar(req.empleado.id, req.empleado.colegio_id, 'Pedido recibido',
      `Pedido #${pe.id} en ${pe.local}: ${unidades} unidades por $${Math.round(total).toLocaleString('es-AR')}${completo ? '' : ' (llegó incompleto)'}${nuevos.length ? `. Productos nuevos: ${nuevos.join(', ')}` : ''}`);
    res.json({ estado, unidades, total, nuevos });
  } catch (err) {
    await db.query('ROLLBACK').catch(() => {});
    console.error(err); res.status(500).json({ error: 'Error del servidor' });
  } finally {
    db.release();
  }
};

module.exports = {
  getProveedores, crearProveedor, actualizarProveedor, eliminarProveedor,
  getCatalogo, crearItem, actualizarItem, eliminarItem, importarCatalogo,
  getPedidos, crearPedido, cancelarPedido, recibirPedido,
};
