const pool = require('../db/conexion');
const { enviarEmailContacto } = require('../services/emailService');

// Formulario de contacto de la página de KoleTap (pública, sin login).
// Se guarda la consulta y se avisa por email; el campo "sitio_web" está
// oculto en la página: si viene completo es un robot y se descarta en silencio.
const texto = (v, max) => String(v ?? '').trim().slice(0, max);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const enviarContacto = async (req, res) => {
  if (texto(req.body.sitio_web, 200)) return res.json({ ok: true });

  const datos = {
    nombre: texto(req.body.nombre, 100),
    colegio: texto(req.body.colegio, 150),
    cargo: texto(req.body.cargo, 60) || null,
    email: texto(req.body.email, 150) || null,
    telefono: texto(req.body.telefono, 40) || null,
    alumnos: texto(req.body.alumnos, 30) || null,
    mensaje: texto(req.body.mensaje, 2000) || null,
  };
  if (!datos.nombre || !datos.colegio) return res.status(400).json({ error: 'Completá tu nombre y el del colegio' });
  if (!datos.email && !datos.telefono) return res.status(400).json({ error: 'Dejanos un email o un teléfono para responderte' });
  if (datos.email && !EMAIL.test(datos.email)) return res.status(400).json({ error: 'El email no es válido' });

  try {
    await pool.query(
      `INSERT INTO contactos (nombre, colegio, cargo, email, telefono, alumnos, mensaje, ip)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [datos.nombre, datos.colegio, datos.cargo, datos.email, datos.telefono, datos.alumnos, datos.mensaje, texto(req.ip, 64)]
    );
  } catch (err) {
    console.error('Error guardando contacto:', err.message);
    return res.status(500).json({ error: 'No pudimos enviar la consulta. Probá de nuevo o escribinos por WhatsApp.' });
  }
  enviarEmailContacto(datos).catch(() => {});
  res.json({ ok: true });
};

module.exports = { enviarContacto };
