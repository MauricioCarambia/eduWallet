const express = require('express');
const router = express.Router();
const { enviarContacto } = require('../controllers/contactoController');
const { contactoLimiter } = require('../middlewares/rateLimiter');

/**
 * @swagger
 * /contacto:
 *   post:
 *     summary: Consulta desde el formulario de la página de EduWallet (sin login)
 *     tags: [Contacto]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [nombre, colegio]
 *             properties:
 *               nombre: { type: string }
 *               colegio: { type: string }
 *               cargo: { type: string }
 *               email: { type: string }
 *               telefono: { type: string }
 *               alumnos: { type: string }
 *               mensaje: { type: string }
 *     responses:
 *       200:
 *         description: Consulta recibida
 */
router.post('/', contactoLimiter, enviarContacto);

// La página lo llama al abrir el formulario, para despertar el servidor
router.get('/', (req, res) => res.json({ ok: true }));

module.exports = router;
