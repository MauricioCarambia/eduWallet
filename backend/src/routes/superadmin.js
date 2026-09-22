const express = require('express');
const router = express.Router();
const { login, getColegios, crearColegio, actualizarColegio } = require('../controllers/superadminController');
const { verificarSuperAdmin } = require('../middlewares/auth');
const { loginEmpleadosLimiter } = require('../middlewares/rateLimiter');

/**
 * @swagger
 * tags:
 *   name: SuperAdmin
 *   description: Panel del dueño de la plataforma (todos los colegios)
 */

router.post('/login', loginEmpleadosLimiter, login);
router.get('/colegios', verificarSuperAdmin, getColegios);
router.post('/colegios', verificarSuperAdmin, crearColegio);
router.patch('/colegios/:id', verificarSuperAdmin, actualizarColegio);

module.exports = router;
