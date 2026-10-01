const express = require('express');
const router = express.Router();
const { getDatosOffline, sincronizarVentas, reportarEstado, getResumenOffline, recordarSaldoNegativo } = require('../controllers/offlineController');
const { verificarToken, soloPersonalPos, soloAdmin } = require('../middlewares/auth');

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

/**
 * @swagger
 * /offline/estado:
 *   post:
 *     summary: El equipo del POS avisa que está conectado y cuántas ventas tiene sin subir
 *     tags: [Offline]
 *     security: [{ bearerAuth: [] }]
 */
router.post('/estado', verificarToken, soloPersonalPos, reportarEstado);

/**
 * @swagger
 * /offline/resumen:
 *   get:
 *     summary: Ventas sin conexión del período (?dias=30), sincronizaciones y alumnos con saldo negativo
 *     tags: [Offline]
 *     security: [{ bearerAuth: [] }]
 */
router.get('/resumen', verificarToken, soloAdmin, getResumenOffline);

/**
 * @swagger
 * /offline/recordar/{id}:
 *   post:
 *     summary: Avisa a la familia que el saldo del alumno quedó negativo
 *     tags: [Offline]
 *     security: [{ bearerAuth: [] }]
 */
router.post('/recordar/:id', verificarToken, soloAdmin, recordarSaldoNegativo);

module.exports = router;
