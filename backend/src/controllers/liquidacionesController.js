/**
 * Liquidaciones a concesionarios: la plata de las recargas entra a la cuenta
 * del colegio y, por cada zona que opera un concesionario, el colegio le paga
 * lo vendido (menos anulaciones) menos su canon.
 *
 * Cada liquidación se queda con las ventas y anulaciones de la zona que
 * todavía no estaban liquidadas, hasta la fecha de corte. Así una venta sin
 * conexión que se sube tarde, o una anulación de una venta ya liquidada,
 * entra en la próxima.
 */
const pool = require('../db/conexion');
const { registrar } = require('./auditoriaController');
const { enviarEmailLiquidacion } = require('../services/emailService');

const ZONA = 'America/Argentina/Buenos_Aires';
const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const hoyAR = () => new Date().toLocaleDateString('en-CA', { timeZone: ZONA });
const pesos = n => '$' + Math.round(Number(n) || 0).toLocaleString('es-AR');
const redondear = n => Math.round(n * 100) / 100;
const texto = (v, max) => (v == null || String(v).trim() === '' ? null : String(v).trim().slice(0, max));
const FIN_DEL_DIA = `(($3::date + 1)::timestamp AT TIME ZONE '${ZONA}' AT TIME ZONE 'UTC')`;

// Lo que falta liquidar de una zona hasta el corte (incluido)
const pendiente = async (db, colegioId, local, hasta) => {
  const r = await db.query(
    `SELECT
       COALESCE(SUM(monto) FILTER (WHERE tipo = 'compra'), 0) AS ventas,
       COUNT(*) FILTER (WHERE tipo = 'compra') AS cantidad_ventas,
       COALESCE(SUM(monto) FILTER (WHERE tipo = 'anulacion'), 0) AS anulaciones,
       COUNT(*) FILTER (WHERE tipo = 'anulacion') AS cantidad_anulaciones,
       to_char(MIN(fecha AT TIME ZONE 'UTC' AT TIME ZONE '${ZONA}')::date, 'YYYY-MM-DD') AS desde
     FROM transacciones
     WHERE colegio_id = $1 AND lugar = $2 AND tipo IN ('compra', 'anulacion')
       AND liquidacion_id IS NULL AND fecha < ${FIN_DEL_DIA}`,
    [colegioId, local, hasta]
  );
  const p = r.rows[0];
  return {
    desde: p.desde, hasta,
    ventas: Number(p.ventas), cantidad_ventas: Number(p.cantidad_ventas),
    anulaciones: Number(p.anulaciones), cantidad_anulaciones: Number(p.cantidad_anulaciones),
    neto: Number(p.ventas) - Number(p.anulaciones),
  };
};

const totales = (p, canonPct, ajuste) => {
  const canon = redondear(p.neto * Number(canonPct) / 100);
  return { canon_pct: Number(canonPct), canon, ajuste, total: redondear(p.neto - canon + ajuste) };
};

const leerHasta = valor => {
  const hasta = FECHA.test(valor || '') ? valor : hoyAR();
  return hasta > hoyAR() ? null : hasta;
};

// Zonas del colegio con quién las opera y lo que tienen sin liquidar a hoy
const getZonas = async (req, res) => {
  const colegioId = req.empleado.colegio_id;
  try {
    const r = await pool.query(
      `SELECT l.nombre AS local, z.operador, z.contacto, z.email, z.telefono, z.cuenta_pago, z.canon_pct,
         (SELECT MAX(hasta) FROM liquidaciones q WHERE q.colegio_id = $1 AND q.local = l.nombre) AS ultima_hasta,
         (SELECT COUNT(*) FROM liquidaciones q WHERE q.colegio_id = $1 AND q.local = l.nombre AND q.estado = 'pendiente') AS por_pagar
       FROM locales l
       LEFT JOIN zonas_operador z ON z.colegio_id = l.colegio_id AND z.local = l.nombre
       WHERE l.colegio_id = $1 AND l.activo
       ORDER BY l.nombre`,
      [colegioId]
    );
    const zonas = await Promise.all(r.rows.map(async z => ({
      ...z,
      canon_pct: z.canon_pct == null ? null : Number(z.canon_pct),
      por_pagar: Number(z.por_pagar),
      ultima_hasta: z.ultima_hasta ? z.ultima_hasta.toISOString().slice(0, 10) : null,
      pendiente: z.operador ? await pendiente(pool, colegioId, z.local, hoyAR()) : null,
    })));
    res.json(zonas);
  } catch (err) {
    console.error('Liquidaciones (zonas):', err.message);
    res.status(500).json({ error: 'Error del servidor' });
  }
};

