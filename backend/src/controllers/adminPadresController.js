const pool = require('../db/conexion');

const getPadres = async (req, res) => {
  try {
    const resultado = await pool.query(`
      SELECT p.*, 
        json_agg(
          json_build_object(
            'id', a.id,
            'nombre', a.nombre,
            'curso', a.curso,
            'saldo', a.saldo,
            'relacion', pa.relacion
          )
        ) FILTER (WHERE a.id IS NOT NULL) as alumnos
      FROM padres p
      LEFT JOIN padres_alumnos pa ON pa.padre_id = p.id
      LEFT JOIN alumnos a ON a.id = pa.alumno_id
      GROUP BY p.id
      ORDER BY p.nombre
    `);
    res.json(resultado.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

const togglePadre = async (req, res) => {
  const { id } = req.params;
  try {
    const resultado = await pool.query(
      'UPDATE padres SET activo = NOT activo WHERE id = $1 RETURNING id, nombre, activo',
      [id]
    );
    res.json(resultado.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

const desvincularAlumno = async (req, res) => {
  const { padre_id, alumno_id } = req.params;
  try {
    await pool.query(
      'DELETE FROM padres_alumnos WHERE padre_id = $1 AND alumno_id = $2',
      [padre_id, alumno_id]
    );
    res.json({ mensaje: 'Alumno desvinculado correctamente' });
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

const vincularAlumno = async (req, res) => {
  const { padre_id } = req.params;
  const { alumno_id, relacion } = req.body;
  try {
    const existe = await pool.query(
      'SELECT id FROM padres_alumnos WHERE padre_id = $1 AND alumno_id = $2',
      [padre_id, alumno_id]
    );
    if (existe.rows.length > 0) {
      return res.status(400).json({ error: 'Ya está vinculado' });
    }
    await pool.query(
      'INSERT INTO padres_alumnos (padre_id, alumno_id, relacion) VALUES ($1, $2, $3)',
      [padre_id, alumno_id, relacion || 'tutor']
    );
    res.json({ mensaje: 'Alumno vinculado correctamente' });
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

const eliminarPadre = async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM padres_alumnos WHERE padre_id = $1', [id]);
    await pool.query('DELETE FROM padres WHERE id = $1', [id]);
    res.json({ mensaje: 'Padre eliminado correctamente' });
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

module.exports = { getPadres, togglePadre, desvincularAlumno, vincularAlumno, eliminarPadre };