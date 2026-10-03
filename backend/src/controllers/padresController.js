const pool = require('../db/conexion');
const { registrarPadreEnColegio } = require('../db/migracion_padres_colegios');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const QRCode = require('qrcode');
const { enviarEmailRecuperacion } = require('../services/emailService');
const { notificarBloqueo } = require('../services/notificacionesService');
const { gastoDeLaSemana } = require('../services/consumoAlumno');
require('dotenv').config();

// Email siempre en minúscula y sin espacios: "Juan@Gmail.com " y "juan@gmail.com" son la misma cuenta
const normalizarEmail = e => String(e ?? '').trim().toLowerCase();
const EMAIL = /^[^s@]+@[^s@]+.[^s@]+$/;

const registro = async (req, res) => {
  const nombre = String(req.body?.nombre ?? '').trim();
  const email = normalizarEmail(req.body?.email);
  const password = String(req.body?.password ?? '');
  if (nombre.length < 2 || nombre.length > 100) return res.status(400).json({ error: 'Poné tu nombre y apellido' });
  if (!EMAIL.test(email) || email.length > 150) return res.status(400).json({ error: 'El email no es válido' });
  if (password.length < 6 || password.length > 72) return res.status(400).json({ error: 'La contraseña tiene que tener entre 6 y 72 caracteres' });
  try {
    const existe = await pool.query('SELECT id FROM padres WHERE lower(email) = $1', [email]);
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
  const email = normalizarEmail(req.body?.email);
  const password = String(req.body?.password ?? '');
  if (!email || !password) return res.status(400).json({ error: 'Completá email y contraseña' });
  try {
    const resultado = await pool.query('SELECT * FROM padres WHERE lower(email) = $1 AND activo = true', [email]);
    const padre = resultado.rows[0];
    // El mismo mensaje en los dos casos: no revela qué emails tienen cuenta
    if (!padre || !padre.password || !(await bcrypt.compare(password, padre.password))) {
      return res.status(401).json({ error: 'Email o contraseña incorrectos' });
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
      `SELECT a.*, pa.relacion, c.comision_pct FROM alumnos a
       JOIN padres_alumnos pa ON pa.alumno_id = a.id
       JOIN colegios c ON c.id = a.colegio_id
       WHERE pa.padre_id = $1`,
      [padreId]
    );
    for (const a of resultado.rows) a.gasto_semana = a.limite_semanal != null ? await gastoDeLaSemana(pool, a.id) : null;
    res.json(resultado.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

const vincularAlumno = async (req, res) => {
  const padreId = req.padre.id;
  const { codigo_vinculacion, relacion } = req.body;
  if (!codigo_vinculacion?.trim()) {
    return res.status(400).json({ error: 'Código de vinculación requerido' });
  }
  try {
    const alumno = await pool.query(
      'SELECT id, nombre, curso, colegio_id FROM alumnos WHERE codigo_vinculacion = $1',
      [codigo_vinculacion.trim().toUpperCase()]
    );
    if (alumno.rows.length === 0) {
      return res.status(404).json({ error: 'Código de vinculación inválido' });
    }
    const alumnoId = alumno.rows[0].id;
    const existe = await pool.query(
      'SELECT id FROM padres_alumnos WHERE padre_id = $1 AND alumno_id = $2',
      [padreId, alumnoId]
    );
    if (existe.rows.length > 0) {
      return res.status(400).json({ error: 'Ya está vinculado a este alumno' });
    }
    await pool.query(
      'INSERT INTO padres_alumnos (padre_id, alumno_id, relacion) VALUES ($1, $2, $3)',
      [padreId, alumnoId, relacion || 'tutor']
    );
    await registrarPadreEnColegio(padreId, alumno.rows[0].colegio_id);
    const { colegio_id: _colegio, ...datosAlumno } = alumno.rows[0];
    res.json({ mensaje: 'Alumno vinculado correctamente', alumno: datosAlumno });
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

const getTransaccionesAlumno = async (req, res) => {
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
      'SELECT * FROM transacciones WHERE alumno_id = $1 ORDER BY fecha DESC',
      [alumno_id]
    );
    res.json(resultado.rows);
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
    const a = resultado.rows[0];
    notificarBloqueo({ colegioId: a.colegio_id, alumno: a, padreId,
      texto: a.activo ? `Se habilitaron de nuevo las compras de ${a.nombre}.` : `Se bloquearon todas las compras de ${a.nombre}.` });
    res.json(a);
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

// Límites de gasto: diario y/o semanal (limite_semanal null = sin límite semanal)
const actualizarLimite = async (req, res) => {
  const { alumno_id } = req.params;
  const padreId = req.padre.id;
  const cambios = {};
  if ('limite_diario' in req.body) {
    const d = Number(req.body.limite_diario);
    if (!Number.isFinite(d) || d <= 0 || d > 10000000) return res.status(400).json({ error: 'El límite diario tiene que ser mayor a 0' });
    cambios.limite_diario = d;
  }
  if ('limite_semanal' in req.body) {
    const v = req.body.limite_semanal;
    const s = v === null || v === '' ? null : Number(v);
    if (s !== null && (!Number.isFinite(s) || s <= 0 || s > 10000000)) return res.status(400).json({ error: 'El límite semanal tiene que ser mayor a 0' });
    cambios.limite_semanal = s;
  }
  if (Object.keys(cambios).length === 0) return res.status(400).json({ error: 'No hay límites para guardar' });
  try {
    const vinculo = await pool.query(
      'SELECT id FROM padres_alumnos WHERE padre_id = $1 AND alumno_id = $2',
      [padreId, alumno_id]
    );
    if (vinculo.rows.length === 0) {
      return res.status(403).json({ error: 'No tenés acceso a este alumno' });
    }
    const campos = Object.keys(cambios);
    const resultado = await pool.query(
      `UPDATE alumnos SET ${campos.map((c, i) => `${c} = $${i + 1}`).join(', ')} WHERE id = $${campos.length + 1} RETURNING *`,
      [...campos.map(c => cambios[c]), alumno_id]
    );
    const alumno = resultado.rows[0];
    alumno.gasto_semana = alumno.limite_semanal != null ? await gastoDeLaSemana(pool, alumno.id) : null;
    res.json(alumno);
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

const solicitarRecuperacion = async (req, res) => {
  const email = normalizarEmail(req.body?.email);
  if (!email) return res.status(400).json({ error: 'Email requerido' });
  try {
    const resultado = await pool.query('SELECT * FROM padres WHERE lower(email) = $1 AND activo = true', [email]);

    // Siempre respondemos OK para no revelar si el email existe o no
    if (resultado.rows.length === 0) {
      return res.json({ mensaje: 'Si el email existe, recibirás un enlace en minutos.' });
    }

    const padre = resultado.rows[0];
    const token = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

    await pool.query(
      'UPDATE padres SET reset_token = $1, reset_token_expiry = $2 WHERE id = $3',
      [token, expiry, padre.id]
    );

    const linkReset = `${process.env.PADRES_URL}/resetear-password?token=${token}`;

    await enviarEmailRecuperacion({
      nombrePadre: padre.nombre,
      emailPadre: padre.email,
      linkReset
    });

    res.json({ mensaje: 'Si el email existe, recibirás un enlace en minutos.' });
  } catch (err) {
    console.error('Error solicitarRecuperacion:', err);
    res.status(500).json({ error: 'Error del servidor' });
  }
};

const resetearPassword = async (req, res) => {
  const { token, nuevaPassword } = req.body;
  if (!token || !nuevaPassword) return res.status(400).json({ error: 'Datos incompletos' });
  if (nuevaPassword.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });

  try {
    const resultado = await pool.query(
      'SELECT * FROM padres WHERE reset_token = $1 AND reset_token_expiry > NOW()',
      [token]
    );

    if (resultado.rows.length === 0) {
      return res.status(400).json({ error: 'El enlace es inválido o ya expiró. Solicitá uno nuevo.' });
    }

    const padre = resultado.rows[0];
    const hash = await bcrypt.hash(nuevaPassword, 10);

    await pool.query(
      'UPDATE padres SET password = $1, reset_token = NULL, reset_token_expiry = NULL WHERE id = $2',
      [hash, padre.id]
    );

    res.json({ mensaje: 'Contraseña actualizada correctamente. Ya podés iniciar sesión.' });
  } catch (err) {
    console.error('Error resetearPassword:', err);
    res.status(500).json({ error: 'Error del servidor' });
  }
};

// Credencial de un hijo (nombre, curso, colegio y QR) para verla, descargarla
// o imprimirla desde la app. Sólo de alumnos vinculados al padre.
const getCredencial = async (req, res) => {
  const { alumno_id } = req.params;
  try {
    const r = await pool.query(
      `SELECT a.id, a.nombre, a.curso, a.qr, a.colegio_id FROM alumnos a
       JOIN padres_alumnos pa ON pa.alumno_id = a.id AND pa.padre_id = $1
       WHERE a.id = $2`,
      [req.padre.id, alumno_id]
    );
    if (r.rows.length === 0) return res.status(403).json({ error: 'No tenés acceso a este alumno' });
    const a = r.rows[0];
    const conf = await pool.query('SELECT nombre_colegio, logo FROM configuracion WHERE colegio_id = $1', [a.colegio_id]);
    res.json({
      colegio: conf.rows[0]?.nombre_colegio || '',
      logo: conf.rows[0]?.logo || null,
      credencial: {
        id: a.id, nombre: a.nombre, curso: a.curso,
        qr_img: await QRCode.toDataURL(a.qr, { width: 300, margin: 1, errorCorrectionLevel: 'M' }),
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

// Bloquear o desbloquear un medio de pago (QR de la credencial o tarjeta /
// llavero) sin bloquear todas las compras. Queda en la auditoría del colegio.
const MEDIOS = { qr: { columna: 'qr_bloqueado', nombre: 'QR de la credencial' }, tarjeta: { columna: 'tarjeta_bloqueada', nombre: 'tarjeta / llavero' } };

const bloquearMedio = async (req, res) => {
  const { alumno_id } = req.params;
  const { medio, bloqueado } = req.body;
  const m = MEDIOS[medio];
  if (!m || typeof bloqueado !== 'boolean') return res.status(400).json({ error: 'Datos inválidos' });
  try {
    const vinculo = await pool.query('SELECT id FROM padres_alumnos WHERE padre_id = $1 AND alumno_id = $2', [req.padre.id, alumno_id]);
    if (vinculo.rows.length === 0) return res.status(403).json({ error: 'No tenés acceso a este alumno' });
    const r = await pool.query(`UPDATE alumnos SET ${m.columna} = $1 WHERE id = $2 RETURNING *`, [bloqueado, alumno_id]);
    const padre = await pool.query('SELECT nombre FROM padres WHERE id = $1', [req.padre.id]);
    await pool.query(
      'INSERT INTO auditoria (empleado_id, colegio_id, accion, detalle) VALUES (NULL, $1, $2, $3)',
      [r.rows[0].colegio_id, bloqueado ? 'Medio bloqueado por la familia' : 'Medio desbloqueado por la familia', `${r.rows[0].nombre}: ${m.nombre} (${padre.rows[0]?.nombre || 'padre'})`]
    ).catch(() => {});
    notificarBloqueo({ colegioId: r.rows[0].colegio_id, alumno: r.rows[0], padreId: req.padre.id,
      texto: `Se ${bloqueado ? 'bloqueó' : 'desbloqueó'} ${medio === 'qr' ? 'el QR de la credencial' : 'la tarjeta / llavero'} de ${r.rows[0].nombre}.` });
    res.json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

module.exports = {
  bloquearMedio,
  getCredencial, registro, login, getAlumnos, vincularAlumno, getTransaccionesAlumno, toggleBloqueo, actualizarLimite, solicitarRecuperacion, resetearPassword };