// Quién opera la zona; sin operador, la zona vuelve a ser del colegio
const guardarZona = async (req, res) => {
  const colegioId = req.empleado.colegio_id;
  const local = String(req.params.local || '');
  const operador = texto(req.body.operador, 120);
  try {
    const existe = await pool.query('SELECT 1 FROM locales WHERE colegio_id = $1 AND nombre = $2', [colegioId, local]);
    if (!existe.rows.length) return res.status(404).json({ error: 'Zona no encontrada' });
    if (!operador) {
      await pool.query('DELETE FROM zonas_operador WHERE colegio_id = $1 AND local = $2', [colegioId, local]);
      await registrar(req.empleado.id, colegioId, 'Zona operada por el colegio', local);
      return res.json({ local, operador: null });
    }
    const canon = Number(req.body.canon_pct ?? 0);
    if (!Number.isFinite(canon) || canon < 0 || canon > 100) return res.status(400).json({ error: 'El canon tiene que ser un porcentaje entre 0 y 100' });
    const email = texto(req.body.email, 150);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'El email no es válido' });
    const r = await pool.query(
      `INSERT INTO zonas_operador (colegio_id, local, operador, contacto, email, telefono, cuenta_pago, canon_pct)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (colegio_id, local) DO UPDATE SET operador = $3, contacto = $4, email = $5, telefono = $6, cuenta_pago = $7, canon_pct = $8
       RETURNING *`,
      [colegioId, local, operador, texto(req.body.contacto, 120), email, texto(req.body.telefono, 40), texto(req.body.cuenta_pago, 120), canon]
    );
    await registrar(req.empleado.id, colegioId, 'Concesionario de zona', `${local}: ${operador}, canon ${canon}%`);
    res.json(r.rows[0]);
  } catch (err) {
    console.error('Liquidaciones (zona):', err.message);
    res.status(500).json({ error: 'Error del servidor' });
  }
};

// Cómo quedaría la liquidación, sin crearla
const getVistaPrevia = async (req, res) => {
  const colegioId = req.empleado.colegio_id;
  const local = String(req.query.local || '');
  const hasta = leerHasta(req.query.hasta);
  if (!hasta) return res.status(400).json({ error: 'La fecha de corte no puede ser futura' });
  try {
    const z = await pool.query('SELECT * FROM zonas_operador WHERE colegio_id = $1 AND local = $2', [colegioId, local]);
    if (!z.rows.length) return res.status(400).json({ error: 'Esta zona la opera el colegio: no se liquida' });
    const ajuste = Number(req.query.ajuste) || 0;
    const p = await pendiente(pool, colegioId, local, hasta);
    res.json({ local, operador: z.rows[0].operador, ...p, ...totales(p, z.rows[0].canon_pct, ajuste) });
  } catch (err) {
    console.error('Liquidaciones (vista previa):', err.message);
    res.status(500).json({ error: 'Error del servidor' });
  }
};

