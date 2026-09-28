const express = require('express');
const router = express.Router();
const { crearPreferencia, crearLinkPago, procesarPago, webhook, verificarPago, getHistorialPagos, getRecargasColegio } = require('../controllers/pagosController');
const { verificarPadre, verificarToken, soloAdmin } = require('../middlewares/auth');

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
 *     parameters:
 *       - in: query
 *         name: estado
 *         required: false
 *         schema: { type: string, enum: [pendiente, acreditado, rechazado, vencido] }
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

/**
 * @swagger
 * /pagos/colegio:
 *   get:
 *     summary: Recargas por Mercado Pago de todo el colegio (solo admin), paginadas y con resumen por estado
 *     tags: [Pagos]
 *     parameters:
 *       - in: query
 *         name: estado
 *         schema: { type: string, enum: [pendiente, acreditado, rechazado, vencido] }
 *       - in: query
 *         name: q
 *         description: Busca por nombre del alumno, nombre o email del padre
 *         schema: { type: string }
 *       - in: query
 *         name: desde
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: hasta
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: "{ data, total, page, limit, pages, resumen }"
 */
router.get('/colegio', verificarToken, soloAdmin, getRecargasColegio);

/**
 * @swagger
 * /pagos/link:
 *   post:
 *     summary: Generar un link de pago de Mercado Pago para recargar a un alumno (solo admin)
 *     description: Para padres que no usan la app. Pagan como invitados (tarjeta, Rapipago, Pago Fácil); el saldo se acredita por webhook. Vence a las 72 h.
 *     tags: [Pagos]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [alumno_id, monto]
 *             properties:
 *               alumno_id: { type: integer }
 *               monto: { type: number, example: 5000 }
 *     responses:
 *       200:
 *         description: "{ url, expira, alumno, monto, comision, total }"
 */
router.post('/link', verificarToken, soloAdmin, crearLinkPago);

module.exports = router;
