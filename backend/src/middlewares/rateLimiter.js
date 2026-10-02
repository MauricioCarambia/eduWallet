const rateLimit = require('express-rate-limit');

// Login de empleados (PIN) — 10 intentos por 15 minutos por IP
const loginEmpleadosLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Demasiados intentos de login. Intentá de nuevo en 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Login de padres — 10 intentos por 15 minutos por IP
const loginPadresLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Demasiados intentos de login. Intentá de nuevo en 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Registro de padres — 5 registros por hora por IP (evitar spam de cuentas)
const registroPadresLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: 'Demasiados registros desde esta IP. Intentá de nuevo en una hora.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Recuperación de contraseña — 5 solicitudes por hora por IP (evitar spam de emails)
const recuperacionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: 'Demasiadas solicitudes de recuperación. Intentá de nuevo en una hora.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Formulario de contacto de la página — 5 consultas por hora por IP (evitar spam)
const contactoLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: 'Ya recibimos varias consultas desde tu conexión. Escribinos por WhatsApp o probá en una hora.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Vincular un hijo con el código del colegio — 20 intentos por hora por IP
// (que no se puedan probar códigos al azar)
const vincularLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: { error: 'Demasiados intentos con códigos de vinculación. Probá de nuevo en una hora.' },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { vincularLimiter, loginEmpleadosLimiter, loginPadresLimiter, registroPadresLimiter, recuperacionLimiter, contactoLimiter };