const crearLiquidacion = async (req, res) => {
  const colegioId = req.empleado.colegio_id;
  const local = String(req.body.local || '');
  const hasta = leerHasta(req.body.hasta);
  if (!hasta) return res.status(400).json({ error: 'La fecha de corte no puede ser futura' });
  const ajuste = redondear(Number(req.body.ajuste) || 0);
  const ajusteMotivo = texto(req.body.ajuste_motivo, 200);
  if (ajuste && !ajusteMotivo) return res.status(400).json({ error: 'Poné el motivo del ajuste' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Bloquea la zona: dos liquidaciones a la vez no pueden tomar las mismas ventas
    const z = await client.query('SELECT * FROM zonas_operador WHERE colegio_id = $1 AND local = $2 FOR UPDATE', [colegioId, local]);
    if (!z.rows.length) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Esta zona la opera el colegio: no se liquida' }); }
    const zona = z.rows[0];
    const p = await pendiente(client, colegioId, local, hasta);
    if (!p.cantidad_ventas && !p.cantidad_anulaciones) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'No hay ventas sin liquidar en esta zona hasta esa fecha' }); }
    const t = totales(p, zona.canon_pct, ajuste);
    const liq = await client.query(
      `INSERT INTO liquidaciones (colegio_id, local, operador, desde, hasta, ventas, cantidad_ventas, anulaciones, cantidad_anulaciones,
         canon_pct, canon, ajuste, ajuste_motivo, total, creado_por)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING *, to_char(desde, 'YYYY-MM-DD') AS desde, to_char(hasta, 'YYYY-MM-DD') AS hasta`,
      [colegioId, local, zona.operador, p.desde, hasta, p.ventas, p.cantidad_ventas, p.anulaciones, p.cantidad_anulaciones,
        t.canon_pct, t.canon, t.ajuste, ajusteMotivo, t.total, req.empleado.id]
    );
    const id = liq.rows[0].id;
    const marcadas = await client.query(
      `UPDATE transacciones SET liquidacion_id = $4
       WHERE colegio_id = $1 AND lugar = $2 AND tipo IN ('compra', 'anulacion')
         AND liquidacion_id IS NULL AND fecha < ${FIN_DEL_DIA}`,
      [colegioId, local, hasta, id]
    );
    if (marcadas.rowCount !== p.cantidad_ventas + p.cantidad_anulaciones) throw new Error('Las ventas cambiaron mientras se liquidaba');
    await client.query('COMMIT');
    await registrar(req.empleado.id, colegioId, 'Liquidación creada', `N° ${id} · ${local} (${zona.operador}) hasta ${hasta}: ${pesos(t.total)}`);
    res.status(201).json(liq.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Liquidaciones (crear):', err.message);
    res.status(500).json({ error: 'No se pudo crear la liquidación. Probá de nuevo.' });
  } finally { client.release(); }
};

const getLiquidaciones = async (req, res) => {
  const colegioId = req.empleado.colegio_id;
  const local = req.query.local && req.query.local !== 'Todos' ? String(req.query.local) : null;
  try {
    const r = await pool.query(
      `SELECT l.*, to_char(l.desde, 'YYYY-MM-DD') AS desde, to_char(l.hasta, 'YYYY-MM-DD') AS hasta
       FROM liquidaciones l
       WHERE l.colegio_id = $1 AND ($2::text IS NULL OR l.local = $2)
       ORDER BY l.creado_en DESC LIMIT 200`,
      [colegioId, local]
    );
    res.json(r.rows);
  } catch (err) {
    console.error('Liquidaciones (lista):', err.message);
    res.status(500).json({ error: 'Error del servidor' });
  }
};

