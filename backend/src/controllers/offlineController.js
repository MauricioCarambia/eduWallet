// Modo offline del POS.
//
// GET  /offline/datos   → copia de lo necesario para vender sin internet: productos,
//                         alumnos (saldo, reglas, alergias) y las credenciales como
//                         huellas SHA-256 (el POS no guarda los códigos en claro).
// POST /offline/ventas  → sube las ventas hechas sin internet. Cada una trae su
//                         id_venta: si ya estaba (se cortó a mitad del cobro), se
//                         toma una sola vez. La venta ya ocurrió, así que no se
//                         rechaza por saldo o límites: el saldo puede quedar
//                         negativo y se descuenta de la próxima recarga.

const crypto = require('crypto');
const pool = require('../db/conexion');
const { registrar } = require('./auditoriaController');
const { duracionVenta } = require('../services/duracionVenta');
const { notificarCompra, notificarSaldoNegativo } = require('../services/notificacionesService');
const { normalizarCodigo } = require('../services/credencialesService');
const { resumenReglas } = require('../services/reglasCompra');

const AR = "'America/Argentina/Buenos_Aires'";
const COMPRA_VALIDA = "t.tipo = 'compra' AND t.descripcion NOT LIKE '[ANULADA]%'";
const MAX_VENTAS = 500;
const ID_VENTA = /^[A-Za-z0-9-]{8,64}$/;

// Misma huella que calcula el POS (utils/offline.js)
const huella = valor => crypto.createHash('sha256').update('koletap:' + valor).digest('hex');

