const express = require('express');
const router = express.Router();
const { abrirCaja, cerrarCaja, getCajas } = require('../controllers/cajasController');
const { verificarToken, soloAdmin } = require('../middlewares/auth');

/**
 * @swagger
 * tags:
 *   name: Cajas
 *   description: Apertura y cierre de cajas (POS)
 */

/**
 * @swagger
 * /cajas:
 *   get:
 *     summary: Listar cajas (solo admin)
 *     tags: [Cajas]
 *     responses:
 *       200:
 *         description: Lista de cajas
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/Caja' }
 *   post:
 *     summary: Abrir una caja
 *     tags: [Cajas]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [local, fondo]
 *             properties:
 *               local: { type: string, example: "Kiosco" }
 *               fondo: { type: number, example: 500 }
 *     responses:
 *       201:
 *         description: Caja abierta
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Caja' }
 */
router.get('/', verificarToken, soloAdmin, getCajas);
router.post('/', verificarToken, abrirCaja);

/**
 * @swagger
 * /cajas/{id}/cerrar:
 *   patch:
 *     summary: Cerrar una caja
 *     tags: [Cajas]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Caja cerrada
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Caja' }
 */
router.patch('/:id/cerrar', verificarToken, cerrarCaja);

module.exports = router;
