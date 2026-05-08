const pool = require('../db/conexion');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const registro = async (req, res) => {
  const { nombre, email, password } = req.body;
  try {
    const existe = await pool.query('SELECT id FROM padres WHERE email = $1', [email]);
    if (existe.rows.length > 0) {
      return res.status(400).json({ error: 'El email ya está registrado' });
    }
    const hash = await bcrypt.hash(password, 10);
    const resultado = await pool.query(
      'INSERT INTO padres (nombre, email, password) VALUES ($1, $2, $3) RETURNING id, nombre, email',
      [nombre, email, hash]
    );
    const padre = resultado.rows[0];
    const token = jwt.sign({ id: padre.id, tipo: 'padre' }, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, padre });
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

const login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const resultado = await pool.query('SELECT * FROM padres WHERE email = $1 AND activo = true', [email]);
    if (resultado.rows.length === 0) {
      return res.status(401).json({ error: 'Email no encontrado' });
    }
    const padre = resultado.rows[0];
    const valido = await bcrypt.compare(password, padre.password);
    if (!valido) {
      return res.status(401).json({ error: 'Contraseña incorrecta' });
    }
    const token = jwt.sign({ id: padre.id, tipo: 'padre' }, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, padre: { id: padre.id, nombre: padre.nombre, email: padre.email } });
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

const getAlumnos = async (req, res) => {
  const padreId = req.padre.id;
  try {
    const resultado = await pool.query(
      `SELECT a.*, pa.relacion FROM alumnos a
       JOIN padres_alumnos pa ON pa.alumno_id = a.id
       WHERE pa.padre_id = $1`,
      [padreId]
    );
    res.json(resultado.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

const vincularAlumno = async (req, res) => {
  const padreId = req.padre.id;
  const { alumno_id, relacion } = req.body;
  try {
    const alumno = await pool.query('SELECT id FROM alumnos WHERE id = $1', [alumno_id]);
    if (alumno.rows.length === 0) {
      return res.status(404).json({ error: 'Alumno no encontrado' });
    }
    const existe = await pool.query(
      'SELECT id FROM padres_alumnos WHERE padre_id = $1 AND alumno_id = $2',
      [padreId, alumno_id]
    );
    if (existe.rows.length > 0) {
      return res.status(400).json({ error: 'Ya está vinculado a este alumno' });
    }
    await pool.query(
      'INSERT INTO padres_alumnos (padre_id, alumno_id, relacion) VALUES ($1, $2, $3)',
      [padreId, alumno_id, relacion || 'tutor']
    );
    res.json({ mensaje: 'Alumno vinculado correctamente' });
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

const recargarSaldo = async (req, res) => {
  const { alumno_id, monto } = req.body;
  const padreId = req.padre.id;
  try {
    const vinculo = await pool.query(
      'SELECT id FROM padres_alumnos WHERE padre_id = $1 AND alumno_id = $2',
      [padreId, alumno_id]
    );
    if (vinculo.rows.length === 0) {
      return res.status(403).json({ error: 'No tenés acceso a este alumno' });
    }
    await pool.query('UPDATE alumnos SET saldo = saldo + $1 WHERE id = $2', [monto, alumno_id]);
    await pool.query(
      `INSERT INTO transacciones (alumno_id, monto, tipo, lugar, descripcion)
       VALUES ($1, $2, 'recarga', 'App Padres', 'Recarga desde app padres')`,
      [alumno_id, monto]
    );
    const alumno = await pool.query('SELECT * FROM alumnos WHERE id = $1', [alumno_id]);
    res.json(alumno.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

const toggleBloqueo = async (req, res) => {
  const { alumno_id } = req.params;
  const padreId = req.padre.id;
  try {
    const vinculo = await pool.query(
      'SELECT id FROM padres_alumnos WHERE padre_id = $1 AND alumno_id = $2',
      [padreId, alumno_id]
    );
    if (vinculo.rows.length === 0) {
      return res.status(403).json({ error: 'No tenés acceso a este alumno' });
    }
    const resultado = await pool.query(
      'UPDATE alumnos SET activo = NOT activo WHERE id = $1 RETURNING *',
      [alumno_id]
    );
    res.json(resultado.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

const actualizarLimite = async (req, res) => {
  const { alumno_id } = req.params;
  const { limite_diario } = req.body;
  const padreId = req.padre.id;
  try {
    const vinculo = await pool.query(
      'SELECT id FROM padres_alumnos WHERE padre_id = $1 AND alumno_id = $2',
      [padreId, alumno_id]
    );
    if (vinculo.rows.length === 0) {
      return res.status(403).json({ error: 'No tenés acceso a este alumno' });
    }
    const resultado = await pool.query(
      'UPDATE alumnos SET limite_diario = $1 WHERE id = $2 RETURNING *',
      [limite_diario, alumno_id]
    );
    res.json(resultado.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

module.exports = { registro, login, getAlumnos, vincularAlumno, recargarSaldo, toggleBloqueo, actualizarLimite };