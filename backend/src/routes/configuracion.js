const express = require('express');
const router = express.Router();
const { getConfiguracion, actualizarConfiguracion, testEmail } = require('../controllers/configuracionController');
const { verificarToken, soloAdmin } = require('../middlewares/auth');

router.get('/', verificarToken, soloAdmin, getConfiguracion);
router.put('/', verificarToken, soloAdmin, actualizarConfiguracion);
router.post('/test-email', verificarToken, soloAdmin, testEmail);

module.exports = router;