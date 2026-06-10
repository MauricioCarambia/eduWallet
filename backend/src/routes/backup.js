const express = require('express');
const router = express.Router();
const { descargarBackup, enviarBackupEmail } = require('../controllers/backupController');
const { verificarToken, soloAdmin } = require('../middlewares/auth');

/**
 * @swagger
 * tags:
 *   name: Backup
 *   description: Respaldo de la base de datos (solo admin)
 */

/**
 * @swagger
 * /backup/descargar:
 *   get:
 *     summary: Descargar un backup de la base de datos
 *     tags: [Backup]
 *     responses:
 *       200:
 *         description: Archivo de backup
 *         content:
 *           application/octet-stream:
 *             schema: { type: string, format: binary }
 */
router.get('/descargar', verificarToken, soloAdmin, descargarBackup);

/**
 * @swagger
 * /backup/email:
 *   post:
 *     summary: Enviar un backup de la base de datos por email
 *     tags: [Backup]
 *     responses:
 *       200:
 *         description: Backup enviado por email
 */
router.post('/email', verificarToken, soloAdmin, enviarBackupEmail);

module.exports = router;
