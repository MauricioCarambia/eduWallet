const pool = require('../db/conexion');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { registrar } = require('./auditoriaController');

const login = async (req, res) => {
  const { colegio, usuario, pin } = req.body;

  if (!colegio?.trim()) {
    return res.status(400).json({ error: 'Colegio requerido' });
  }

  try {
    const colegioRes = await pool.query(
      'SELECT id FROM colegios WHERE slug = $1 AND activo = true',
      [colegio.trim().toLowerCase()]
    );
    if (colegioRes.rows.length === 0) {
      return res.status(401).json({ error: 'Colegio no encontrado' });
    }
    const colegioId = colegioRes.rows[0].id;

    const resultado = await pool.query(
      `SELECT e.*, l.nombre AS local_nombre FROM empleados e
       LEFT JOIN locales l ON l.id = e.local_id
       WHERE e.colegio_id = $1 AND e.usuario = $2 AND e.activo = true`,
      [colegioId, usuario]
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
      { id: empleado.id, rol: empleado.rol, colegio_id: empleado.colegio_id, local_id: empleado.local_id },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    await registrar(empleado.id, empleado.colegio_id, 'Inicio de sesión', `Usuario: ${empleado.usuario}`);

    res.json({
      token,
      empleado: {
        id: empleado.id,
        nombre: empleado.nombre,
        usuario: empleado.usuario,
        rol: empleado.rol,
        local: empleado.local_nombre || null,
        mp_conectado: !!empleado.mp_access_token,
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
      `SELECT e.id, e.nombre, e.usuario, e.rol, e.activo, e.local_id, l.nombre AS local_nombre,
              (e.mp_access_token IS NOT NULL) AS mp_conectado
       FROM empleados e
       LEFT JOIN locales l ON l.id = e.local_id
       WHERE e.colegio_id = $1 ORDER BY e.id`,
      [req.empleado.colegio_id]
    );
    res.json(resultado.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

const crearEmpleado = async (req, res) => {
  const { nombre, usuario, pin, rol, local_id } = req.body;
  try {
    let localId = null;
    if (local_id) {
      const local = await pool.query('SELECT id FROM locales WHERE id = $1 AND colegio_id = $2', [local_id, req.empleado.colegio_id]);
      if (local.rows.length === 0) return res.status(400).json({ error: 'Local inválido' });
      localId = local_id;
    }
    const hash = await bcrypt.hash(pin, 10);
    const resultado = await pool.query(
      'INSERT INTO empleados (nombre, usuario, pin, rol, colegio_id, local_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, nombre, usuario, rol, local_id',
      [nombre, usuario, hash, rol, req.empleado.colegio_id, localId]
    );
    await registrar(req.empleado.id, req.empleado.colegio_id, 'Nuevo empleado', nombre);
    res.json(resultado.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

const asignarZona = async (req, res) => {
  const { id } = req.params;
  const { local_id } = req.body;
  try {
    let localId = null;
    if (local_id) {
      const local = await pool.query('SELECT id FROM locales WHERE id = $1 AND colegio_id = $2', [local_id, req.empleado.colegio_id]);
      if (local.rows.length === 0) return res.status(400).json({ error: 'Local inválido' });
      localId = local_id;
    }
    const resultado = await pool.query(
      'UPDATE empleados SET local_id = $1 WHERE id = $2 AND colegio_id = $3 RETURNING id, nombre, usuario, rol, local_id',
      [localId, id, req.empleado.colegio_id]
    );
    if (resultado.rows.length === 0) return res.status(404).json({ error: 'Empleado no encontrado' });
    await registrar(req.empleado.id, req.empleado.colegio_id, 'Zona reasignada', `Empleado: ${resultado.rows[0].nombre}`);
    res.json(resultado.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

const toggleEmpleado = async (req, res) => {
  const { id } = req.params;
  try {
    const resultado = await pool.query(
      'UPDATE empleados SET activo = NOT activo WHERE id = $1 AND colegio_id = $2 RETURNING id, nombre, activo',
      [id, req.empleado.colegio_id]
    );
    if (resultado.rows.length === 0) return res.status(404).json({ error: 'Empleado no encontrado' });
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
      'SELECT * FROM empleados WHERE id = $1 AND colegio_id = $2',
      [id, req.empleado.colegio_id]
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

    await registrar(id, req.empleado.colegio_id, 'Cambio de PIN', `Empleado: ${empleado.nombre}`);
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
      'SELECT * FROM empleados WHERE id = $1 AND colegio_id = $2', [id, req.empleado.colegio_id]
    );
    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Empleado no encontrado' });
    }
    const hash = await bcrypt.hash(pin_nuevo, 10);
    await pool.query('UPDATE empleados SET pin = $1 WHERE id = $2', [hash, id]);
    await registrar(req.empleado.id, req.empleado.colegio_id, 'Reset de PIN', `Empleado ID: ${id}`);
    res.json({ mensaje: 'PIN reseteado correctamente' });
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

module.exports = { login, getEmpleados, crearEmpleado, toggleEmpleado, cambiarPin, resetearPin, asignarZona };
