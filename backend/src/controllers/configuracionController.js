const pool = require('../db/conexion');

const getConfiguracion = async (req, res) => {
  try {
    const res2 = await pool.query('SELECT * FROM configuracion LIMIT 1');
    const config = res2.rows[0];
    // no devolver la contraseña del email
    if (config) delete config.email_smtp_pass;
    res.json(config || {});
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

const actualizarConfiguracion = async (req, res) => {
  const {
    nombre_colegio, direccion, telefono, email_admin,
    email_smtp, email_smtp_pass, email_smtp_host, email_smtp_port,
    umbral_saldo_bajo, umbral_stock_bajo, moneda,
    cloudinary_cloud_name, cloudinary_api_key, cloudinary_api_secret
  } = req.body;
  try {
    const existe = await pool.query('SELECT id FROM configuracion LIMIT 1');

    const passEmail = email_smtp_pass ? `, email_smtp_pass = '${email_smtp_pass}'` : '';
    const passCloud = cloudinary_api_secret ? `, cloudinary_api_secret = '${cloudinary_api_secret}'` : '';

    if (existe.rows.length === 0) {
      await pool.query(
        `INSERT INTO configuracion (nombre_colegio, direccion, telefono, email_admin, email_smtp, email_smtp_pass, email_smtp_host, email_smtp_port, umbral_saldo_bajo, umbral_stock_bajo, moneda, cloudinary_cloud_name, cloudinary_api_key, cloudinary_api_secret)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [nombre_colegio, direccion, telefono, email_admin, email_smtp, email_smtp_pass, email_smtp_host, email_smtp_port, umbral_saldo_bajo, umbral_stock_bajo, moneda, cloudinary_cloud_name, cloudinary_api_key, cloudinary_api_secret]
      );
    } else {
      await pool.query(
        `UPDATE configuracion SET
          nombre_colegio=$1, direccion=$2, telefono=$3, email_admin=$4,
          email_smtp=$5, email_smtp_host=$6, email_smtp_port=$7,
          umbral_saldo_bajo=$8, umbral_stock_bajo=$9, moneda=$10,
          cloudinary_cloud_name=$11, cloudinary_api_key=$12
          ${passEmail} ${passCloud}
         WHERE id = ${existe.rows[0].id}`,
        [nombre_colegio, direccion, telefono, email_admin, email_smtp, email_smtp_host, email_smtp_port, umbral_saldo_bajo, umbral_stock_bajo, moneda, cloudinary_cloud_name, cloudinary_api_key]
      );
    }
    res.json({ mensaje: 'Configuración guardada correctamente' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
};

const testEmail = async (req, res) => {
  const { enviarEmailSaldoBajo } = require('../services/emailService');
  try {
    await enviarEmailSaldoBajo({
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

module.exports = { getConfiguracion, actualizarConfiguracion, testEmail };