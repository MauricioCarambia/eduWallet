const jwt = require('jsonwebtoken');
const pool = require('../db/conexion');
require('dotenv').config();

// Problemas de sesión → 401 (las apps cierran la sesión). Lo que el usuario no
// puede hacer pero con la sesión bien (ej.: no es admin) → 403 (no la cierran).

// El token guarda el rol y la zona del momento del login (dura 8 h; el de los
// padres, 30 días). Para que desactivar a alguien, cambiarle la zona o el rol,
// o suspender un colegio, valga enseguida, se consulta el estado actual en la
// base, con una memoria de 30 segundos para no consultar en cada pedido.
const MEMORIA_MS = 30 * 1000;
const memoria = new Map();
const recordado = async (clave, buscar) => {
  const m = memoria.get(clave);
  if (m && Date.now() - m.t < MEMORIA_MS) return m.valor;
  const valor = await buscar();
  memoria.set(clave, { valor, t: Date.now() });
  if (memoria.size > 5000) memoria.delete(memoria.keys().next().value);
  return valor;
};
// Para que un cambio hecho desde el admin se note sin esperar (ej.: desactivar)
const olvidarSesion = (tipo, id) => memoria.delete(`${tipo}:${id}`);

const leerToken = req => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return { error: 'Acceso denegado. Token requerido.' };
  try { return { datos: jwt.verify(token, process.env.JWT_SECRET) }; }
  catch { return { error: 'Sesión vencida o token inválido. Volvé a entrar.' }; }
};

const verificarToken = async (req, res, next) => {
  const { datos, error } = leerToken(req);
  if (error) return res.status(401).json({ error });
  // Sólo tokens de empleados (no de padres ni del superadmin)
  if (datos.tipo || !datos.id || !datos.colegio_id) return res.status(401).json({ error: 'Acceso restringido.' });
  try {
    const actual = await recordado(`empleado:${datos.id}`, async () => (await pool.query(
      `SELECT e.activo, e.rol, e.local_id, e.colegio_id, c.activo AS colegio_activo
       FROM empleados e JOIN colegios c ON c.id = e.colegio_id WHERE e.id = $1`,
      [datos.id]
    )).rows[0] || null);
    if (!actual || !actual.activo) return res.status(401).json({ error: 'Tu usuario está desactivado. Hablá con el administrador del colegio.' });
    if (!actual.colegio_activo) return res.status(401).json({ error: 'El colegio está suspendido. Hablá con KoleTap.' });
    req.empleado = { ...datos, rol: actual.rol, local_id: actual.local_id, colegio_id: actual.colegio_id };
    next();
  } catch (err) {
    console.error('Verificando sesión:', err.message);
    return res.status(503).json({ error: 'No se pudo verificar la sesión. Probá de nuevo.' });
  }
};

const soloAdmin = (req, res, next) => {
  if (req.empleado.rol !== 'admin') {
    return res.status(403).json({ error: 'Acceso restringido a administradores.' });
  }
  next();
};

// El POS es sólo para el personal que trabaja en las zonas (kiosco,
// comedor, librería...). El admin del colegio usa el panel admin: ve las
// cajas y los reportes, pero no vende ni gestiona productos.
const soloPersonalPos = (req, res, next) => {
  if (req.empleado.rol === 'admin') {
    return res.status(403).json({ error: 'Los administradores del colegio no operan el POS.' });
  }
  next();
};

const verificarSuperAdmin = (req, res, next) => {
  const { datos, error } = leerToken(req);
  if (error) return res.status(401).json({ error });
  if (datos.tipo !== 'superadmin') return res.status(401).json({ error: 'Acceso restringido' });
  next();
};

const verificarPadre = async (req, res, next) => {
  const { datos, error } = leerToken(req);
  if (error) return res.status(401).json({ error });
  if (datos.tipo !== 'padre' || !datos.id) return res.status(401).json({ error: 'Acceso restringido a padres' });
  try {
    const activo = await recordado(`padre:${datos.id}`, async () =>
      (await pool.query('SELECT activo FROM padres WHERE id = $1', [datos.id])).rows[0]?.activo === true);
    if (!activo) return res.status(401).json({ error: 'Tu cuenta está desactivada. Hablá con el colegio.' });
    req.padre = datos;
    next();
  } catch (err) {
    console.error('Verificando sesión:', err.message);
    return res.status(503).json({ error: 'No se pudo verificar la sesión. Probá de nuevo.' });
  }
};

module.exports = { verificarToken, soloAdmin, soloPersonalPos, verificarPadre, verificarSuperAdmin, olvidarSesion };
