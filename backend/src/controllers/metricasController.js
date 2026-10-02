/**
 * Métricas de la plataforma para el superadmin: uso, dinero y velocidad de
 * atención de todos los colegios (o de uno), en un período.
 *
 * Fechas guardadas en UTC sin zona; el período se toma en hora argentina.
 * Las ventas anuladas no cuentan.
 */
const pool = require('../db/conexion');

const ZONA = 'America/Argentina/Buenos_Aires';
const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const hoyAR = () => new Date().toLocaleDateString('en-CA', { timeZone: ZONA });
const num = v => (v == null ? null : Number(v));

// Movimientos del período: ventas válidas y recargas, con la fecha en hora argentina
const TX = `
  tx AS (
    SELECT t.colegio_id, t.alumno_id, t.tipo, t.monto, t.duracion_ms, t.offline,
      (t.fecha AT TIME ZONE 'UTC' AT TIME ZONE '${ZONA}') AS f
    FROM transacciones t
    WHERE ($3::int IS NULL OR t.colegio_id = $3)
      AND t.fecha >= ($1::date::timestamp AT TIME ZONE '${ZONA}' AT TIME ZONE 'UTC')
      AND t.fecha <  (($2::date + 1)::timestamp AT TIME ZONE '${ZONA}' AT TIME ZONE 'UTC')
      AND t.tipo IN ('compra', 'recarga')
      AND NOT (t.tipo = 'compra' AND COALESCE(t.descripcion, '') LIKE '[ANULADA]%')
  )`;

