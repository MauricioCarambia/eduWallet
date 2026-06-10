const express = require('express');
const router = express.Router();
const { getConfiguracion, getBranding, actualizarConfiguracion, testEmail } = require('../controllers/configuracionController');
const { verificarToken, soloAdmin } = require('../middlewares/auth');

/**
 * @swagger
 * tags:
 *   name: Configuración
 *   description: Configuración general del colegio (branding, umbrales, email)
 */

/**
 * @swagger
 * /configuracion/branding:
 *   get:
 *     summary: Obtener nombre y logo del colegio (público, sin autenticación)
 *     tags: [Configuración]
 *     security: []
 *     responses:
 *       200:
 *         description: Nombre y logo del colegio
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 nombre_colegio: { type: string }
 *                 logo: { type: string, nullable: true, description: "Logo en base64" }
 */
router.get('/branding', getBranding); // público — sin auth

/**
 * @swagger
 * /configuracion:
 *   get:
 *     summary: Obtener la configuración completa del colegio (solo admin)
 *     tags: [Configuración]
 *     responses:
 *       200:
 *         description: Configuración del colegio
 *   put:
 *     summary: Actualizar la configuración del colegio (solo admin)
 *     tags: [Configuración]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nombre_colegio: { type: string }
 *               direccion: { type: string }
 *               telefono: { type: string }
 *               email_admin: { type: string }
 *               email_smtp: { type: string }
 *               email_smtp_pass: { type: string }
 *               email_smtp_host: { type: string }
 *               email_smtp_port: { type: integer }
 *               umbral_saldo_bajo: { type: number }
 *               umbral_stock_bajo: { type: integer }
 *               moneda: { type: string }
 *               logo: { type: string, nullable: true, description: "Logo en base64 (máx ~200KB), null para borrar" }
 *     responses:
 *       200:
 *         description: Configuración guardada
 *       400:
 *         description: El logo es demasiado grande
 */
router.get('/', verificarToken, soloAdmin, getConfiguracion);
router.put('/', verificarToken, soloAdmin, actualizarConfiguracion);

/**
 * @swagger
 * /configuracion/test-email:
 *   post:
 *     summary: Enviar un email de prueba (solo admin)
 *     tags: [Configuración]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string }
 *     responses:
 *       200:
 *         description: Email de prueba enviado
 */
router.post('/test-email', verificarToken, soloAdmin, testEmail);

module.exports = router;
