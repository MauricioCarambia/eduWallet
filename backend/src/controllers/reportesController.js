/**
 * Totales de Reportes (admin) calculados en la base. Antes Reportes sumaba en
 * el navegador las primeras 2000 transacciones del período: en un colegio con
 * cientos de ventas por día, ni la semana entraba completa.
 *
 * GET /api/reportes/resumen?desde=AAAA-MM-DD&hasta=AAAA-MM-DD&lugar=
 * Días en hora argentina (la fecha se guarda en UTC). Las ventas anuladas no
 * suman: se cuentan aparte.
 */
const pool = require('../db/conexion');

const ZONA = 'America/Argentina/Buenos_Aires';
const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const hoyAR = () => new Date().toLocaleDateString('en-CA', { timeZone: ZONA });
const DIA = `to_char((t.fecha AT TIME ZONE 'UTC' AT TIME ZONE '${ZONA}')::date, 'YYYY-MM-DD')`;
const VALIDA = `t.tipo = 'compra' AND COALESCE(t.descripcion, '') NOT LIKE '[ANULADA]%'`;
const DONDE = `t.colegio_id = $1
  AND t.fecha >= ($2::date::timestamp AT TIME ZONE '${ZONA}' AT TIME ZONE 'UTC')
  AND t.fecha <  (($3::date + 1)::timestamp AT TIME ZONE '${ZONA}' AT TIME ZONE 'UTC')
  AND ($4::text IS NULL OR t.lugar = $4)`;

const getResumen = async (req, res) => {
  const hasta = FECHA.test(req.query.hasta || '') ? req.query.hasta : hoyAR();
  const desde = FECHA.test(req.query.desde || '') ? req.query.desde : hasta;
  if (desde > hasta) return res.status(400).json({ error: 'El período es inválido' });
  const lugar = req.query.lugar && req.query.lugar !== 'Todos' ? String(req.query.lugar) : null;
  const p = [req.empleado.colegio_id, desde, hasta, lugar];
  const n = v => Number(v || 0);

  try {
    const [tot, dias, diasLocal, locales, productos, cursos, alumnos] = await Promise.all([
      pool.query(`SELECT
          COALESCE(SUM(t.monto) FILTER (WHERE ${VALIDA}), 0) AS ventas,
          COUNT(*) FILTER (WHERE ${VALIDA}) AS cantidad_ventas,
          COUNT(*) FILTER (WHERE ${VALIDA} AND t.offline) AS sin_conexion,
          COUNT(*) FILTER (WHERE t.tipo = 'compra' AND t.descripcion LIKE '[ANULADA]%') AS anuladas,
          COALESCE(SUM(t.monto) FILTER (WHERE t.tipo = 'recarga'), 0) AS recargas,
          COUNT(*) FILTER (WHERE t.tipo = 'recarga') AS cantidad_recargas
        FROM transacciones t WHERE ${DONDE}`, p),
      pool.query(`SELECT ${DIA} AS dia,
          COALESCE(SUM(t.monto) FILTER (WHERE ${VALIDA}), 0) AS ventas,
          COALESCE(SUM(t.monto) FILTER (WHERE t.tipo = 'recarga'), 0) AS recargas
        FROM transacciones t WHERE ${DONDE} GROUP BY 1 ORDER BY 1`, p),
      pool.query(`SELECT ${DIA} AS dia, t.lugar, SUM(t.monto) AS ventas
        FROM transacciones t WHERE ${DONDE} AND ${VALIDA} GROUP BY 1, 2`, p),
      pool.query(`SELECT t.lugar AS local, SUM(t.monto) AS total, COUNT(*) AS cantidad
        FROM transacciones t WHERE ${DONDE} AND ${VALIDA} GROUP BY 1 ORDER BY 2 DESC`, p),
      // Unidades de verdad (transaccion_items), no veces que aparece el nombre
      pool.query(`SELECT ti.nombre, SUM(ti.cantidad) AS cantidad, SUM(ti.cantidad * ti.precio) AS total
        FROM transacciones t JOIN transaccion_items ti ON ti.transaccion_id = t.id
        WHERE ${DONDE} AND ${VALIDA} GROUP BY 1 ORDER BY 2 DESC LIMIT 10`, p),
      // Curso del alumno por su id (antes se buscaba por nombre: dos alumnos con el mismo nombre se mezclaban)
      pool.query(`SELECT COALESCE(NULLIF(a.curso, ''), 'Sin curso') AS curso, SUM(t.monto) AS total, COUNT(*) AS cantidad
        FROM transacciones t LEFT JOIN alumnos a ON a.id = t.alumno_id
        WHERE ${DONDE} AND ${VALIDA} GROUP BY 1 ORDER BY 2 DESC`, p),
      pool.query(`SELECT a.id, COALESCE(a.nombre, 'Alumno borrado') AS nombre, SUM(t.monto) AS total
        FROM transacciones t LEFT JOIN alumnos a ON a.id = t.alumno_id
        WHERE ${DONDE} AND ${VALIDA} GROUP BY 1, 2 ORDER BY 3 DESC LIMIT 8`, p),
    ]);

    const t = tot.rows[0];
    res.json({
      desde, hasta, lugar,
      totales: {
        ventas: n(t.ventas), cantidad_ventas: n(t.cantidad_ventas), sin_conexion: n(t.sin_conexion), anuladas: n(t.anuladas),
        recargas: n(t.recargas), cantidad_recargas: n(t.cantidad_recargas),
      },
      por_dia: dias.rows.map(d => ({ dia: d.dia, ventas: n(d.ventas), recargas: n(d.recargas) })),
      por_dia_local: diasLocal.rows.map(d => ({ dia: d.dia, local: d.lugar, ventas: n(d.ventas) })),
      por_local: locales.rows.map(l => ({ local: l.local, total: n(l.total), cantidad: n(l.cantidad) })),
      por_producto: productos.rows.map(x => ({ nombre: x.nombre, cantidad: n(x.cantidad), total: n(x.total) })),
      por_curso: cursos.rows.map(c => ({ curso: c.curso, total: n(c.total), cantidad: n(c.cantidad) })),
      top_alumnos: alumnos.rows.map(a => ({ id: a.id, nombre: a.nombre, total: n(a.total) })),
    });
  } catch (err) {
    console.error('Reportes (resumen):', err.message);
    res.status(500).json({ error: 'No se pudo calcular el reporte' });
  }
};

module.exports = { getResumen };
