const express = require('express');
const router = express.Router();
const { enviarMensaje } = require('../controllers/mensajesController');
const { verificarToken, soloAdmin } = require('../middlewares/auth');

/**
 * @swagger
 * tags:
 *   name: Mensajes
 *   description: Envío de mensajes/notificaciones a padres
 */

/**
 * @swagger
 * /mensajes:
 *   post:
 *     summary: Enviar un mensaje a uno o varios padres (solo admin)
 *     tags: [Mensajes]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [asunto, mensaje]
 *             properties:
 *               asunto: { type: string }
 *               mensaje: { type: string }
 *               destinatarios:
 *                 type: array
 *                 items: { type: integer }
 *                 description: IDs de padres (vacío = todos)
 *     responses:
 *       200:
 *         description: Mensaje enviado
 */
router.post('/', verificarToken, soloAdmin, enviarMensaje);

module.exports = router;
