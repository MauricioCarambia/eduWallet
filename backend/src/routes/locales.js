const express = require('express');
const router = express.Router();
const { getLocales, crearLocal, toggleLocal } = require('../controllers/localesController');
const { verificarToken, soloAdmin } = require('../middlewares/auth');

/**
 * @swagger
 * tags:
 *   name: Locales
 *   description: Zonas de venta configurables por colegio (Kiosco, Comedor, etc.)
 */

/**
 * @swagger
 * /locales:
 *   get:
 *     summary: Listar los locales del colegio (activos por defecto)
 *     tags: [Locales]
 *     parameters:
 *       - in: query
 *         name: todos
 *         schema: { type: string, example: "1" }
 *         description: Si es "1", incluye también los locales desactivados (solo admin lo necesita)
 *     responses:
 *       200:
 *         description: Lista de locales
 *   post:
 *     summary: Crear un local (solo admin)
 *     tags: [Locales]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [nombre]
 *             properties:
 *               nombre: { type: string, example: "Comedor" }
 *     responses:
 *       200:
 *         description: Local creado
 */
router.get('/', verificarToken, getLocales);
router.post('/', verificarToken, soloAdmin, crearLocal);

/**
 * @swagger
 * /locales/{id}/toggle:
 *   patch:
 *     summary: Activar/desactivar un local (solo admin)
 *     tags: [Locales]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Estado actualizado
 */
router.patch('/:id/toggle', verificarToken, soloAdmin, toggleLocal);

module.exports = router;
