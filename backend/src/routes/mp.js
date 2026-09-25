const express = require('express');
const router = express.Router();
const { iniciarColegio, iniciarEmpleado, callback, estado } = require('../controllers/mpOauthController');
const { verificarToken, soloAdmin } = require('../middlewares/auth');

/**
 * @swagger
 * tags:
 *   name: MercadoPagoOAuth
 *   description: Conexión de cuentas de Mercado Pago (colegio y empleados) vía OAuth
 */

/**
 * @swagger
 * /mp/estado:
 *   get:
 *     summary: Estado de conexión de Mercado Pago (colegio y del empleado autenticado)
 *     tags: [MercadoPagoOAuth]
 *     responses:
 *       200:
 *         description: Estado de conexión
 */
router.get('/estado', verificarToken, estado);

/**
 * @swagger
 * /mp/conectar/colegio:
 *   get:
 *     summary: Obtener la URL de autorización para conectar el Mercado Pago del colegio (solo admin)
 *     tags: [MercadoPagoOAuth]
 *     responses:
 *       200:
 *         description: URL de autorización de Mercado Pago
 */
router.get('/conectar/colegio', verificarToken, soloAdmin, iniciarColegio);

/**
 * @swagger
 * /mp/conectar/empleado:
 *   get:
 *     summary: Obtener la URL de autorización para conectar el Mercado Pago propio del empleado
 *     tags: [MercadoPagoOAuth]
 *     responses:
 *       200:
 *         description: URL de autorización de Mercado Pago
 */
router.get('/conectar/empleado', verificarToken, iniciarEmpleado);

/**
 * @swagger
 * /mp/callback:
 *   get:
 *     summary: Callback de OAuth de Mercado Pago (lo llama Mercado Pago, no el frontend)
 *     tags: [MercadoPagoOAuth]
 *     security: []
 *     responses:
 *       302:
 *         description: Redirige de vuelta al panel correspondiente
 */
router.get('/callback', callback);

module.exports = router;
