const pool = require('../db/conexion');
const jwt = require('jsonwebtoken');

const REDIRECT_URI = `${process.env.BACKEND_URL}/api/mp/callback`;

const construirUrlAutorizacion = (state) =>
  `https://auth.mercadopago.com/authorization?client_id=${process.env.MP_CLIENT_ID}&response_type=code&platform_id=mp&state=${encodeURIComponent(state)}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;

const mpConfigurado = () => !!(process.env.MP_CLIENT_ID && process.env.MP_CLIENT_SECRET);

// El admin conecta la cuenta de Mercado Pago del colegio (recibe recargas)
const iniciarColegio = async (req, res) => {
  if (!mpConfigurado()) return res.status(503).json({ error: 'La conexión con Mercado Pago todavía no está configurada' });
  const state = jwt.sign({ tipo: 'colegio', colegio_id: req.empleado.colegio_id }, process.env.JWT_SECRET, { expiresIn: '10m' });
  res.json({ url: construirUrlAutorizacion(state) });
};

// Un empleado conecta su propia cuenta (recibe la liquidación de su turno)
const iniciarEmpleado = async (req, res) => {
  if (!mpConfigurado()) return res.status(503).json({ error: 'La conexión con Mercado Pago todavía no está configurada' });
  const state = jwt.sign({ tipo: 'empleado', empleado_id: req.empleado.id }, process.env.JWT_SECRET, { expiresIn: '10m' });
  res.json({ url: construirUrlAutorizacion(state) });
};

const intercambiarCodigo = async (code) => {
  const resp = await fetch('https://api.mercadopago.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.MP_CLIENT_ID,
      client_secret: process.env.MP_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: REDIRECT_URI,
    }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.message || 'Error al intercambiar el código con Mercado Pago');
  return data; // { access_token, refresh_token, user_id, ... }
};

// Mercado Pago redirige acá con ?code=...&state=... después de que el
// colegio o el empleado autoriza. No requiere sesión propia (viene del
// navegador tras el login en Mercado Pago) — el "state" firmado es lo
// que nos dice a quién pertenece, y evita que alguien lo falsifique.
const callback = async (req, res) => {
  const { code, state, error: mpError } = req.query;

  let destino = process.env.ADMIN_URL || '/';
  try {
    if (mpError) throw new Error('Autorización cancelada');
    if (!code || !state) throw new Error('Faltan parámetros de Mercado Pago');

    const payload = jwt.verify(state, process.env.JWT_SECRET);
    const tokens = await intercambiarCodigo(code);

    if (payload.tipo === 'colegio') {
      await pool.query(
        'UPDATE colegios SET mp_access_token = $1, mp_refresh_token = $2, mp_user_id = $3 WHERE id = $4',
        [tokens.access_token, tokens.refresh_token, String(tokens.user_id), payload.colegio_id]
      );
      destino = `${process.env.ADMIN_URL || ''}/configuracion?mp=conectado`;
    } else if (payload.tipo === 'empleado') {
      await pool.query(
        'UPDATE empleados SET mp_access_token = $1, mp_refresh_token = $2, mp_user_id = $3 WHERE id = $4',
        [tokens.access_token, tokens.refresh_token, String(tokens.user_id), payload.empleado_id]
      );
      destino = `${process.env.POS_URL || ''}/?mp=conectado`;
    } else {
      throw new Error('Estado inválido');
    }

    res.redirect(destino);
  } catch (err) {
    console.error('Error en callback de Mercado Pago:', err.message);
    const base = destino.includes('?') ? destino.split('?')[0] : destino;
    res.redirect(`${base}?mp=error`);
  }
};

// Estado de conexión para pintar el botón correcto en admin/POS
const estado = async (req, res) => {
  try {
    const colegio = await pool.query('SELECT mp_access_token IS NOT NULL AS conectado FROM colegios WHERE id = $1', [req.empleado.colegio_id]);
    const empleado = await pool.query('SELECT mp_access_token IS NOT NULL AS conectado FROM empleados WHERE id = $1', [req.empleado.id]);
    res.json({
      disponible: mpConfigurado(),
      colegio_conectado: colegio.rows[0]?.conectado || false,
      empleado_conectado: empleado.rows[0]?.conectado || false,
    });
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

module.exports = { iniciarColegio, iniciarEmpleado, callback, estado, mpConfigurado };
