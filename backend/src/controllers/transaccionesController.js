const pool = require('../db/conexion');
const { enviarEmailSaldoBajo, enviarEmailCompra } = require('../services/emailService');

const getTransacciones = async (req, res) => {
  try {
    const { desde, hasta, tipo, lugar, page = 1, limit = 500 } = req.query;

    const condiciones = [];
    const valores = [];

    if (desde) { valores.push(desde); condiciones.push(`t.fecha::date >= $${valores.length}`); }
    if (hasta) { valores.push(hasta); condiciones.push(`t.fecha::date <= $${valores.length}`); }
    if (tipo)  { valores.push(tipo);  condiciones.push(`t.tipo = $${valores.length}`); }
    if (lugar) { valores.push(lugar); condiciones.push(`t.lugar = $${valores.length}`); }

    const where = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';

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
       WHERE t.alumno_id = $1
       ORDER BY t.fecha DESC`,
      [id]
    );
    res.json(resultado.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

const cobrar = async (req, res) => {
  const { alumno_id, empleado_id, caja_id, items, lugar, descuento } = req.body;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const alumno = await client.query(
      'SELECT * FROM alumnos WHERE id = $1 FOR UPDATE',
      [alumno_id]
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

    const subtotal = items.reduce((s, i) => s + i.precio * i.qty, 0);
    const total = Math.round(subtotal * (1 - (descuento || 0) / 100));

    if (parseFloat(a.saldo) < total) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Saldo insuficiente (disponible: $${a.saldo})` });
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
    for (const item of items) {
      await client.query(
        'UPDATE productos SET stock = GREATEST(0, stock - $1) WHERE id = $2',
        [item.qty, item.id]
      );
    }

    // registrar transacción
    const desc = items.map(i => `${i.nombre}${i.qty > 1 ? ` ×${i.qty}` : ''}`).join(', ');
    const tx = await client.query(
      `INSERT INTO transacciones (alumno_id, empleado_id, monto, tipo, lugar, descripcion)
       VALUES ($1, $2, $3, 'compra', $4, $5) RETURNING *`,
      [alumno_id, empleado_id, total, lugar, desc]
    );

    // actualizar caja
    if (caja_id) {
      await client.query(
        'UPDATE cajas SET ventas = ventas + $1, tx_count = tx_count + 1 WHERE id = $2',
        [total, caja_id]
      );
    }

    await client.query('COMMIT');

    const alumnoActualizadoRes = await pool.query('SELECT * FROM alumnos WHERE id = $1', [alumno_id]);
    const alumnoActualizado = alumnoActualizadoRes.rows[0];

    // notificar al padre por email
    try {
      const padresRes = await pool.query(
        `SELECT p.nombre, p.email FROM padres p
         JOIN padres_alumnos pa ON pa.padre_id = p.id
         WHERE pa.alumno_id = $1`,
        [alumno_id]
      );
      for (const padre of padresRes.rows) {
        await enviarEmailCompra({
          nombrePadre: padre.nombre,
          emailPadre: padre.email,
          nombreAlumno: a.nombre,
          descripcion: desc,
          monto: total,
          saldo: alumnoActualizado.saldo,
          lugar
        });
        if (parseFloat(alumnoActualizado.saldo) < 200) {
          await enviarEmailSaldoBajo({
            nombrePadre: padre.nombre,
            emailPadre: padre.email,
            nombreAlumno: a.nombre,
            saldo: alumnoActualizado.saldo,
            curso: a.curso
          });
        }
      }
    } catch (emailErr) {
      console.error('Error enviando email:', emailErr.message);
    }

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

    const tx = await client.query(
      'SELECT * FROM transacciones WHERE id = $1 AND tipo = $2',
      [id, 'compra']
    );

    if (tx.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Transacción no encontrada' });
    }

    const t = tx.rows[0];

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
         WHERE nombre = $2 AND local = $3`,
        [qty, nombre, t.lugar]
      )
    }

    // restar de la caja activa del mismo local
    await client.query(
      `UPDATE cajas SET ventas = GREATEST(0, ventas - $1), tx_count = GREATEST(0, tx_count - 1)
       WHERE local = $2 AND abierta = true AND empleado_id = $3`,
      [t.monto, t.lugar, t.empleado_id]
    )

    // registrar anulación
    await client.query(
      `INSERT INTO transacciones (alumno_id, empleado_id, monto, tipo, lugar, descripcion)
       VALUES ($1, $2, $3, 'anulacion', $4, $5)`,
      [t.alumno_id, t.empleado_id, t.monto, t.lugar, `Anulación de venta #${id}: ${t.descripcion}`]
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
module.exports = { getTransacciones, getTransaccionesAlumno, cobrar, anularVenta };