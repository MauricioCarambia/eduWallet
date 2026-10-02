const pool = require('../db/conexion');

const getConfiguracion = async (req, res) => {
  try {
    const resultado = await pool.query('SELECT * FROM configuracion WHERE colegio_id = $1', [req.empleado.colegio_id]);
    const config = resultado.rows[0];
    if (config) delete config.email_smtp_pass;
    res.json(config || {});
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

// Branding para un empleado autenticado (admin o staff) — no exige soloAdmin
// porque lo usa el layout de cualquier pantalla, incluida la del POS.
const getMiColegio = async (req, res) => {
  try {
    const resultado = await pool.query(
      // Sin nombre en Configuración, el nombre con el que se dio de alta el colegio
      `SELECT COALESCE(NULLIF(c.nombre_colegio, ''), co.nombre) AS nombre_colegio, c.logo, COALESCE(c.umbral_stock_bajo, 5) AS umbral_stock_bajo
       FROM colegios co LEFT JOIN configuracion c ON c.colegio_id = co.id WHERE co.id = $1`,
      [req.empleado.colegio_id]
    );
    res.json(resultado.rows[0] || { nombre_colegio: 'KoleTap', logo: null, umbral_stock_bajo: 5 });
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

// Endpoint público — solo devuelve nombre y logo para los layouts
const getBranding = async (req, res) => {
  try {
    const { colegio } = req.query;
    if (!colegio) return res.json({ nombre_colegio: 'KoleTap', logo: null });
    const resultado = await pool.query(
      `SELECT c.nombre_colegio, c.logo FROM configuracion c
       JOIN colegios col ON col.id = c.colegio_id
       WHERE col.slug = $1`,
      [colegio]
    );
    res.json(resultado.rows[0] || { nombre_colegio: 'KoleTap', logo: null });
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

const actualizarConfiguracion = async (req, res) => {
  const {
    nombre_colegio, direccion, telefono, email_admin,
    email_smtp, email_smtp_pass, email_smtp_host, email_smtp_port,
    umbral_saldo_bajo, umbral_stock_bajo, moneda
  } = req.body;
  // Tope por alumno y por día con la caja sin internet (vacío = no se cambia)
  const topeOffline = req.body.tope_offline === undefined || req.body.tope_offline === '' || req.body.tope_offline === null ? null : Number(req.body.tope_offline);
  if (topeOffline !== null && (!Number.isFinite(topeOffline) || topeOffline < 0 || topeOffline > 10000000)) {
    return res.status(400).json({ error: 'El tope sin conexión tiene que ser un monto válido' });
  }

  const { logo } = req.body;
  const colegioId = req.empleado.colegio_id;

  // Validar tamaño del logo si viene (base64 ~200KB máx)
  if (logo && logo.length > 300000) {
    return res.status(400).json({ error: 'El logo es demasiado grande. Máximo 200KB.' });
  }

  try {
    const existe = await pool.query('SELECT id FROM configuracion WHERE colegio_id = $1', [colegioId]);

    if (existe.rows.length === 0) {
      await pool.query(
        `INSERT INTO configuracion (
          nombre_colegio, direccion, telefono, email_admin,
          email_smtp, email_smtp_pass, email_smtp_host, email_smtp_port,
          umbral_saldo_bajo, umbral_stock_bajo, moneda, logo, colegio_id
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [nombre_colegio, direccion, telefono, email_admin,
          email_smtp, email_smtp_pass, email_smtp_host, email_smtp_port,
          umbral_saldo_bajo, umbral_stock_bajo, moneda, logo || null, colegioId]
      );
    } else {
      const id = existe.rows[0].id;
      await pool.query(
        `UPDATE configuracion SET
          nombre_colegio=$1, direccion=$2, telefono=$3, email_admin=$4,
          email_smtp=$5, email_smtp_host=$6, email_smtp_port=$7,
          umbral_saldo_bajo=$8, umbral_stock_bajo=$9, moneda=$10
        WHERE id = $11`,
        [nombre_colegio, direccion, telefono, email_admin,
          email_smtp, email_smtp_host, email_smtp_port,
          umbral_saldo_bajo, umbral_stock_bajo, moneda, id]
      );
      if (topeOffline !== null) {
        await pool.query('UPDATE configuracion SET tope_offline = $1 WHERE id = $2', [topeOffline, id]);
      }
      if (email_smtp_pass) {
        await pool.query('UPDATE configuracion SET email_smtp_pass = $1 WHERE id = $2', [email_smtp_pass, id]);
      }
      // Logo: actualizar siempre (null = borrar, string = actualizar)
      if (logo !== undefined) {
        await pool.query('UPDATE configuracion SET logo = $1 WHERE id = $2', [logo || null, id]);
      }
    }
    res.json({ mensaje: 'Configuración guardada correctamente' });
  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).json({ error: 'Error del servidor' });
  }
};

const testEmail = async (req, res) => {
  const { enviarEmailSaldoBajo } = require('../services/emailService');
  try {
    await enviarEmailSaldoBajo({
      colegioId: req.empleado.colegio_id,
      nombrePadre: 'Administrador',
      emailPadre: req.body.email,
      nombreAlumno: 'Alumno de prueba',
      saldo: 150,
      curso: '4to A'
    });
    res.json({ mensaje: 'Email de prueba enviado correctamente' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Logo del colegio como imagen (público): los mails no pueden mostrar el logo
// guardado como data: URL (Gmail y la mayoría lo bloquean), así que lo piden acá
const getLogo = async (req, res) => {
  try {
    const r = await pool.query('SELECT logo FROM configuracion WHERE colegio_id = $1', [Number.parseInt(req.params.colegioId, 10) || 0]);
    // Solo imágenes comunes (un SVG puede traer scripts)
    const m = /^data:(image\/(?:png|jpe?g|gif|webp));base64,(.+)$/s.exec(r.rows[0]?.logo || '');
    if (!m) return res.status(404).end();
    res.set({ 'Cache-Control': 'public, max-age=86400', 'X-Content-Type-Options': 'nosniff' });
    res.type(m[1]).send(Buffer.from(m[2], 'base64'));
  } catch {
    res.status(500).end();
  }
};

module.exports = { getLogo, getConfiguracion, getBranding, getMiColegio, actualizarConfiguracion, testEmail };
