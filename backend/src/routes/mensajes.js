const express = require('express');
const router = express.Router();
const { enviarMensaje } = require('../controllers/mensajesController');
const { verificarToken, soloAdmin } = require('../middlewares/auth');

router.post('/', verificarToken, soloAdmin, enviarMensaje);

module.exports = router;