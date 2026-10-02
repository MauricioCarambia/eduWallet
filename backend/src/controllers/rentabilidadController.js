// Rentabilidad para el admin: ventas, costo (precio de compra que cargó cada
// zona), ganancia y compras a proveedores en un período.
//
// - La ganancia sale de cada venta: precio de venta − precio de compra que
//   tenía el producto en ese momento (transaccion_items.costo).
// - Si la venta tuvo descuento, cada producto se toma con el descuento
//   repartido en proporción (lo que realmente se cobró).
// - Las ventas de productos sin precio de compra cargado no entran en la
//   ganancia: se informan aparte para que se completen.

const pool = require('../db/conexion');

const AR = "'America/Argentina/Buenos_Aires'";
const FECHA_AR = col => `(${col} AT TIME ZONE 'UTC' AT TIME ZONE ${AR})::date`;
const DIA = /^\d{4}-\d{2}-\d{2}$/;

const getRentabilidad = async (req, res) => {
  const colegioId = req.empleado.colegio_id;
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });
  const desde = DIA.test(req.query.desde || '') ? req.query.desde : hoy;
  const hasta = DIA.test(req.query.hasta || '') ? req.query.hasta : hoy;
  const lugar = req.query.lugar && req.query.lugar !== 'Todos' ? String(req.query.lugar) : null;
  try {
    // Cada producto vendido con lo que se cobró de verdad (descuento repartido)
    const base = `
      WITH lineas AS (
        SELECT t.lugar, ti.producto_id, ti.nombre, ti.categoria, ti.cantidad,
               ti.precio * ti.cantidad * (t.monto / NULLIF(SUM(ti.precio * ti.cantidad) OVER (PARTITION BY ti.transaccion_id), 0)) AS venta,
               ti.costo * ti.cantidad AS costo
        FROM transaccion_items ti
        JOIN transacciones t ON t.id = ti.transaccion_id
        WHERE t.colegio_id = $1 AND t.tipo = 'compra' AND COALESCE(t.descripcion, '') NOT LIKE '[ANULADA]%'
          AND ${FECHA_AR('t.fecha')} BETWEEN $2::date AND $3::date
          AND ($4::text IS NULL OR t.lugar = $4)
      )`;
    const params = [colegioId, desde, hasta, lugar];
    const resumen = `
      SUM(venta) AS ventas,
      SUM(venta) FILTER (WHERE costo IS NOT NULL) AS ventas_con_costo,
      SUM(costo) AS costo,
      SUM(venta) FILTER (WHERE costo IS NULL) AS ventas_sin_costo,
      SUM(cantidad)::int AS unidades`;
    const [total, porZona, porCategoria, porProducto, compras] = await Promise.all([
      pool.query(`${base} SELECT ${resumen} FROM lineas`, params),
      pool.query(`${base} SELECT lugar AS nombre, ${resumen} FROM lineas GROUP BY lugar ORDER BY SUM(venta) DESC`, params),
      pool.query(`${base} SELECT COALESCE(categoria, 'otro') AS nombre, ${resumen} FROM lineas GROUP BY 1 ORDER BY SUM(venta) DESC`, params),
      pool.query(`${base} SELECT MIN(nombre) AS nombre, MIN(lugar) AS lugar, ${resumen} FROM lineas GROUP BY producto_id, lower(nombre) ORDER BY SUM(venta) DESC LIMIT 300`, params),
      pool.query(
        `SELECT pr.nombre, COUNT(DISTINCT pe.id)::int AS pedidos, SUM(pi.cantidad_recibida)::int AS unidades,
                SUM(pi.cantidad_recibida * COALESCE(pi.precio_recibido, pi.precio_compra)) AS total
         FROM pedidos_proveedor pe
         JOIN proveedores pr ON pr.id = pe.proveedor_id
         JOIN pedido_items pi ON pi.pedido_id = pe.id
         WHERE pe.colegio_id = $1 AND pe.estado IN ('recibido', 'incompleto')
           AND ${FECHA_AR('pe.recibido_en')} BETWEEN $2::date AND $3::date
           AND ($4::text IS NULL OR pe.local = $4)
         GROUP BY pr.nombre ORDER BY total DESC`, params),
    ]);

    // números y ganancia de cada fila
    const fila = r => {
      const ventas = Number(r.ventas) || 0, conCosto = Number(r.ventas_con_costo) || 0, costo = Number(r.costo) || 0;
      const ganancia = conCosto - costo;
      return {
        ...r, ventas, ventas_con_costo: conCosto, costo, ganancia,
        margen: conCosto > 0 ? ganancia / conCosto : null,
        ventas_sin_costo: Number(r.ventas_sin_costo) || 0,
        unidades: r.unidades || 0,
      };
    };
    res.json({
      desde, hasta, lugar,
      total: fila(total.rows[0] || {}),
      por_zona: porZona.rows.map(fila),
      por_categoria: porCategoria.rows.map(fila),
      por_producto: porProducto.rows.map(fila),
      compras: compras.rows.map(r => ({ ...r, total: Number(r.total) || 0 })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
};

module.exports = { getRentabilidad };
