const express = require('express');
const router = express.Router();
const { getResumen } = require('../controllers/reportesController');
const { verificarToken, soloAdmin } = require('../middlewares/auth');

/**
 * @swagger
 * /reportes/resumen:
 *   get:
 *     summary: Totales de Reportes del período (?desde=AAAA-MM-DD&hasta=&lugar=), calculados en la base
 *     tags: [Reportes]
 *     security: [{ bearerAuth: [] }]
 */
router.get('/resumen', verificarToken, soloAdmin, getResumen);

module.exports = router;