// Detalle para revisar, imprimir o mandar: por día y por producto
const getLiquidacion = async (req, res) => {
  const colegioId = req.empleado.colegio_id;
  try {
    const r = await pool.query(
      `SELECT l.*, to_char(l.desde, 'YYYY-MM-DD') AS desde, to_char(l.hasta, 'YYYY-MM-DD') AS hasta,
         z.contacto, z.email, z.telefono, z.cuenta_pago,
         c.nombre AS creado_por_nombre, p.nombre AS pagada_por_nombre
       FROM liquidaciones l
       LEFT JOIN zonas_operador z ON z.colegio_id = l.colegio_id AND z.local = l.local
       LEFT JOIN empleados c ON c.id = l.creado_por
       LEFT JOIN empleados p ON p.id = l.pagada_por
       WHERE l.id = $1 AND l.colegio_id = $2`,
      [req.params.id, colegioId]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Liquidación no encontrada' });
    const [dias, productos] = await Promise.all([
      pool.query(
        `SELECT to_char((fecha AT TIME ZONE 'UTC' AT TIME ZONE '${ZONA}')::date, 'YYYY-MM-DD') AS dia,
           COUNT(*) FILTER (WHERE tipo = 'compra') AS ventas,
           COALESCE(SUM(monto) FILTER (WHERE tipo = 'compra'), 0) AS vendido,
           COALESCE(SUM(monto) FILTER (WHERE tipo = 'anulacion'), 0) AS anulado
         FROM transacciones WHERE liquidacion_id = $1 GROUP BY 1 ORDER BY 1`,
        [req.params.id]
      ),
      // Importe por producto con el descuento de cada venta repartido entre sus productos
      pool.query(
        `WITH lineas AS (
           SELECT ti.nombre, ti.cantidad,
             ti.cantidad * ti.precio * t.monto / NULLIF(SUM(ti.cantidad * ti.precio) OVER (PARTITION BY t.id), 0) AS importe
           FROM transacciones t JOIN transaccion_items ti ON ti.transaccion_id = t.id
           WHERE t.liquidacion_id = $1 AND t.tipo = 'compra' AND COALESCE(t.descripcion, '') NOT LIKE '[ANULADA]%'
         )
         SELECT nombre, SUM(cantidad) AS unidades, COALESCE(SUM(importe), 0) AS importe
         FROM lineas GROUP BY nombre ORDER BY SUM(importe) DESC NULLS LAST`,
        [req.params.id]
      ),
    ]);
    res.json({
      ...r.rows[0],
      por_dia: dias.rows.map(d => ({ dia: d.dia, ventas: Number(d.ventas), vendido: Number(d.vendido), anulado: Number(d.anulado) })),
      por_producto: productos.rows.map(p => ({ nombre: p.nombre, unidades: Number(p.unidades), importe: Number(p.importe) })),
    });
  } catch (err) {
    console.error('Liquidaciones (detalle):', err.message);
    res.status(500).json({ error: 'Error del servidor' });
  }
};

const pagarLiquidacion = async (req, res) => {
  const colegioId = req.empleado.colegio_id;
  try {
    const r = await pool.query(
      `UPDATE liquidaciones SET estado = 'pagada', pagada_en = NOW() AT TIME ZONE 'UTC', pagada_por = $3, referencia_pago = $4
       WHERE id = $1 AND colegio_id = $2 AND estado = 'pendiente' RETURNING *, to_char(desde, 'YYYY-MM-DD') AS desde, to_char(hasta, 'YYYY-MM-DD') AS hasta`,
      [req.params.id, colegioId, req.empleado.id, texto(req.body.referencia, 200)]
    );
    if (!r.rows.length) return res.status(400).json({ error: 'La liquidación no existe o ya estaba pagada' });
    const l = r.rows[0];
    await registrar(req.empleado.id, colegioId, 'Liquidación pagada', `N° ${l.id} · ${l.local} (${l.operador}): ${pesos(l.total)}${l.referencia_pago ? ` · ${l.referencia_pago}` : ''}`);
    res.json(l);
  } catch (err) {
    console.error('Liquidaciones (pagar):', err.message);
    res.status(500).json({ error: 'Error del servidor' });
  }
};

// Deshacer una liquidación sin pagar: sus ventas vuelven a quedar sin liquidar
const eliminarLiquidacion = async (req, res) => {
  const colegioId = req.empleado.colegio_id;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const r = await client.query(`DELETE FROM liquidaciones WHERE id = $1 AND colegio_id = $2 AND estado = 'pendiente' RETURNING *`, [req.params.id, colegioId]);
    if (!r.rows.length) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Solo se puede deshacer una liquidación que todavía no se pagó' }); }
    await client.query('UPDATE transacciones SET liquidacion_id = NULL WHERE liquidacion_id = $1 AND colegio_id = $2', [req.params.id, colegioId]);
    await client.query('COMMIT');
    const l = r.rows[0];
    await registrar(req.empleado.id, colegioId, 'Liquidación deshecha', `N° ${l.id} · ${l.local} (${l.operador}): ${pesos(l.total)}`);
    res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Liquidaciones (deshacer):', err.message);
    res.status(500).json({ error: 'Error del servidor' });
  } finally { client.release(); }
};

const enviarLiquidacion = async (req, res) => {
  const colegioId = req.empleado.colegio_id;
  try {
    const r = await pool.query(
      `SELECT l.*, to_char(l.desde, 'YYYY-MM-DD') AS desde, to_char(l.hasta, 'YYYY-MM-DD') AS hasta, z.email
       FROM liquidaciones l LEFT JOIN zonas_operador z ON z.colegio_id = l.colegio_id AND z.local = l.local
       WHERE l.id = $1 AND l.colegio_id = $2`,
      [req.params.id, colegioId]
    );
    const liq = r.rows[0];
    if (!liq) return res.status(404).json({ error: 'Liquidación no encontrada' });
    if (!liq.email) return res.status(400).json({ error: 'El concesionario no tiene email cargado' });
    const ok = await enviarEmailLiquidacion({ colegioId, email: liq.email, liq });
    if (!ok) return res.status(502).json({ error: 'No se pudo enviar el email' });
    await registrar(req.empleado.id, colegioId, 'Liquidación enviada', `N° ${liq.id} a ${liq.email}`);
    res.json({ ok: true, email: liq.email });
  } catch (err) {
    console.error('Liquidaciones (enviar):', err.message);
    res.status(500).json({ error: 'Error del servidor' });
  }
};

module.exports = { getZonas, guardarZona, getVistaPrevia, crearLiquidacion, getLiquidaciones, getLiquidacion, pagarLiquidacion, eliminarLiquidacion, enviarLiquidacion };
