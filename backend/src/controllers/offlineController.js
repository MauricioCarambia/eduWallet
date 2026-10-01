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
const { notificarCompra } = require('../services/notificacionesService');
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
    const [alumnos, productos, conf, hoy, semana] = await Promise.all([
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
    ]);

    const hoyPorAlumno = {};
    for (const r of hoy.rows) (hoyPorAlumno[r.alumno_id] ??= {})[r.categoria] = r.cantidad;
    const semanaPorAlumno = Object.fromEntries(semana.rows.map(r => [r.alumno_id, Number(r.total)]));

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
    const prods = await client.query('SELECT id, nombre, precio, categoria FROM productos WHERE id = ANY($1::int[]) AND colegio_id = $2', [ids, colegioId]);
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
    const desc = lineas.map(l => `${l.nombre}${l.qty > 1 ? ` ×${l.qty}` : ''}`).join(', ');
    const tx = await client.query(
      `INSERT INTO transacciones (alumno_id, empleado_id, monto, tipo, lugar, descripcion, colegio_id, fecha, id_venta, offline)
       VALUES ($1, $2, $3, 'compra', $4, $5, $6, ($7::timestamptz AT TIME ZONE 'UTC'), $8, true) RETURNING *`,
      [a.id, empleadoId, total, lugar, desc, colegioId, fecha.toISOString(), id_venta]
    );
    for (const l of lineas) {
      await client.query(
        'INSERT INTO transaccion_items (transaccion_id, producto_id, nombre, categoria, cantidad, precio) VALUES ($1, $2, $3, $4, $5, $6)',
        [tx.rows[0].id, l.id, l.nombre, l.categoria, l.qty, l.precio]
      );
    }
    // La caja donde se vendió (aunque ya se haya cerrado)
    if (v.caja_id) {
      await client.query('UPDATE cajas SET ventas = ventas + $1, tx_count = tx_count + 1 WHERE id = $2 AND colegio_id = $3', [total, v.caja_id, colegioId]);
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

const sincronizarVentas = async (req, res) => {
  const ventas = req.body?.ventas;
  if (!Array.isArray(ventas) || ventas.length === 0) return res.status(400).json({ error: 'No hay ventas para sincronizar' });
  if (ventas.length > MAX_VENTAS) return res.status(400).json({ error: `Se sincronizan hasta ${MAX_VENTAS} ventas por vez` });

  const resultados = [];
  for (const v of ventas) resultados.push(await sincronizarUna(v, req));

  const ok = resultados.filter(r => r.estado === 'ok');
  if (ok.length) {
    const total = ok.reduce((s, r) => s + r.total, 0);
    await registrar(req.empleado.id, req.empleado.colegio_id, 'Ventas sin conexión sincronizadas', `${ok.length} venta${ok.length > 1 ? 's' : ''} por $${total}`);
  }
  res.json({ resultados });
};

module.exports = { getDatosOffline, sincronizarVentas, huella };
