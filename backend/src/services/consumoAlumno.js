// Consumo de un alumno para las reglas de la familia: unidades compradas hoy
// por categoría y gasto de la semana. Las compras anuladas no cuentan.
const AR = "'America/Argentina/Buenos_Aires'";
const FECHA_AR_SQL = col => `(${col} AT TIME ZONE 'UTC' AT TIME ZONE ${AR})`;
const COMPRA_VALIDA = "t.tipo = 'compra' AND t.descripcion NOT LIKE '[ANULADA]%'";

// Unidades compradas hoy por categoría (para "máximo 1 bebida por día")
const compradoHoyPorCategoria = async (db, alumnoId) => {
  const r = await db.query(
    `SELECT ti.categoria, SUM(ti.cantidad)::int AS cantidad
     FROM transaccion_items ti JOIN transacciones t ON t.id = ti.transaccion_id
     WHERE t.alumno_id = $1 AND ${COMPRA_VALIDA}
       AND ${FECHA_AR_SQL('t.fecha')}::date = (NOW() AT TIME ZONE ${AR})::date
     GROUP BY ti.categoria`,
    [alumnoId]
  );
  return Object.fromEntries(r.rows.map(x => [x.categoria, x.cantidad]));
};

// Lo gastado desde el lunes (para el límite semanal)
const gastoDeLaSemana = async (db, alumnoId) => {
  const r = await db.query(
    `SELECT COALESCE(SUM(t.monto), 0) AS total FROM transacciones t
     WHERE t.alumno_id = $1 AND ${COMPRA_VALIDA}
       AND ${FECHA_AR_SQL('t.fecha')} >= date_trunc('week', NOW() AT TIME ZONE ${AR})`,
    [alumnoId]
  );
  return Number(r.rows[0].total);
};

module.exports = { compradoHoyPorCategoria, gastoDeLaSemana };
