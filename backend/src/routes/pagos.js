const express = require('express');
const router = express.Router();
const { crearPreferencia, procesarPago, webhook } = require('../controllers/pagosController');
const { verificarPadre } = require('../middlewares/auth');
const { crearPreferencia, procesarPago, webhook, verificarPago } = require('../controllers/pagosController');

router.post('/preferencia', verificarPadre, crearPreferencia);
router.post('/procesar', verificarPadre, procesarPago);
router.post('/webhook', webhook);
router.get('/verificar', verificarPadre, verificarPago);

module.exports = router;