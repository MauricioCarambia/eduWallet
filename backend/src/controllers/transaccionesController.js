const pool = require('../db/conexion');
const { notificarCompra, notificarRechazo } = require('../services/notificacionesService');
const { evaluarReglas, conflictosAlergia, listaAlergenos } = require('../services/reglasCompra');
const { registrar } = require('./auditoriaController');

const { compradoHoyPorCategoria, gastoDeLaSemana } = require('../services/consumoAlumno');
const tieneMaximos = a => Object.keys(a.restricciones?.maximos || {}).length > 0;

const getTransacciones = async (req, res) => {
  try {
    const { desde, hasta, tipo, lugar, page = 1, limit = 500 } = req.query;

    const condiciones = ['t.colegio_id = $1'];
    const valores = [req.empleado.colegio_id];

    if (desde) { valores.push(desde); condiciones.push(`t.fecha::date >= $${valores.length}`); }
    if (hasta) { valores.push(hasta); condiciones.push(`t.fecha::date <= $${valores.length}`); }
    if (tipo)  { valores.push(tipo);  condiciones.push(`t.tipo = $${valores.length}`); }
    if (lugar) { valores.push(lugar); condiciones.push(`t.lugar = $${valores.length}`); }

    const where = `WHERE ${condiciones.join(' AND ')}`;

    const limitNum  = Math.min(Math.max(parseInt(limit) || 500, 1), 2000);
    const offset    = (Math.max(parseInt(page) || 1, 1) - 1) * limitNum;

    valores.push(limitNum, offset);
    const pLimit  = valores.length - 1;
    const pOffset = valores.length;

    const [dataRes, countRes] = await Promise.all([
      pool.query(
        `SELECT t.*, a.nombre as alumno_nombre, e.nombre as empleado_nombre
         FROM transacciones t
         LEFT JOIN alumnos a ON t.alumno_id = a.id
         LEFT JOIN empleados e ON t.empleado_id = e.id
         ${where}
         ORDER BY t.fecha DESC
         LIMIT $${pLimit} OFFSET $${pOffset}`,
        valores
      ),
      pool.query(
        `SELECT COUNT(*) FROM transacciones t ${where}`,
        valores.slice(0, -2)
      )
    ]);

    res.json({
      data:    dataRes.rows,
      total:   parseInt(countRes.rows[0].count),
      page:    parseInt(page),
      limit:   limitNum,
      pages:   Math.ceil(parseInt(countRes.rows[0].count) / limitNum)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
};

const getTransaccionesAlumno = async (req, res) => {
  const { id } = req.params;
  try {
    const resultado = await pool.query(
      `SELECT t.*, e.nombre as empleado_nombre
       FROM transacciones t
       LEFT JOIN empleados e ON t.empleado_id = e.id
       WHERE t.alumno_id = $1 AND t.colegio_id = $2
       ORDER BY t.fecha DESC`,
      [id, req.empleado.colegio_id]
    );
    res.json(resultado.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

const cobrar = async (req, res) => {
  const { alumno_id, caja_id, items } = req.body;
  let { lugar } = req.body;
  // El empleado es el de la sesión, nunca el que mande el cliente
  const empleado_id = req.empleado.id;

  // Cantidades enteras positivas y descuento entre 0 y 100: una cantidad
  // negativa haría que el cobro sume saldo en vez de restarlo
  const descuento = Number(req.body.descuento) || 0;
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'El carrito está vacío' });
  if (items.some(i => !Number.isInteger(Number(i.qty)) || Number(i.qty) <= 0 || Number(i.qty) > 100)) {
    return res.status(400).json({ error: 'Cantidad inválida' });
  }
  if (descuento < 0 || descuento > 100) return res.status(400).json({ error: 'Descuento inválido' });

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // si el empleado tiene zona fija, no puede vender bajo otra
    if (req.empleado.local_id) {
      const localAsignado = await pool.query('SELECT nombre FROM locales WHERE id = $1', [req.empleado.local_id]);
      if (localAsignado.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Tu zona asignada ya no existe, avisá al administrador' });
      }
      lugar = localAsignado.rows[0].nombre;
    }

    const alumno = await client.query(
      'SELECT * FROM alumnos WHERE id = $1 AND colegio_id = $2 FOR UPDATE',
      [alumno_id, req.empleado.colegio_id]
    );

    if (alumno.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Alumno no encontrado' });
    }

    const a = alumno.rows[0];

    if (!a.activo) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Tarjeta bloqueada' });
    }

    // Precios y nombres salen de la base, no de lo que manda el POS
    const ids = [...new Set(items.map(i => Number(i.id)))];
    const prods = await client.query(
      'SELECT id, nombre, precio, local, categoria, alergenos FROM productos WHERE id = ANY($1::int[]) AND colegio_id = $2 AND activo = true',
      [ids, req.empleado.colegio_id]
    );
    const porId = new Map(prods.rows.map(p => [p.id, p]));
    if (porId.size !== ids.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Algún producto ya no existe. Recargá la página.' });
    }
    if (prods.rows.some(p => p.local !== lugar)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Sólo se pueden cobrar productos de ${lugar}` });
    }
    const lineas = items.map(i => ({ ...porId.get(Number(i.id)), qty: Number(i.qty) }));

    const subtotal = lineas.reduce((s, l) => s + Number(l.precio) * l.qty, 0);
    const total = Math.round(subtotal * (1 - descuento / 100));
    if (total <= 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'El total tiene que ser mayor a 0' });
    }

    // Reglas de la familia: categorías, productos y zonas bloqueadas,
    // máximos por día y límite semanal
    const motivos = evaluarReglas({
      alumno: a, lineas, lugar, total,
      hoyPorCategoria: tieneMaximos(a) ? await compradoHoyPorCategoria(client, a.id) : {},
      gastoSemana: a.limite_semanal != null ? await gastoDeLaSemana(client, a.id) : 0,
    });
    if (motivos.length > 0) {
      await client.query('ROLLBACK');
      notificarRechazo({ colegioId: req.empleado.colegio_id, alumno: a, motivos, lugar });
      return res.status(403).json({ error: motivos[0], motivos, tipo: 'regla' });
    }

    // Alergias: la familia elige si se bloquea o si el cajero confirma
    const alergias = conflictosAlergia(a.alergenos || [], lineas);
    if (alergias.length > 0) {
      const nombre = a.nombre.split(' ')[0];
      const texto = alergias.map(p => `${p.nombre} (${listaAlergenos(p.alergenos)})`).join(', ');
      if (a.bloquear_alergenos) {
        await client.query('ROLLBACK');
        const motivo = `${nombre} es alérgico/a: no se puede vender ${texto}`;
        notificarRechazo({ colegioId: req.empleado.colegio_id, alumno: a, motivos: [motivo], lugar });
        return res.status(403).json({ error: motivo, alergias, tipo: 'alergia_bloqueada' });
      }
      if (req.body.confirmar_alergias !== true) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: `${nombre} es alérgico/a a: ${texto}`, alergias, requiere_confirmacion: true });
      }
    }

    if (parseFloat(a.saldo) < total) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Saldo insuficiente (disponible: ${a.saldo})` });
    }

    if (parseFloat(a.gasto_hoy) + total > parseFloat(a.limite_diario)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Límite diario excedido' });
    }

    // descontar saldo
    await client.query(
      'UPDATE alumnos SET saldo = saldo - $1, gasto_hoy = gasto_hoy + $1 WHERE id = $2',
      [total, alumno_id]
    );

    // descontar stock
    for (const l of lineas) {
      await client.query(
        'UPDATE productos SET stock = GREATEST(0, stock - $1) WHERE id = $2 AND colegio_id = $3',
        [l.qty, l.id, req.empleado.colegio_id]
      );
    }

    // registrar transacción
    const desc = lineas.map(l => `${l.nombre}${l.qty > 1 ? ` ×${l.qty}` : ''}`).join(', ');
    const tx = await client.query(
      `INSERT INTO transacciones (alumno_id, empleado_id, monto, tipo, lugar, descripcion, colegio_id)
       VALUES ($1, $2, $3, 'compra', $4, $5, $6) RETURNING *`,
      [alumno_id, empleado_id, total, lugar, desc, req.empleado.colegio_id]
    );

    // detalle de la compra (para contar unidades por categoría)
    for (const l of lineas) {
      await client.query(
        `INSERT INTO transaccion_items (transaccion_id, producto_id, nombre, categoria, cantidad, precio)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [tx.rows[0].id, l.id, l.nombre, l.categoria, l.qty, l.precio]
      );
    }

    // actualizar la caja abierta del propio empleado
    if (caja_id) {
      await client.query(
        'UPDATE cajas SET ventas = ventas + $1, tx_count = tx_count + 1 WHERE id = $2 AND colegio_id = $3 AND empleado_id = $4 AND abierta = true',
        [total, caja_id, req.empleado.colegio_id, empleado_id]
      );
    }

    await client.query('COMMIT');

    const alumnoActualizadoRes = await pool.query('SELECT * FROM alumnos WHERE id = $1', [alumno_id]);
    const alumnoActualizado = alumnoActualizadoRes.rows[0];

    if (alergias.length > 0) {
      await registrar(empleado_id, req.empleado.colegio_id, 'Venta con alérgeno confirmada',
        `${a.nombre}: ${alergias.map(p => `${p.nombre} (${listaAlergenos(p.alergenos)})`).join(', ')}`);
    }

    // avisos a la familia (cada padre elige cuáles y por qué medio)
    notificarCompra({
      colegioId: req.empleado.colegio_id, alumno: a, lugar, total, descripcion: desc,
      saldoAnterior: a.saldo, saldoNuevo: alumnoActualizado.saldo,
    });

    res.json({ transaccion: tx.rows[0], alumno: alumnoActualizado });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  } finally {
    client.release();
  }
};
const anularVenta = async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // FOR UPDATE: dos pedidos de anulación simultáneos no pueden devolver
    // la plata dos veces
    const tx = await client.query(
      'SELECT * FROM transacciones WHERE id = $1 AND tipo = $2 AND colegio_id = $3 FOR UPDATE',
      [id, 'compra', req.empleado.colegio_id]
    );

    if (tx.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Transacción no encontrada' });
    }

    const t = tx.rows[0];

    if (t.descripcion?.startsWith('[ANULADA]')) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Esta venta ya fue anulada' });
    }

    if (t.empleado_id !== req.empleado.id) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Sólo podés anular tus propias ventas' });
    }

    const hace24hs = new Date(Date.now() - 24 * 60 * 60 * 1000);
    if (new Date(t.fecha) < hace24hs) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Solo se pueden anular ventas de las últimas 24 horas' });
    }

    // devolver saldo al alumno
    await client.query(
      'UPDATE alumnos SET saldo = saldo + $1, gasto_hoy = GREATEST(0, gasto_hoy - $1) WHERE id = $2',
      [t.monto, t.alumno_id]
    );

    // devolver stock — parsear descripción para obtener productos
    const items = t.descripcion.split(', ')
    for (const item of items) {
      const matchQty = item.match(/×(\d+)$/)
      const qty = matchQty ? parseInt(matchQty[1]) : 1
      const nombre = item.replace(/ ×\d+$/, '').trim()
      await client.query(
        `UPDATE productos SET stock = stock + $1
         WHERE nombre = $2 AND local = $3 AND colegio_id = $4`,
        [qty, nombre, t.lugar, req.empleado.colegio_id]
      )
    }

    // restar de la caja activa del mismo local
    await client.query(
      `UPDATE cajas SET ventas = GREATEST(0, ventas - $1), tx_count = GREATEST(0, tx_count - 1)
       WHERE local = $2 AND abierta = true AND empleado_id = $3 AND colegio_id = $4`,
      [t.monto, t.lugar, t.empleado_id, req.empleado.colegio_id]
    )

    // registrar anulación
    await client.query(
      `INSERT INTO transacciones (alumno_id, empleado_id, monto, tipo, lugar, descripcion, colegio_id)
       VALUES ($1, $2, $3, 'anulacion', $4, $5, $6)`,
      [t.alumno_id, t.empleado_id, t.monto, t.lugar, `Anulación de venta #${id}: ${t.descripcion}`, req.empleado.colegio_id]
    );

    // marcar la venta original como anulada
    await client.query(
      `UPDATE transacciones SET descripcion = '[ANULADA] ' || descripcion WHERE id = $1`,
      [id]
    );

    await client.query('COMMIT');

    const alumno = await pool.query('SELECT * FROM alumnos WHERE id = $1', [t.alumno_id]);
    res.json({ mensaje: 'Venta anulada correctamente', alumno: alumno.rows[0], monto: t.monto });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Error al anular la venta' });
  } finally {
    client.release();
  }
};
// ─── Resumen del día (dashboard del POS) ────────────────────────────────────
// Las fechas se guardan en UTC: los días y las horas son los de Argentina
const FECHA_AR = col => `(${col} AT TIME ZONE 'UTC' AT TIME ZONE 'America/Argentina/Buenos_Aires')`;

// "Alfajor ×2, Gaseosa" -> [{ nombre: 'Alfajor', qty: 2 }, { nombre: 'Gaseosa', qty: 1 }]
const itemsDeVenta = descripcion => (descripcion || '').replace(/^\[ANULADA\] /, '').split(', ').filter(Boolean).map(item => {
  const m = item.match(/ ×(\d+)$/);
  return { nombre: item.replace(/ ×\d+$/, '').trim(), qty: m ? parseInt(m[1]) : 1 };
});

const getResumenDia = async (req, res) => {
  const fecha = req.query.fecha || new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return res.status(400).json({ error: 'Fecha inválida' });

  try {
    // Un empleado con zona fija ve su zona; uno sin zona, la que elija o todas
    let local = req.query.local || null;
    if (req.empleado.local_id) {
      const z = await pool.query('SELECT nombre FROM locales WHERE id = $1 AND colegio_id = $2', [req.empleado.local_id, req.empleado.colegio_id]);
      local = z.rows[0]?.nombre || null;
    }

    const params = [req.empleado.colegio_id, fecha, local];
    const [ventasRes, cajasRes, semanaPasadaRes] = await Promise.all([
      pool.query(
        `SELECT t.id, t.fecha, t.monto, t.descripcion, t.lugar, t.empleado_id,
                a.nombre AS alumno_nombre, a.curso AS alumno_curso, e.nombre AS empleado_nombre,
                EXTRACT(HOUR FROM ${FECHA_AR('t.fecha')})::int AS hora
         FROM transacciones t
         LEFT JOIN alumnos a ON a.id = t.alumno_id
         LEFT JOIN empleados e ON e.id = t.empleado_id
         WHERE t.colegio_id = $1 AND t.tipo = 'compra'
           AND ${FECHA_AR('t.fecha')}::date = $2::date
           AND ($3::text IS NULL OR t.lugar = $3)
         ORDER BY t.fecha DESC`,
        params
      ),
      pool.query(
        `SELECT c.id, c.local, c.fondo, c.ventas, c.tx_count, c.abierta, c.apertura, c.cierre, e.nombre AS empleado_nombre
         FROM cajas c LEFT JOIN empleados e ON e.id = c.empleado_id
         WHERE c.colegio_id = $1 AND ${FECHA_AR('c.apertura')}::date = $2::date
           AND ($3::text IS NULL OR c.local = $3)
         ORDER BY c.apertura`,
        params
      ),
      // Mismo día de la semana anterior, para comparar
      pool.query(
        `SELECT COALESCE(SUM(monto), 0) AS total, COUNT(*)::int AS cantidad
         FROM transacciones
         WHERE colegio_id = $1 AND tipo = 'compra' AND descripcion NOT LIKE '[ANULADA]%'
           AND ${FECHA_AR('fecha')}::date = $2::date - 7
           AND ($3::text IS NULL OR lugar = $3)`,
        params
      ),
    ]);

    const ventas = ventasRes.rows.map(v => ({ ...v, monto: Number(v.monto), anulada: v.descripcion?.startsWith('[ANULADA]') || false }));
    const validas = ventas.filter(v => !v.anulada);
    const anuladas = ventas.filter(v => v.anulada);
    const total = validas.reduce((s, v) => s + v.monto, 0);

    const porHora = Array.from({ length: 24 }, (_, hora) => ({ hora, total: 0, cantidad: 0 }));
    const productos = new Map();
    const empleados = new Map();
    const zonas = new Map();
    for (const v of validas) {
      porHora[v.hora].total += v.monto;
      porHora[v.hora].cantidad += 1;
      for (const it of itemsDeVenta(v.descripcion)) {
        const p = productos.get(it.nombre) || { nombre: it.nombre, cantidad: 0 };
        p.cantidad += it.qty;
        productos.set(it.nombre, p);
      }
      const e = empleados.get(v.empleado_nombre) || { nombre: v.empleado_nombre || 'Sin empleado', total: 0, cantidad: 0 };
      e.total += v.monto; e.cantidad += 1;
      empleados.set(v.empleado_nombre, e);
      const z = zonas.get(v.lugar) || { local: v.lugar, total: 0, cantidad: 0 };
      z.total += v.monto; z.cantidad += 1;
      zonas.set(v.lugar, z);
    }

    res.json({
      fecha,
      local,
      zona_fija: !!req.empleado.local_id,
      resumen: {
        total,
        cantidad: validas.length,
        ticket_promedio: validas.length ? Math.round(total / validas.length) : 0,
        alumnos: new Set(validas.map(v => v.alumno_nombre)).size,
        anuladas: anuladas.length,
        monto_anulado: anuladas.reduce((s, v) => s + v.monto, 0),
      },
      semana_pasada: { total: Number(semanaPasadaRes.rows[0].total), cantidad: semanaPasadaRes.rows[0].cantidad },
      por_hora: porHora,
      productos: [...productos.values()].sort((a, b) => b.cantidad - a.cantidad).slice(0, 10),
      por_empleado: [...empleados.values()].sort((a, b) => b.total - a.total),
      por_zona: [...zonas.values()].sort((a, b) => b.total - a.total),
      cajas: cajasRes.rows,
      ventas,
    });
  } catch (err) {
    console.error('Error getResumenDia:', err.message);
    res.status(500).json({ error: 'Error al cargar el resumen' });
  }
};

module.exports = { getTransacciones, getTransaccionesAlumno, cobrar, anularVenta, getResumenDia };