const getDatosOffline = async (req, res) => {
  const colegioId = req.empleado.colegio_id;
  try {
    const [alumnos, productos, conf, hoy, semana, zonas] = await Promise.all([
      pool.query('SELECT * FROM alumnos WHERE colegio_id = $1 ORDER BY nombre', [colegioId]),
      pool.query('SELECT * FROM productos WHERE activo = true AND colegio_id = $1 ORDER BY local, nombre', [colegioId]),
      pool.query('SELECT tope_offline FROM configuracion WHERE colegio_id = $1', [colegioId]),
      pool.query(
        `SELECT t.alumno_id, ti.categoria, SUM(ti.cantidad)::int AS cantidad
         FROM transaccion_items ti JOIN transacciones t ON t.id = ti.transaccion_id
         WHERE t.colegio_id = $1 AND ${COMPRA_VALIDA}
           AND (t.fecha AT TIME ZONE 'UTC' AT TIME ZONE ${AR})::date = (NOW() AT TIME ZONE ${AR})::date
         GROUP BY 1, 2`, [colegioId]),
      pool.query(
        `SELECT t.alumno_id, SUM(t.monto) AS total FROM transacciones t
         WHERE t.colegio_id = $1 AND ${COMPRA_VALIDA}
           AND (t.fecha AT TIME ZONE 'UTC' AT TIME ZONE ${AR}) >= date_trunc('week', NOW() AT TIME ZONE ${AR})
         GROUP BY 1`, [colegioId]),
      pool.query(
        `SELECT t.alumno_id, t.lugar,
                COALESCE(SUM(t.monto) FILTER (WHERE (t.fecha AT TIME ZONE 'UTC' AT TIME ZONE ${AR})::date = (NOW() AT TIME ZONE ${AR})::date), 0) AS hoy,
                COALESCE(SUM(t.monto), 0) AS semana
         FROM transacciones t
         WHERE t.colegio_id = $1 AND ${COMPRA_VALIDA}
           AND (t.fecha AT TIME ZONE 'UTC' AT TIME ZONE ${AR}) >= date_trunc('week', NOW() AT TIME ZONE ${AR})
         GROUP BY 1, 2`, [colegioId]),
    ]);

    const hoyPorAlumno = {};
    for (const r of hoy.rows) (hoyPorAlumno[r.alumno_id] ??= {})[r.categoria] = r.cantidad;
    const semanaPorAlumno = Object.fromEntries(semana.rows.map(r => [r.alumno_id, Number(r.total)]));
    const zonaPorAlumno = {};
    for (const r of zonas.rows) (zonaPorAlumno[r.alumno_id] ??= {})[r.lugar] = { hoy: Number(r.hoy), semana: Number(r.semana) };

    const claves = [];
    const lista = alumnos.rows.map(a => {
      const qr = normalizarCodigo(a.qr);
      if (qr.length >= 6) claves.push([huella(qr), a.id, 'qr']);
      for (const c of a.nfc_claves || []) claves.push([huella(String(c).toUpperCase()), a.id, 'tarjeta']);
      // sin los códigos en claro ni datos que el POS no necesita
      const { qr: _qr, nfc_claves: _nfc, nfc_uid: _uid, codigo_vinculacion: _cod, ...resto } = a;
      return {
        ...resto,
        control: {
          restricciones: a.restricciones || {},
          limite_semanal: a.limite_semanal,
          alergenos: a.alergenos || [],
          bloquear_alergenos: a.bloquear_alergenos,
          hoy_por_categoria: hoyPorAlumno[a.id] || {},
          gasto_semana: a.limite_semanal != null ? (semanaPorAlumno[a.id] || 0) : null,
          gasto_zona: zonaPorAlumno[a.id] || {},
          resumen: resumenReglas(a),
        },
      };
    });

    res.json({
      generado: new Date().toISOString(),
      tope_offline: Number(conf.rows[0]?.tope_offline ?? 5000),
      productos: productos.rows,
      alumnos: lista,
      claves,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
};

// Una venta hecha sin internet. Devuelve el resultado para el POS.
const sincronizarUna = async (v, req) => {
  const colegioId = req.empleado.colegio_id;
  const id_venta = String(v?.id_venta ?? '');
  if (!ID_VENTA.test(id_venta)) return { id_venta, estado: 'error', error: 'Venta sin número válido' };
  const items = Array.isArray(v.items) ? v.items : [];
  if (items.length === 0 || items.some(i => !Number.isInteger(Number(i.qty)) || Number(i.qty) <= 0 || Number(i.qty) > 100)) {
    return { id_venta, estado: 'error', error: 'Carrito inválido' };
  }
  const descuento = Number(v.descuento) || 0;
  if (descuento < 0 || descuento > 100) return { id_venta, estado: 'error', error: 'Descuento inválido' };

  // Hora en que se vendió (la del POS); si viene rara, la de ahora
  let fecha = new Date(v.fecha);
  if (Number.isNaN(fecha.getTime()) || fecha.getTime() > Date.now() + 5 * 60 * 1000) fecha = new Date();

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const ya = await client.query('SELECT id FROM transacciones WHERE colegio_id = $1 AND id_venta = $2', [colegioId, id_venta]);
    if (ya.rows.length) { await client.query('ROLLBACK'); return { id_venta, estado: 'ya_estaba', transaccion_id: ya.rows[0].id }; }

    // Zona: la fija del empleado, o la que mandó el POS si existe en el colegio
    let lugar = null;
    if (req.empleado.local_id) {
      lugar = (await client.query('SELECT nombre FROM locales WHERE id = $1 AND colegio_id = $2', [req.empleado.local_id, colegioId])).rows[0]?.nombre;
    } else if (v.lugar) {
      lugar = (await client.query('SELECT nombre FROM locales WHERE colegio_id = $1 AND nombre = $2', [colegioId, v.lugar])).rows[0]?.nombre;
    }
    if (!lugar) { await client.query('ROLLBACK'); return { id_venta, estado: 'error', error: 'Zona inválida' }; }

    const alumno = await client.query('SELECT * FROM alumnos WHERE id = $1 AND colegio_id = $2 FOR UPDATE', [v.alumno_id, colegioId]);
    if (!alumno.rows.length) { await client.query('ROLLBACK'); return { id_venta, estado: 'error', error: 'Alumno no encontrado' }; }
    const a = alumno.rows[0];

    // Precios de la base; un producto borrado mientras tanto se cobra igual (la venta ya pasó)
    const ids = [...new Set(items.map(i => Number(i.id)))];
    const prods = await client.query('SELECT id, nombre, precio, categoria, costo FROM productos WHERE id = ANY($1::int[]) AND colegio_id = $2', [ids, colegioId]);
    const porId = new Map(prods.rows.map(p => [p.id, p]));
    const lineas = items.filter(i => porId.has(Number(i.id))).map(i => ({ ...porId.get(Number(i.id)), qty: Number(i.qty) }));
    if (lineas.length === 0) { await client.query('ROLLBACK'); return { id_venta, estado: 'error', error: 'Productos inexistentes' }; }

    const subtotal = lineas.reduce((s, l) => s + Number(l.precio) * l.qty, 0);
    const total = Math.round(subtotal * (1 - descuento / 100));
    if (total <= 0) { await client.query('ROLLBACK'); return { id_venta, estado: 'error', error: 'Total inválido' }; }

    // Empleado que vendió: el de la venta si es del colegio; si no, el que sincroniza
    let empleadoId = req.empleado.id;
    if (v.empleado_id && Number(v.empleado_id) !== empleadoId) {
      const e = await client.query('SELECT id FROM empleados WHERE id = $1 AND colegio_id = $2', [v.empleado_id, colegioId]);
      if (e.rows.length) empleadoId = e.rows[0].id;
    }

    const desc = lineas.map(l => `${l.nombre}${l.qty > 1 ? ` ×${l.qty}` : ''}`).join(', ');

    // Anulada en el POS antes de subirse: se registra como cualquier venta
    // anulada (la venta marcada [ANULADA] y su anulación, que suman cero), sin
    // tocar saldo, stock ni caja porque nunca se descontaron
    if (v.anulada === true) {
      let anuladaEn = new Date(v.anulada_en);
      if (Number.isNaN(anuladaEn.getTime()) || anuladaEn < fecha) anuladaEn = fecha;
      const tx = await client.query(
        `INSERT INTO transacciones (alumno_id, empleado_id, monto, tipo, lugar, descripcion, colegio_id, fecha, id_venta, offline, sincronizada_en)
         VALUES ($1, $2, $3, 'compra', $4, $5, $6, ($7::timestamptz AT TIME ZONE 'UTC'), $8, true, NOW() AT TIME ZONE 'UTC') RETURNING *`,
        [a.id, empleadoId, total, lugar, '[ANULADA] ' + desc, colegioId, fecha.toISOString(), id_venta]
      );
      await client.query(
        `INSERT INTO transacciones (alumno_id, empleado_id, monto, tipo, lugar, descripcion, colegio_id, fecha, offline, sincronizada_en)
         VALUES ($1, $2, $3, 'anulacion', $4, $5, $6, ($7::timestamptz AT TIME ZONE 'UTC'), true, NOW() AT TIME ZONE 'UTC')`,
        [a.id, empleadoId, total, lugar, `Anulación de venta #${tx.rows[0].id}: ${desc}`, colegioId, anuladaEn.toISOString()]
      );
      await client.query('COMMIT');
      await registrar(empleadoId, colegioId, 'Venta anulada sin conexión', `${a.nombre}: ${desc} ($${total}) en ${lugar}. Se anuló antes de subirse: no se le descontó nada.`);
      return { id_venta, estado: 'ok', anulada: true, transaccion_id: tx.rows[0].id, total: 0 };
    }

    // El gasto de hoy sólo suma si la venta fue hoy
    await client.query(
      `UPDATE alumnos SET saldo = saldo - $1,
         gasto_hoy = gasto_hoy + CASE WHEN ($3::timestamptz AT TIME ZONE ${AR})::date = (NOW() AT TIME ZONE ${AR})::date THEN $1 ELSE 0 END
       WHERE id = $2`,
      [total, a.id, fecha.toISOString()]
    );
    for (const l of lineas) {
      await client.query('UPDATE productos SET stock = GREATEST(0, stock - $1) WHERE id = $2 AND colegio_id = $3', [l.qty, l.id, colegioId]);
    }
    const tx = await client.query(
      `INSERT INTO transacciones (alumno_id, empleado_id, monto, tipo, lugar, descripcion, colegio_id, fecha, id_venta, offline, sincronizada_en, duracion_ms)
       VALUES ($1, $2, $3, 'compra', $4, $5, $6, ($7::timestamptz AT TIME ZONE 'UTC'), $8, true, NOW() AT TIME ZONE 'UTC', $9) RETURNING *`,
      [a.id, empleadoId, total, lugar, desc, colegioId, fecha.toISOString(), id_venta, duracionVenta(v.duracion_ms)]
    );
    for (const l of lineas) {
      await client.query(
        'INSERT INTO transaccion_items (transaccion_id, producto_id, nombre, categoria, cantidad, precio, costo) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [tx.rows[0].id, l.id, l.nombre, l.categoria, l.qty, l.precio, l.costo ?? null]
      );
    }
    // La caja donde se vendió (aunque ya se haya cerrado); si se abrió sin
    // internet viene como "local:<id>" y ya se creó al principio de la sincronización
    const cajaId = String(v.caja_id ?? '').startsWith('local:')
      ? (await client.query('SELECT id FROM cajas WHERE colegio_id = $1 AND id_local = $2', [colegioId, String(v.caja_id).slice(6)])).rows[0]?.id
      : (Number.isInteger(Number(v.caja_id)) ? Number(v.caja_id) : null);
    if (cajaId) {
      await client.query('UPDATE cajas SET ventas = ventas + $1, tx_count = tx_count + 1 WHERE id = $2 AND colegio_id = $3', [total, cajaId, colegioId]);
    }
    await client.query('COMMIT');

    const nuevo = (await pool.query('SELECT id, saldo, gasto_hoy FROM alumnos WHERE id = $1', [a.id])).rows[0];
    if (Number(nuevo.saldo) < 0) {
      await registrar(empleadoId, colegioId, 'Venta sin conexión con saldo negativo',
        `${a.nombre}: ${desc} ($${total}). Saldo ${nuevo.saldo}: se descuenta de la próxima recarga.`);
    }
    notificarCompra({ colegioId, alumno: a, lugar, total, descripcion: desc, saldoAnterior: a.saldo, saldoNuevo: nuevo.saldo, sinConexion: fecha });
    return { id_venta, estado: 'ok', transaccion_id: tx.rows[0].id, total, alumno: nuevo };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    if (err.code === '23505') return { id_venta, estado: 'ya_estaba' }; // llegó dos veces al mismo tiempo
    console.error(err);
    return { id_venta, estado: 'reintentar', error: 'Error del servidor' };
  } finally {
    client.release();
  }
};

// Caja abierta sin internet: se crea una sola vez (por id_local) con la hora real
const sincronizarCaja = async (c, req) => {
  const colegioId = req.empleado.colegio_id;
  const id_local = String(c?.id_local ?? '');
  if (!ID_VENTA.test(id_local)) return { id_local, estado: 'error', error: 'Caja sin número válido' };
  try {
    const ya = await pool.query('SELECT id FROM cajas WHERE colegio_id = $1 AND id_local = $2', [colegioId, id_local]);
    if (ya.rows.length) return { id_local, estado: 'ya_estaba', id: ya.rows[0].id };
    let local = c.local;
    if (req.empleado.local_id) {
      local = (await pool.query('SELECT nombre FROM locales WHERE id = $1 AND colegio_id = $2', [req.empleado.local_id, colegioId])).rows[0]?.nombre;
    }
    if (!local) return { id_local, estado: 'error', error: 'Zona inválida' };
    let apertura = new Date(c.apertura);
    if (Number.isNaN(apertura.getTime()) || apertura.getTime() > Date.now() + 5 * 60 * 1000) apertura = new Date();
    const r = await pool.query(
      `INSERT INTO cajas (empleado_id, local, fondo, ventas, tx_count, abierta, colegio_id, apertura, id_local)
       VALUES ($1, $2, $3, 0, 0, true, $4, ($5::timestamptz AT TIME ZONE 'UTC'), $6) RETURNING id`,
      [req.empleado.id, local, Math.max(0, Number(c.fondo) || 0), colegioId, apertura.toISOString(), id_local]
    );
    await registrar(req.empleado.id, colegioId, 'Caja abierta sin conexión', `${local}: se abrió sin internet y se registró al volver la conexión`);
    return { id_local, estado: 'ok', id: r.rows[0].id };
  } catch (err) {
    if (err.code === '23505') {
      const ya = await pool.query('SELECT id FROM cajas WHERE colegio_id = $1 AND id_local = $2', [colegioId, id_local]);
      return { id_local, estado: 'ya_estaba', id: ya.rows[0]?.id };
    }
    console.error(err);
    return { id_local, estado: 'reintentar', error: 'Error del servidor' };
  }
};

// Cierre hecho sin internet (de una caja real o de una abierta sin internet)
const sincronizarCierre = async (c, req) => {
  const colegioId = req.empleado.colegio_id;
  const clave = String(c?.caja_id ?? '');
  try {
    const id = clave.startsWith('local:')
      ? (await pool.query('SELECT id FROM cajas WHERE colegio_id = $1 AND id_local = $2', [colegioId, clave.slice(6)])).rows[0]?.id
      : (Number.isInteger(Number(clave)) ? Number(clave) : null);
    if (!id) return { caja_id: clave, estado: 'error', error: 'Caja no encontrada' };
    let cierre = new Date(c.cierre);
    if (Number.isNaN(cierre.getTime()) || cierre.getTime() > Date.now() + 5 * 60 * 1000) cierre = new Date();
    await pool.query(
      `UPDATE cajas SET abierta = false, cierre = ($1::timestamptz AT TIME ZONE 'UTC')
       WHERE id = $2 AND colegio_id = $3 AND empleado_id = $4 AND abierta = true`,
      [cierre.toISOString(), id, colegioId, req.empleado.id]
    );
    return { caja_id: clave, estado: 'ok', id };
  } catch (err) {
    console.error(err);
    return { caja_id: clave, estado: 'reintentar', error: 'Error del servidor' };
  }
};

const sincronizarVentas = async (req, res) => {
  const ventas = Array.isArray(req.body?.ventas) ? req.body.ventas : [];
  const cajas = Array.isArray(req.body?.cajas) ? req.body.cajas : [];
  const cierres = Array.isArray(req.body?.cierres) ? req.body.cierres : [];
  if (ventas.length + cajas.length + cierres.length === 0) return res.status(400).json({ error: 'No hay ventas para sincronizar' });
  if (ventas.length > MAX_VENTAS) return res.status(400).json({ error: `Se sincronizan hasta ${MAX_VENTAS} ventas por vez` });

  const resultadosCajas = [];
  for (const c of cajas) resultadosCajas.push(await sincronizarCaja(c, req));
  const resultados = [];
  for (const v of ventas) resultados.push(await sincronizarUna(v, req));
  const resultadosCierres = [];
  for (const c of cierres) resultadosCierres.push(await sincronizarCierre(c, req));

  const ok = resultados.filter(r => r.estado === 'ok' && !r.anulada);
  if (ok.length) {
    const total = ok.reduce((s, r) => s + r.total, 0);
    await registrar(req.empleado.id, req.empleado.colegio_id, 'Ventas sin conexión sincronizadas', `${ok.length} venta${ok.length > 1 ? 's' : ''} por $${total}`);
  }
  res.json({ resultados, cajas: resultadosCajas, cierres: resultadosCierres });
};

// Cada equipo del POS avisa que está conectado y cuántas ventas tiene sin subir
const reportarEstado = async (req, res) => {
  const b = req.body || {};
  const id = String(b.dispositivo ?? '');
  if (!ID_VENTA.test(id)) return res.status(400).json({ error: 'Equipo inválido' });
  const entero = v => Math.max(0, Math.min(100000, parseInt(v) || 0));
  const desde = b.pendientes_desde && !Number.isNaN(new Date(b.pendientes_desde).getTime()) ? new Date(b.pendientes_desde).toISOString() : null;
  try {
    await pool.query(
      `INSERT INTO dispositivos_pos (id, colegio_id, empleado_id, local, equipo, pendientes, con_error, pendientes_desde, ultimo_contacto)
       VALUES ($1, $2, $3, $4, $5, $6, $7, ($8::timestamptz AT TIME ZONE 'UTC'), NOW() AT TIME ZONE 'UTC')
       ON CONFLICT (colegio_id, id) DO UPDATE SET empleado_id = $3, local = $4, equipo = $5, pendientes = $6,
         con_error = $7, pendientes_desde = ($8::timestamptz AT TIME ZONE 'UTC'), ultimo_contacto = NOW() AT TIME ZONE 'UTC'`,
      [id, req.empleado.colegio_id, req.empleado.id, String(b.local || '').slice(0, 100) || null, String(b.equipo || '').slice(0, 80) || null,
        entero(b.pendientes), entero(b.con_error), desde]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
};

// ─── Pantalla "Sin conexión" del admin ──────────────────────────────────────
// Ventas sin conexión del período, sincronizaciones y alumnos con saldo negativo
const getResumenOffline = async (req, res) => {
  const colegioId = req.empleado.colegio_id;
  const dias = Math.min(Math.max(parseInt(req.query.dias) || 30, 1), 365);
  try {
    const [ventas, sincronizaciones, negativos, dispositivos] = await Promise.all([
      pool.query(
        `SELECT t.id, t.fecha, t.sincronizada_en, t.monto, t.lugar, t.descripcion,
                t.descripcion LIKE '[ANULADA]%' AS anulada,
                a.id AS alumno_id, a.nombre AS alumno_nombre, a.curso, e.nombre AS empleado_nombre
         FROM transacciones t
         LEFT JOIN alumnos a ON a.id = t.alumno_id
         LEFT JOIN empleados e ON e.id = t.empleado_id
         WHERE t.colegio_id = $1 AND t.offline AND t.fecha > NOW() - ($2 || ' days')::interval
         ORDER BY t.fecha DESC LIMIT 500`, [colegioId, dias]),
      pool.query(
        `SELECT COUNT(*)::int AS n FROM auditoria
         WHERE colegio_id = $1 AND accion = 'Ventas sin conexión sincronizadas' AND fecha > NOW() - ($2 || ' days')::interval`, [colegioId, dias]),
      pool.query(
        `SELECT a.id, a.nombre, a.curso, a.saldo,
                (SELECT MAX(t.fecha) FROM transacciones t WHERE t.alumno_id = a.id AND t.offline) AS ultima_sin_conexion,
                (SELECT COUNT(*)::int FROM padres_alumnos pa WHERE pa.alumno_id = a.id) AS padres
         FROM alumnos a WHERE a.colegio_id = $1 AND a.saldo < 0 ORDER BY a.saldo ASC`, [colegioId]),
      pool.query(
        `SELECT d.id, d.local, d.equipo, d.pendientes, d.con_error, d.pendientes_desde, d.ultimo_contacto, e.nombre AS empleado_nombre
         FROM dispositivos_pos d LEFT JOIN empleados e ON e.id = d.empleado_id
         WHERE d.colegio_id = $1 AND d.ultimo_contacto > (NOW() AT TIME ZONE 'UTC') - INTERVAL '7 days'
         ORDER BY d.ultimo_contacto DESC`, [colegioId]),
    ]);
    const validas = ventas.rows.filter(v => !v.anulada);
    res.json({
      dias,
      ventas: ventas.rows,
      cantidad: validas.length,
      total: validas.reduce((s, v) => s + Number(v.monto), 0),
      sincronizaciones: sincronizaciones.rows[0].n,
      negativos: negativos.rows,
      dispositivos: dispositivos.rows,
      deuda: negativos.rows.reduce((s, a) => s - Number(a.saldo), 0),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
};

// Recordarle a la familia que el saldo quedó negativo (push y email)
const recordarSaldoNegativo = async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM alumnos WHERE id = $1 AND colegio_id = $2', [req.params.id, req.empleado.colegio_id]);
    const alumno = r.rows[0];
    if (!alumno) return res.status(404).json({ error: 'Alumno no encontrado' });
    if (Number(alumno.saldo) >= 0) return res.status(400).json({ error: 'El saldo de este alumno ya no está en negativo' });
    const avisados = await notificarSaldoNegativo({ colegioId: req.empleado.colegio_id, alumno });
    if (avisados === 0) return res.status(400).json({ error: 'Este alumno no tiene padres vinculados con avisos activados' });
    await registrar(req.empleado.id, req.empleado.colegio_id, 'Aviso de saldo negativo', `${alumno.nombre}: saldo ${alumno.saldo}, avisado a ${avisados} padre${avisados > 1 ? 's' : ''}`);
    res.json({ avisados });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
};

module.exports = { getDatosOffline, sincronizarVentas, reportarEstado, getResumenOffline, recordarSaldoNegativo, huella };
