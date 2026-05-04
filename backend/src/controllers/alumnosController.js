const pool = require('../db/conexion');
const { registrar } = require('./auditoriaController');

const getAlumnos = async (req, res) => {
  try {
    const resultado = await pool.query(
      'SELECT * FROM alumnos ORDER BY nombre'
    );
    res.json(resultado.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

const getAlumno = async (req, res) => {
  const { id } = req.params;
  try {
    const resultado = await pool.query(
      'SELECT * FROM alumnos WHERE id = $1',
      [id]
    );
    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Alumno no encontrado' });
    }
    res.json(resultado.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

const crearAlumno = async (req, res) => {
  const { nombre, curso, saldo, limite_diario, tutor, tutor_tel, alergias } = req.body;
  try {
    const qr = 'QR-' + Date.now();
    const resultado = await pool.query(
      `INSERT INTO alumnos (nombre, curso, saldo, limite_diario, tutor, tutor_tel, alergias, qr)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [nombre, curso, saldo || 0, limite_diario || 500, tutor, tutor_tel, alergias || 'Ninguna', qr]
    );
    await registrar(req.empleado?.id, 'Nuevo alumno', nombre);
    res.json(resultado.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

const actualizarAlumno = async (req, res) => {
  const { id } = req.params;
  const { nombre, curso, limite_diario, tutor, tutor_tel, alergias } = req.body;
  try {
    const resultado = await pool.query(
      `UPDATE alumnos SET nombre=$1, curso=$2, limite_diario=$3, tutor=$4, tutor_tel=$5, alergias=$6
       WHERE id=$7 RETURNING *`,
      [nombre, curso, limite_diario, tutor, tutor_tel, alergias, id]
    );
    res.json(resultado.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

const toggleAlumno = async (req, res) => {
  const { id } = req.params;
  try {
    const resultado = await pool.query(
      'UPDATE alumnos SET activo = NOT activo WHERE id = $1 RETURNING *',
      [id]
    );
    res.json(resultado.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

const recargarSaldo = async (req, res) => {
  const { id } = req.params;
  const { monto, empleado_id, descripcion } = req.body;
  try {
    await pool.query(
      'UPDATE alumnos SET saldo = saldo + $1 WHERE id = $2',
      [monto, id]
    );
    await pool.query(
      `INSERT INTO transacciones (alumno_id, empleado_id, monto, tipo, lugar, descripcion)
       VALUES ($1, $2, $3, 'recarga', 'Sistema', $4)`,
      [id, empleado_id, monto, descripcion || 'Recarga']
    );
    await registrar(req.empleado?.id, 'Recarga de saldo', `Alumno ID: ${id} — $${monto}`);
    const alumno = await pool.query('SELECT * FROM alumnos WHERE id = $1', [id]);
    res.json(alumno.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

const eliminarAlumno = async (req, res) => {
  const { id } = req.params;
  try {
    await registrar(req.empleado?.id, 'Alumno eliminado', `ID: ${id}`);
    await pool.query('DELETE FROM alumnos WHERE id = $1', [id]);
    res.json({ mensaje: 'Alumno eliminado' });
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

const getGastoSemanal = async (req, res) => {
  const { id } = req.params;
  try {
    const resultado = await pool.query(`
      SELECT
        EXTRACT(DOW FROM fecha) as dia,
        SUM(monto) as total
      FROM transacciones
      WHERE alumno_id = $1
        AND tipo = 'compra'
        AND fecha >= NOW() - INTERVAL '7 days'
      GROUP BY dia
      ORDER BY dia
    `, [id]);

    const dias = [0, 0, 0, 0, 0, 0, 0];
    resultado.rows.forEach(r => {
      dias[parseInt(r.dia)] = parseFloat(r.total);
    });

    res.json(dias);
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

module.exports = { getAlumnos, getAlumno, crearAlumno, actualizarAlumno, toggleAlumno, recargarSaldo, eliminarAlumno, getGastoSemanal };