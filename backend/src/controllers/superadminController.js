const pool = require('../db/conexion');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const secretValido = (recibido) => {
  const secreto = process.env.SUPERADMIN_SECRET;
  if (!secreto || !recibido) return false;
  const a = Buffer.from(String(recibido));
  const b = Buffer.from(String(secreto));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
};

const login = async (req, res) => {
  const { password } = req.body;
  if (!secretValido(password)) {
    return res.status(401).json({ error: 'Contraseña incorrecta' });
  }
  const token = jwt.sign({ tipo: 'superadmin' }, process.env.JWT_SECRET, { expiresIn: '12h' });
  res.json({ token });
};

const slugify = (texto) =>
  texto
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'colegio';

const getColegios = async (req, res) => {
  try {
    const resultado = await pool.query(`
      SELECT c.*,
        (SELECT COUNT(*) FROM alumnos a WHERE a.colegio_id = c.id) AS alumnos_count,
        (SELECT COUNT(*) FROM empleados e WHERE e.colegio_id = c.id) AS empleados_count,
        (SELECT COALESCE(SUM(t.monto), 0) FROM transacciones t WHERE t.colegio_id = c.id AND t.tipo = 'recarga') AS volumen_recargas
      FROM colegios c
      ORDER BY c.creado_en DESC
    `);
    const colegios = resultado.rows.map(c => ({
      ...c,
      mp_conectado: !!c.mp_access_token,
      comision_estimada: (parseFloat(c.volumen_recargas) * parseFloat(c.comision_pct) / 100).toFixed(2),
      mp_access_token: undefined,
      mp_refresh_token: undefined,
    }));
    res.json(colegios);
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

const crearColegio = async (req, res) => {
  const { nombre, comision_pct } = req.body;
  if (!nombre?.trim()) return res.status(400).json({ error: 'Nombre requerido' });
  try {
    let slug = slugify(nombre);
    let sufijo = 0;
    while (true) {
      const slugProbado = sufijo === 0 ? slug : `${slug}-${sufijo}`;
      const choque = await pool.query('SELECT id FROM colegios WHERE slug = $1', [slugProbado]);
      if (choque.rows.length === 0) { slug = slugProbado; break; }
      sufijo++;
    }
    const resultado = await pool.query(
      'INSERT INTO colegios (nombre, slug, comision_pct) VALUES ($1, $2, $3) RETURNING *',
      [nombre.trim(), slug, comision_pct || 5]
    );
    res.json(resultado.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

const actualizarColegio = async (req, res) => {
  const { id } = req.params;
  const { comision_pct, activo, plan } = req.body;
  try {
    const campos = [];
    const valores = [];
    if (comision_pct !== undefined) { valores.push(comision_pct); campos.push(`comision_pct = $${valores.length}`); }
    if (activo !== undefined)       { valores.push(activo);       campos.push(`activo = $${valores.length}`); }
    if (plan !== undefined)         { valores.push(plan);         campos.push(`plan = $${valores.length}`); }
    if (campos.length === 0) return res.status(400).json({ error: 'Nada para actualizar' });

    valores.push(id);
    const resultado = await pool.query(
      `UPDATE colegios SET ${campos.join(', ')} WHERE id = $${valores.length} RETURNING *`,
      valores
    );
    if (resultado.rows.length === 0) return res.status(404).json({ error: 'Colegio no encontrado' });
    res.json(resultado.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

module.exports = { login, getColegios, crearColegio, actualizarColegio };
