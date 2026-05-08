const express = require('express');
const router = express.Router();
const { crearPreferencia, webhook, verificarPago } = require('../controllers/pagosController');
const { verificarPadre } = require('../middlewares/auth');

router.post('/preferencia', verificarPadre, crearPreferencia);
router.post('/webhook', webhook);
router.get('/verificar', verificarPadre, verificarPago);

module.exports = router;