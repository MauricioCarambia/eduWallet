const pool = require('../db/conexion');

const getTransacciones = async (req, res) => {
  try {
    const resultado = await pool.query(
      `SELECT t.*, a.nombre as alumno_nombre, e.nombre as empleado_nombre
       FROM transacciones t
       LEFT JOIN alumnos a ON t.alumno_id = a.id
       LEFT JOIN empleados e ON t.empleado_id = e.id
       ORDER BY t.fecha DESC`
    );
    res.json(resultado.rows);
  } catch (err) {
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

    const alumnoActualizado = await pool.query('SELECT * FROM alumnos WHERE id = $1', [alumno_id]);
    res.json({ transaccion: tx.rows[0], alumno: alumnoActualizado.rows[0] });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  } finally {
    client.release();
  }
};

module.exports = { getTransacciones, getTransaccionesAlumno, cobrar };