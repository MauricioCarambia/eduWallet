const pool = require('../db/conexion');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { registrar } = require('./auditoriaController');
const { olvidarSesion } = require('../middlewares/auth');

// ─── Activación de cuentas ──────────────────────────────────────────────────
// El admin da de alta al empleado sin PIN; el sistema genera un código de un
// solo uso y el empleado elige su propio PIN. Así el admin nunca lo conoce.
const HORAS_CODIGO = 48;
const LETRAS_CODIGO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin 0/O ni 1/I

const nuevoCodigo = () => {
  const bytes = crypto.randomBytes(8);
  const c = [...bytes].map(b => LETRAS_CODIGO[b % LETRAS_CODIGO.length]).join('');
  return `${c.slice(0, 4)}-${c.slice(4)}`;
};
const normalizarCodigo = c => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const pinValido = pin => /^\d{4,6}$/.test(String(pin || ''));

// Genera y guarda un código nuevo; devuelve el código en claro (se muestra una sola vez)
const generarCodigoActivacion = async (empleadoId, db = pool) => {
  const codigo = nuevoCodigo();
  const hash = await bcrypt.hash(normalizarCodigo(codigo), 10);
  const expira = new Date(Date.now() + HORAS_CODIGO * 3600 * 1000);
  await db.query(
    'UPDATE empleados SET pin = NULL, codigo_activacion = $1, codigo_activacion_expira = $2 WHERE id = $3',
    [hash, expira, empleadoId]
  );
  return { codigo_activacion: codigo, expira };
};

