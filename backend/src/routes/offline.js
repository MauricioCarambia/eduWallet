const express = require('express');
const router = express.Router();
const { getDatosOffline, sincronizarVentas } = require('../controllers/offlineController');
const { verificarToken, soloPersonalPos } = require('../middlewares/auth');

/**
 * @swagger
 * /offline/datos:
 *   get:
 *     summary: Copia para vender sin internet (productos, alumnos, huellas de credenciales y tope offline)
 *     tags: [Offline]
 *     security: [{ bearerAuth: [] }]
 */
router.get('/datos', verificarToken, soloPersonalPos, getDatosOffline);

/**
 * @swagger
 * /offline/ventas:
 *   post:
 *     summary: Sube las ventas hechas sin internet (cada una con su id_venta; las repetidas se toman una vez)
 *     tags: [Offline]
 *     security: [{ bearerAuth: [] }]
 */
router.post('/ventas', verificarToken, soloPersonalPos, sincronizarVentas);

module.exports = router;