const getMetricas = async (req, res) => {
  const hasta = FECHA.test(req.query.hasta || '') ? req.query.hasta : hoyAR();
  let desde = FECHA.test(req.query.desde || '') ? req.query.desde : null;
  if (!desde) {
    const d = new Date(hasta + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - 29);
    desde = d.toISOString().slice(0, 10);
  }
  if (desde > hasta) return res.status(400).json({ error: 'El período es inválido' });
  const colegioId = Number.parseInt(req.query.colegio_id, 10) || null;
  const params = [desde, hasta, colegioId];

  try {
    const [agregados, picos, colegios, alumnos, comisiones, serie, horas, duraciones] = await Promise.all([
      // Por colegio y total (la fila con colegio_id NULL es el total)
      pool.query(`WITH ${TX}
        SELECT colegio_id,
          COUNT(*) FILTER (WHERE tipo = 'compra') AS ventas,
          COALESCE(SUM(monto) FILTER (WHERE tipo = 'compra'), 0) AS vendido,
          COUNT(DISTINCT alumno_id) FILTER (WHERE tipo = 'compra') AS alumnos_compraron,
          COUNT(*) FILTER (WHERE tipo = 'recarga') AS recargas,
          COALESCE(SUM(monto) FILTER (WHERE tipo = 'recarga'), 0) AS recargado,
          COUNT(DISTINCT alumno_id) FILTER (WHERE tipo = 'recarga') AS alumnos_recargados,
          COUNT(DISTINCT f::date) FILTER (WHERE tipo = 'compra') AS dias_con_ventas,
          COUNT(*) FILTER (WHERE tipo = 'compra' AND offline) AS ventas_offline,
          COUNT(duracion_ms) FILTER (WHERE tipo = 'compra') AS ventas_medidas,
          percentile_cont(0.5) WITHIN GROUP (ORDER BY duracion_ms) FILTER (WHERE tipo = 'compra') AS duracion_mediana,
          percentile_cont(0.9) WITHIN GROUP (ORDER BY duracion_ms) FILTER (WHERE tipo = 'compra') AS duracion_p90
        FROM tx GROUP BY ROLLUP (colegio_id)`, params),
      // Pico de ventas en un mismo minuto, por colegio
      pool.query(`WITH ${TX}
        SELECT colegio_id, MAX(n) AS pico_minuto FROM (
          SELECT colegio_id, date_trunc('minute', f) AS m, COUNT(*) AS n FROM tx WHERE tipo = 'compra' GROUP BY 1, 2
        ) x GROUP BY colegio_id`, params),
      pool.query(`SELECT id, nombre, activo, creado_en FROM colegios WHERE ($1::int IS NULL OR id = $1) ORDER BY nombre`, [colegioId]),
      // Situación actual de los alumnos (no depende del período)
      pool.query(`
        SELECT a.colegio_id,
          COUNT(*) FILTER (WHERE a.activo) AS activos,
          COUNT(*) FILTER (WHERE a.activo AND EXISTS (SELECT 1 FROM padres_alumnos pa WHERE pa.alumno_id = a.id)) AS con_familia,
          COALESCE(SUM(a.saldo) FILTER (WHERE a.activo), 0) AS saldo_total
        FROM alumnos a WHERE ($1::int IS NULL OR a.colegio_id = $1) GROUP BY a.colegio_id`, [colegioId]),
      pool.query(`
        SELECT colegio_id, COALESCE(SUM(comision), 0) AS comision, COUNT(*) AS pagos
        FROM pagos
        WHERE estado = 'acreditado' AND ($3::int IS NULL OR colegio_id = $3)
          AND creado_en >= ($1::date::timestamp AT TIME ZONE '${ZONA}' AT TIME ZONE 'UTC')
          AND creado_en <  (($2::date + 1)::timestamp AT TIME ZONE '${ZONA}' AT TIME ZONE 'UTC')
        GROUP BY colegio_id`, params),
      pool.query(`WITH ${TX}
        SELECT to_char(f::date, 'YYYY-MM-DD') AS dia,
          COUNT(*) FILTER (WHERE tipo = 'compra') AS ventas,
          COALESCE(SUM(monto) FILTER (WHERE tipo = 'compra'), 0) AS vendido,
          COALESCE(SUM(monto) FILTER (WHERE tipo = 'recarga'), 0) AS recargado
        FROM tx GROUP BY 1 ORDER BY 1`, params),
      pool.query(`WITH ${TX}
        SELECT EXTRACT(HOUR FROM f)::int AS hora, COUNT(*) AS ventas
        FROM tx WHERE tipo = 'compra' GROUP BY 1 ORDER BY 1`, params),
      // Distribución del tiempo por venta
      pool.query(`WITH ${TX}
        SELECT CASE WHEN duracion_ms < 5000 THEN 0 WHEN duracion_ms < 10000 THEN 1 WHEN duracion_ms < 20000 THEN 2 WHEN duracion_ms < 40000 THEN 3 ELSE 4 END AS rango,
          COUNT(*) AS ventas
        FROM tx WHERE tipo = 'compra' AND duracion_ms IS NOT NULL GROUP BY 1 ORDER BY 1`, params),
    ]);

    const porId = new Map(agregados.rows.filter(r => r.colegio_id != null).map(r => [r.colegio_id, r]));
    const picoDe = new Map(picos.rows.map(r => [r.colegio_id, Number(r.pico_minuto)]));
    const alumnosDe = new Map(alumnos.rows.map(r => [r.colegio_id, r]));
    const comisionDe = new Map(comisiones.rows.map(r => [r.colegio_id, r]));

    const armar = (a = {}, al = {}, com = {}, pico = 0) => {
      const ventas = Number(a.ventas || 0);
      const recargas = Number(a.recargas || 0);
      const activos = Number(al.activos || 0);
      return {
        alumnos_activos: activos,
        alumnos_con_familia: Number(al.con_familia || 0),
        alumnos_compraron: Number(a.alumnos_compraron || 0),
        adopcion: activos ? Number(al.con_familia || 0) / activos : null,
        uso: activos ? Number(a.alumnos_compraron || 0) / activos : null,
        ventas,
        vendido: Number(a.vendido || 0),
        ticket_promedio: ventas ? Number(a.vendido) / ventas : null,
        ventas_por_dia: Number(a.dias_con_ventas) ? ventas / Number(a.dias_con_ventas) : null,
        ventas_offline: Number(a.ventas_offline || 0),
        recargas,
        recargado: Number(a.recargado || 0),
        recarga_promedio: recargas ? Number(a.recargado) / recargas : null,
        recargas_por_alumno: Number(a.alumnos_recargados) ? recargas / Number(a.alumnos_recargados) : null,
        saldo_total: Number(al.saldo_total || 0),
        saldo_promedio: activos ? Number(al.saldo_total || 0) / activos : null,
        comision: Number(com.comision || 0),
        pico_minuto: pico,
        ventas_medidas: Number(a.ventas_medidas || 0),
        duracion_mediana: num(a.duracion_mediana),
        duracion_p90: num(a.duracion_p90),
      };
    };

    const por_colegio = colegios.rows.map(c => ({
      id: c.id, nombre: c.nombre, activo: c.activo,
      ...armar(porId.get(c.id), alumnosDe.get(c.id), comisionDe.get(c.id), picoDe.get(c.id) || 0),
    }));
    const sumar = (m, campo) => [...m.values()].reduce((s, r) => s + Number(r[campo] || 0), 0);
    const total = armar(
      agregados.rows.find(r => r.colegio_id == null),
      { activos: sumar(alumnosDe, 'activos'), con_familia: sumar(alumnosDe, 'con_familia'), saldo_total: sumar(alumnosDe, 'saldo_total') },
      { comision: sumar(comisionDe, 'comision') },
      Math.max(0, ...picoDe.values()),
    );

    const rangos = ['< 5 s', '5–10 s', '10–20 s', '20–40 s', '40 s o más'];
    const cuenta = new Map(duraciones.rows.map(r => [Number(r.rango), Number(r.ventas)]));
    const ventasHora = new Map(horas.rows.map(r => [r.hora, Number(r.ventas)]));

    res.json({
      desde, hasta, colegio_id: colegioId,
      total,
      por_colegio,
      serie: serie.rows.map(r => ({ dia: r.dia, ventas: Number(r.ventas), vendido: Number(r.vendido), recargado: Number(r.recargado) })),
      por_hora: Array.from({ length: 24 }, (_, hora) => ({ hora, ventas: ventasHora.get(hora) || 0 })),
      duraciones: rangos.map((rango, i) => ({ rango, ventas: cuenta.get(i) || 0 })),
    });
  } catch (err) {
    console.error('Métricas:', err.message);
    res.status(500).json({ error: 'No se pudieron calcular las métricas' });
  }
};

module.exports = { getMetricas };
