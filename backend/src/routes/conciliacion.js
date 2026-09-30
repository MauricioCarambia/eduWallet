const express = require('express');
const router = express.Router();
const { getConciliaciones, ejecutarConciliacion } = require('../controllers/conciliacionController');
const { verificarToken, soloAdmin } = require('../middlewares/auth');

/**
 * @swagger
 * /conciliacion:
 *   get:
 *     summary: Últimas revisiones Mercado Pago ↔ saldo del colegio y las diferencias que encontraron
 *     tags: [Conciliación]
 *   post:
 *     summary: Revisar ahora los pagos de los últimos días contra Mercado Pago (corrige lo que puede y lista lo que hay que revisar)
 *     tags: [Conciliación]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               dias: { type: integer, example: 30, maximum: 90 }
 */
router.get('/', verificarToken, soloAdmin, getConciliaciones);
router.post('/', verificarToken, soloAdmin, ejecutarConciliacion);

module.exports = router;
