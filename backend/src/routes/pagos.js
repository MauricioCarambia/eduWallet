const express = require('express');
const router = express.Router();
const { crearPreferencia, procesarPago, webhook, verificarPago, getHistorialPagos } = require('../controllers/pagosController');
const { verificarPadre } = require('../middlewares/auth');

/**
 * @swagger
 * tags:
 *   name: Pagos
 *   description: Recargas de saldo vía Mercado Pago
 */

/**
 * @swagger
 * /pagos/preferencia:
 *   post:
 *     summary: Crear una preferencia de pago (Checkout Pro de Mercado Pago)
 *     tags: [Pagos]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [monto, alumno_id]
 *             properties:
 *               monto: { type: number, example: 1000 }
 *               alumno_id: { type: integer }
 *     responses:
 *       200:
 *         description: Preferencia creada con init_point para redirigir al pago
 */
router.post('/preferencia', verificarPadre, crearPreferencia);

/**
 * @swagger
 * /pagos/procesar:
 *   post:
 *     summary: Procesar un pago con tarjeta (Checkout API / Brick)
 *     tags: [Pagos]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, monto, alumno_id, payment_method_id]
 *             properties:
 *               token: { type: string }
 *               payment_method_id: { type: string }
 *               issuer_id: { type: string }
 *               installments: { type: integer }
 *               monto: { type: number }
 *               alumno_id: { type: integer }
 *               email: { type: string }
 *     responses:
 *       200:
 *         description: Resultado del pago (approved, pending, rejected, etc.)
 */
router.post('/procesar', verificarPadre, procesarPago);

/**
 * @swagger
 * /pagos/webhook:
 *   post:
 *     summary: Webhook de notificaciones de Mercado Pago
 *     tags: [Pagos]
 *     security: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Notificación procesada
 */
router.post('/webhook', webhook);

/**
 * @swagger
 * /pagos/verificar:
 *   get:
 *     summary: Verificar el estado de un pago y acreditar saldo si corresponde
 *     tags: [Pagos]
 *     parameters:
 *       - in: query
 *         name: payment_id
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: alumno_id
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: monto
 *         required: true
 *         schema: { type: number }
 *     responses:
 *       200:
 *         description: Estado del pago y saldo actualizado
 */
router.get('/verificar', verificarPadre, verificarPago);

/**
 * @swagger
 * /pagos/historial:
 *   get:
 *     summary: Historial de recargas del padre autenticado (últimas 50)
 *     tags: [Pagos]
 *     responses:
 *       200:
 *         description: Lista de pagos con su estado
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/Pago' }
 */
router.get('/historial', verificarPadre, getHistorialPagos);

module.exports = router;
