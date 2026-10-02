const express = require('express');
const router = express.Router();
const { getRentabilidad } = require('../controllers/rentabilidadController');
const { verificarToken, soloAdmin } = require('../middlewares/auth');

/**
 * @swagger
 * /rentabilidad:
 *   get:
 *     summary: Ventas, costo, ganancia y compras a proveedores del período (?desde=AAAA-MM-DD&hasta=&lugar=)
 *     tags: [Reportes]
 *     security: [{ bearerAuth: [] }]
 */
router.get('/', verificarToken, soloAdmin, getRentabilidad);

module.exports = router;
