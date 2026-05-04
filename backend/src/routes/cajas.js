const express = require('express');
const router = express.Router();
const { abrirCaja, cerrarCaja, getCajas } = require('../controllers/cajasController');
const { verificarToken, soloAdmin } = require('../middlewares/auth');

router.get('/', verificarToken, soloAdmin, getCajas);
router.post('/', verificarToken, abrirCaja);
router.patch('/:id/cerrar', verificarToken, cerrarCaja);

module.exports = router;