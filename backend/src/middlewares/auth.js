const jwt = require('jsonwebtoken');
require('dotenv').config();

const verificarToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Acceso denegado. Token requerido.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.tipo === 'padre') {
      return res.status(403).json({ error: 'Acceso restringido.' });
    }
    req.empleado = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Token inválido o expirado.' });
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
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token requerido' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.tipo !== 'superadmin') return res.status(403).json({ error: 'Acceso restringido' });
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Token inválido o expirado.' });
  }
};

const verificarPadre = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token requerido' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.tipo !== 'padre') return res.status(403).json({ error: 'Acceso restringido a padres' });
    req.padre = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Token inválido' });
  }
};
module.exports = { verificarToken, soloAdmin, soloPersonalPos, verificarPadre, verificarSuperAdmin };