const express = require('express');
const router = express.Router();
const { verificarToken, soloAdmin } = require('../middlewares/auth');
const { getTransacciones, getTransaccionesAlumno, cobrar, anularVenta } = require('../controllers/transaccionesController');

/**
 * @swagger
 * tags:
 *   name: Transacciones
 *   description: Compras, recargas y anulaciones
 */

/**
 * @swagger
 * /transacciones:
 *   get:
 *     summary: Listar transacciones (paginado, solo admin)
 *     tags: [Transacciones]
 *     parameters:
 *       - in: query
 *         name: desde
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: hasta
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: tipo
 *         schema: { type: string, enum: [compra, recarga, anulacion] }
 *       - in: query
 *         name: lugar
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 500 }
 *     responses:
 *       200:
 *         description: Listado paginado de transacciones
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/TransaccionesPaginadas' }
 */
router.get('/', verificarToken, soloAdmin, getTransacciones);

/**
 * @swagger
 * /transacciones/alumno/{id}:
 *   get:
 *     summary: Listar transacciones de un alumno
 *     tags: [Transacciones]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Lista de transacciones del alumno
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/Transaccion' }
 */
router.get('/alumno/:id', verificarToken, getTransaccionesAlumno);

/**
 * @swagger
 * /transacciones/cobrar:
 *   post:
 *     summary: Registrar una compra/cobro en el POS
 *     tags: [Transacciones]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [alumno_id, items, lugar]
 *             properties:
 *               alumno_id: { type: integer }
 *               empleado_id: { type: integer }
 *               caja_id: { type: integer }
 *               lugar: { type: string, example: "Kiosco" }
 *               descuento: { type: number, example: 0 }
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     id: { type: integer }
 *                     nombre: { type: string }
 *                     precio: { type: number }
 *                     qty: { type: integer }
 *     responses:
 *       200:
 *         description: Transacción registrada y alumno actualizado
 *       400:
 *         description: Saldo insuficiente, límite diario excedido o tarjeta bloqueada
 *       404:
 *         description: Alumno no encontrado
 */
router.post('/cobrar', verificarToken, cobrar);

/**
 * @swagger
 * /transacciones/{id}/anular:
 *   delete:
 *     summary: Anular una venta (dentro de las 24hs) y devolver saldo y stock
 *     tags: [Transacciones]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Venta anulada
 *       400:
 *         description: Fuera del plazo de 24hs para anular
 *       404:
 *         description: Transacción no encontrada
 */
router.delete('/:id/anular', verificarToken, anularVenta);

module.exports = router;
