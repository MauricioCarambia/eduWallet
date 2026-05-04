const pool = require('../db/conexion');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { registrar } = require('./auditoriaController');

const login = async (req, res) => {
  const { usuario, pin } = req.body;

  try {
    const resultado = await pool.query(
      'SELECT * FROM empleados WHERE usuario = $1 AND activo = true',
      [usuario]
    );

    if (resultado.rows.length === 0) {
      return res.status(401).json({ error: 'Usuario no encontrado' });
    }

    const empleado = resultado.rows[0];
    const pinValido = await bcrypt.compare(pin, empleado.pin);

    if (!pinValido) {
      return res.status(401).json({ error: 'PIN incorrecto' });
    }

    const token = jwt.sign(
      { id: empleado.id, rol: empleado.rol },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    await registrar(empleado.id, 'Inicio de sesión', `Usuario: ${empleado.usuario}`);

    res.json({
      token,
      empleado: {
        id: empleado.id,
        nombre: empleado.nombre,
        usuario: empleado.usuario,
        rol: empleado.rol,
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
};

const getEmpleados = async (req, res) => {
  try {
    const resultado = await pool.query(
      'SELECT id, nombre, usuario, rol, activo FROM empleados ORDER BY id'
    );
    res.json(resultado.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

const crearEmpleado = async (req, res) => {
  const { nombre, usuario, pin, rol } = req.body;
  try {
    const hash = await bcrypt.hash(pin, 10);
    const resultado = await pool.query(
      'INSERT INTO empleados (nombre, usuario, pin, rol) VALUES ($1, $2, $3, $4) RETURNING id, nombre, usuario, rol',
      [nombre, usuario, hash, rol]
    );
    await registrar(req.empleado?.id, 'Nuevo empleado', nombre);
    res.json(resultado.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

const toggleEmpleado = async (req, res) => {
  const { id } = req.params;
  try {
    const resultado = await pool.query(
      'UPDATE empleados SET activo = NOT activo WHERE id = $1 RETURNING id, nombre, activo',
      [id]
    );
    res.json(resultado.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

const cambiarPin = async (req, res) => {
  const { id } = req.params;
  const { pin_actual, pin_nuevo } = req.body;
  try {
    const resultado = await pool.query(
      'SELECT * FROM empleados WHERE id = $1',
      [id]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Empleado no encontrado' });
    }

    const empleado = resultado.rows[0];
    const pinValido = await bcrypt.compare(pin_actual, empleado.pin);

    if (!pinValido) {
      return res.status(401).json({ error: 'PIN actual incorrecto' });
    }

    const hash = await bcrypt.hash(pin_nuevo, 10);
    await pool.query(
      'UPDATE empleados SET pin = $1 WHERE id = $2',
      [hash, id]
    );

    await registrar(id, 'Cambio de PIN', `Empleado: ${empleado.nombre}`);
    res.json({ mensaje: 'PIN actualizado correctamente' });
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

const resetearPin = async (req, res) => {
  const { id } = req.params;
  const { pin_nuevo } = req.body;
  try {
    const resultado = await pool.query(
      'SELECT * FROM empleados WHERE id = $1', [id]
    );
    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Empleado no encontrado' });
    }
    const hash = await bcrypt.hash(pin_nuevo, 10);
    await pool.query('UPDATE empleados SET pin = $1 WHERE id = $2', [hash, id]);
    await registrar(req.empleado?.id, 'Reset de PIN', `Empleado ID: ${id}`);
    res.json({ mensaje: 'PIN reseteado correctamente' });
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

module.exports = { login, getEmpleados, crearEmpleado, toggleEmpleado, cambiarPin, resetearPin };