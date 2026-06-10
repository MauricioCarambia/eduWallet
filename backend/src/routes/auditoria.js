const express = require('express');
const router = express.Router();
const { getAuditoria } = require('../controllers/auditoriaController');
const { verificarToken, soloAdmin } = require('../middlewares/auth');

/**
 * @swagger
 * tags:
 *   name: Auditoría
 *   description: Registro de acciones del sistema (solo admin)
 */

/**
 * @swagger
 * /auditoria:
 *   get:
 *     summary: Listar el registro de auditoría
 *     tags: [Auditoría]
 *     responses:
 *       200:
 *         description: Lista de eventos de auditoría
 */
router.get('/', verificarToken, soloAdmin, getAuditoria);

module.exports = router;
