const express = require('express');
const router = express.Router();
const { crearPreferencia, procesarPago, webhook } = require('../controllers/pagosController');
const { verificarPadre } = require('../middlewares/auth');

router.post('/preferencia', verificarPadre, crearPreferencia);
router.post('/procesar', verificarPadre, procesarPago);
router.post('/webhook', webhook);

module.exports = router;