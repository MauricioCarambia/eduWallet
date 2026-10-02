const pool = require('../db/conexion');
const { olvidarSesion } = require('../middlewares/auth');
const { registrarPadreEnColegio } = require('../db/migracion_padres_colegios');

// El padre es parte del colegio (aunque no tenga alumnos vinculados ahora)
const esDelColegio = async (padreId, colegioId) =>
  (await pool.query('SELECT 1 FROM padres_colegios WHERE padre_id = $1 AND colegio_id = $2', [padreId, colegioId])).rows.length > 0;

const getPadres = async (req, res) => {
  try {
    const resultado = await pool.query(`
      -- Todos los padres del colegio, tengan o no alumnos vinculados.
      -- Sólo datos públicos del padre: nunca password, reset_token, etc.
      SELECT p.id, p.nombre, p.email, p.activo, p.creado_en,
        COALESCE(
          json_agg(
            json_build_object('id', a.id, 'nombre', a.nombre, 'curso', a.curso, 'saldo', a.saldo)
            ORDER BY a.nombre
          ) FILTER (WHERE a.id IS NOT NULL),
          '[]'
        ) AS alumnos
      FROM padres_colegios pc
      JOIN padres p ON p.id = pc.padre_id
      LEFT JOIN (padres_alumnos pa JOIN alumnos a ON a.id = pa.alumno_id AND a.colegio_id = $1)
        ON pa.padre_id = p.id
      WHERE pc.colegio_id = $1
      GROUP BY p.id
      ORDER BY p.nombre
    `, [req.empleado.colegio_id]);
    res.json(resultado.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

const togglePadre = async (req, res) => {
  const { id } = req.params;
  try {
    if (!(await esDelColegio(id, req.empleado.colegio_id))) return res.status(404).json({ error: 'Padre no encontrado' });
    const resultado = await pool.query(
      'UPDATE padres SET activo = NOT activo WHERE id = $1 RETURNING id, nombre, activo',
      [id]
    );
    olvidarSesion('padre', id);
    res.json(resultado.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

const desvincularAlumno = async (req, res) => {
  const { padre_id, alumno_id } = req.params;
  try {
    const pertenece = await pool.query('SELECT 1 FROM alumnos WHERE id = $1 AND colegio_id = $2', [alumno_id, req.empleado.colegio_id]);
    if (pertenece.rows.length === 0) return res.status(404).json({ error: 'Alumno no encontrado' });
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
    const pertenece = await pool.query('SELECT 1 FROM alumnos WHERE id = $1 AND colegio_id = $2', [alumno_id, req.empleado.colegio_id]);
    if (pertenece.rows.length === 0) return res.status(404).json({ error: 'Alumno no encontrado' });
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
    await registrarPadreEnColegio(padre_id, req.empleado.colegio_id);
    res.json({ mensaje: 'Alumno vinculado correctamente' });
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

const eliminarPadre = async (req, res) => {
  const { id } = req.params;
  try {
    if (!(await esDelColegio(id, req.empleado.colegio_id))) return res.status(404).json({ error: 'Padre no encontrado' });
    // Se quita del colegio (y de sus alumnos). La cuenta se borra sólo si
    // no pertenece a ningún otro colegio: puede tener hijos en otra escuela.
    const db = await pool.connect();
    try {
      await db.query('BEGIN');
      await db.query(
        'DELETE FROM padres_alumnos WHERE padre_id = $1 AND alumno_id IN (SELECT id FROM alumnos WHERE colegio_id = $2)',
        [id, req.empleado.colegio_id]
      );
      await db.query('DELETE FROM padres_colegios WHERE padre_id = $1 AND colegio_id = $2', [id, req.empleado.colegio_id]);
      const otros = await db.query('SELECT 1 FROM padres_colegios WHERE padre_id = $1 LIMIT 1', [id]);
      if (otros.rows.length === 0) {
        await db.query('DELETE FROM padres_alumnos WHERE padre_id = $1', [id]);
        await db.query('DELETE FROM padres WHERE id = $1', [id]);
      }
      await db.query('COMMIT');
    } catch (err) {
      await db.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      db.release();
    }
    res.json({ mensaje: 'Padre quitado del colegio' });
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

module.exports = { getPadres, togglePadre, desvincularAlumno, vincularAlumno, eliminarPadre };