const login = async (req, res) => {
  const { colegio, usuario, pin, app } = req.body;

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
    if (!empleado.pin) {
      return res.status(403).json({ error: 'Tu cuenta todavía no está activada. Usá "Activar cuenta" con el código que te dio el administrador.', pendiente_activacion: true });
    }
    const pinCorrecto = await bcrypt.compare(String(pin || ''), empleado.pin);

    if (!pinCorrecto) {
      return res.status(401).json({ error: 'PIN incorrecto' });
    }

    // El POS es para el personal de las zonas; el panel admin, para el admin
    if (app === 'pos' && empleado.rol === 'admin') {
      return res.status(403).json({ error: 'Los administradores del colegio entran por el panel admin, no por el POS.' });
    }
    if (app === 'admin' && empleado.rol !== 'admin') {
      return res.status(403).json({ error: 'Solo los administradores pueden entrar al panel admin.' });
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
              (e.mp_access_token IS NOT NULL) AS mp_conectado,
              (e.pin IS NULL) AS pendiente_activacion, e.codigo_activacion_expira
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
  const { nombre, usuario, rol, local_id } = req.body;
  if (!nombre?.trim() || !usuario?.trim()) return res.status(400).json({ error: 'Nombre y usuario son obligatorios' });
  if (!['admin', 'staff'].includes(rol)) return res.status(400).json({ error: 'Rol inválido' });
  try {
    let localId = null;
    if (local_id) {
      const local = await pool.query('SELECT id FROM locales WHERE id = $1 AND colegio_id = $2', [local_id, req.empleado.colegio_id]);
      if (local.rows.length === 0) return res.status(400).json({ error: 'Local inválido' });
      localId = local_id;
    }
    const resultado = await pool.query(
      'INSERT INTO empleados (nombre, usuario, pin, rol, colegio_id, local_id) VALUES ($1, $2, NULL, $3, $4, $5) RETURNING id, nombre, usuario, rol, local_id, activo',
      [nombre.trim(), usuario.trim(), rol, req.empleado.colegio_id, localId]
    );
    const activacion = await generarCodigoActivacion(resultado.rows[0].id);
    await registrar(req.empleado.id, req.empleado.colegio_id, 'Nuevo empleado', `${nombre.trim()} (pendiente de activación)`);
    res.json({ ...resultado.rows[0], pendiente_activacion: true, codigo_activacion_expira: activacion.expira, ...activacion });
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Ya existe un empleado con ese usuario' });
    res.status(500).json({ error: 'Error del servidor' });
  }
};

// El empleado activa su cuenta con el código y elige su propio PIN (público)
const activarCuenta = async (req, res) => {
  const { colegio, usuario, codigo, pin } = req.body;
  if (!pinValido(pin)) return res.status(400).json({ error: 'El PIN tiene que tener entre 4 y 6 números' });
  try {
    const r = await pool.query(
      `SELECT e.id, e.colegio_id, e.nombre, e.codigo_activacion, e.codigo_activacion_expira
       FROM empleados e JOIN colegios c ON c.id = e.colegio_id
       WHERE c.slug = $1 AND c.activo = true AND LOWER(e.usuario) = LOWER($2) AND e.activo = true`,
      [String(colegio || '').trim().toLowerCase(), String(usuario || '').trim()]
    );
    const e = r.rows[0];
    const invalido = () => res.status(400).json({ error: 'Código inválido o vencido. Pedile uno nuevo al administrador.' });
    if (!e || !e.codigo_activacion) return invalido();
    if (new Date(e.codigo_activacion_expira) < new Date()) return invalido();
    if (!(await bcrypt.compare(normalizarCodigo(codigo), e.codigo_activacion))) return invalido();

    const hash = await bcrypt.hash(String(pin), 10);
    await pool.query(
      'UPDATE empleados SET pin = $1, codigo_activacion = NULL, codigo_activacion_expira = NULL WHERE id = $2',
      [hash, e.id]
    );
    await registrar(e.id, e.colegio_id, 'Cuenta activada', e.nombre);
    res.json({ mensaje: 'Cuenta activada. Ya podés iniciar sesión con tu PIN.' });
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
    olvidarSesion('empleado', resultado.rows[0].id); // la zona nueva vale enseguida
    await registrar(req.empleado.id, req.empleado.colegio_id, 'Zona reasignada', `Empleado: ${resultado.rows[0].nombre}`);
    res.json(resultado.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

const toggleEmpleado = async (req, res) => {
  const { id } = req.params;
  if (Number(id) === req.empleado.id) return res.status(400).json({ error: 'No podés desactivar tu propio usuario' });
  try {
    const resultado = await pool.query(
      'UPDATE empleados SET activo = NOT activo WHERE id = $1 AND colegio_id = $2 RETURNING id, nombre, activo',
      [id, req.empleado.colegio_id]
    );
    if (resultado.rows.length === 0) return res.status(404).json({ error: 'Empleado no encontrado' });
    const e = resultado.rows[0];
    olvidarSesion('empleado', e.id); // desactivado: deja de poder usar el sistema enseguida
    await registrar(req.empleado.id, req.empleado.colegio_id, e.activo ? 'Empleado activado' : 'Empleado desactivado', e.nombre);
    res.json(e);
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

const cambiarPin = async (req, res) => {
  const { id } = req.params;
  const { pin_actual, pin_nuevo } = req.body;
  if (Number(id) !== req.empleado.id) return res.status(403).json({ error: 'Sólo podés cambiar tu propio PIN' });
  if (!pinValido(pin_nuevo)) return res.status(400).json({ error: 'El PIN tiene que tener entre 4 y 6 números' });
  try {
    const resultado = await pool.query(
      'SELECT * FROM empleados WHERE id = $1 AND colegio_id = $2',
      [id, req.empleado.colegio_id]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Empleado no encontrado' });
    }

    const empleado = resultado.rows[0];
    const pinCorrecto = empleado.pin && await bcrypt.compare(String(pin_actual || ''), empleado.pin);

    if (!pinCorrecto) {
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

// Si el empleado olvidó su PIN: el admin genera un código nuevo (el PIN
// anterior deja de funcionar) y el empleado vuelve a elegir el suyo
const resetearPin = async (req, res) => {
  const { id } = req.params;
  try {
    const resultado = await pool.query(
      'SELECT id, nombre FROM empleados WHERE id = $1 AND colegio_id = $2', [id, req.empleado.colegio_id]
    );
    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Empleado no encontrado' });
    }
    const activacion = await generarCodigoActivacion(id);
    await registrar(req.empleado.id, req.empleado.colegio_id, 'Nuevo código de activación', `${resultado.rows[0].nombre} (el PIN anterior dejó de funcionar)`);
    res.json({ mensaje: 'Código generado', ...activacion });
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

module.exports = { login, getEmpleados, crearEmpleado, activarCuenta, toggleEmpleado, cambiarPin, resetearPin, asignarZona };
