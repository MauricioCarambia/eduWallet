const express = require('express');
const router = express.Router();
const { getTransacciones, getTransaccionesAlumno, cobrar } = require('../controllers/transaccionesController');
const { verificarToken, soloAdmin } = require('../middlewares/auth');

router.get('/', verificarToken, soloAdmin, getTransacciones);
router.get('/alumno/:id', verificarToken, getTransaccionesAlumno);
router.post('/cobrar', verificarToken, cobrar);

module.exports = router;