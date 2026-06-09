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

module.exports = { loginEmpleadosLimiter, loginPadresLimiter, registroPadresLimiter };
