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
      'SELECT nombre_colegio, logo FROM configuracion WHERE colegio_id = $1',
      [req.empleado.colegio_id]
    );
    res.json(resultado.rows[0] || { nombre_colegio: 'EduWallet', logo: null });
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

// Endpoint público — solo devuelve nombre y logo para los layouts
const getBranding = async (req, res) => {
  try {
    const { colegio } = req.query;
    if (!colegio) return res.json({ nombre_colegio: 'EduWallet', logo: null });
    const resultado = await pool.query(
      `SELECT c.nombre_colegio, c.logo FROM configuracion c
       JOIN colegios col ON col.id = c.colegio_id
       WHERE col.slug = $1`,
      [colegio]
    );
    res.json(resultado.rows[0] || { nombre_colegio: 'EduWallet', logo: null });
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

module.exports = { getConfiguracion, getBranding, getMiColegio, actualizarConfiguracion, testEmail };
