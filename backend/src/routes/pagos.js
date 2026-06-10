const express = require('express');
const router = express.Router();
const { crearPreferencia, procesarPago, webhook, verificarPago, getHistorialPagos } = require('../controllers/pagosController');
const { verificarPadre } = require('../middlewares/auth');

router.post('/preferencia', verificarPadre, crearPreferencia);
router.post('/procesar', verificarPadre, procesarPago);
router.post('/webhook', webhook);
router.get('/verificar', verificarPadre, verificarPago);
router.get('/historial', verificarPadre, getHistorialPagos);

module.exports = router;