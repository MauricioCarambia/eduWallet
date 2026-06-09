const express = require('express');
const router = express.Router();
const { getConfiguracion, getBranding, actualizarConfiguracion, testEmail } = require('../controllers/configuracionController');
const { verificarToken, soloAdmin } = require('../middlewares/auth');

router.get('/branding', getBranding); // público — sin auth
router.get('/', verificarToken, soloAdmin, getConfiguracion);
router.put('/', verificarToken, soloAdmin, actualizarConfiguracion);
router.post('/test-email', verificarToken, soloAdmin, testEmail);

module.exports = router;