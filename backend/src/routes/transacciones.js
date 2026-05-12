const express = require('express');
const router = express.Router();
const { getTransacciones, getTransaccionesAlumno, cobrar } = require('../controllers/transaccionesController');
const { verificarToken, soloAdmin } = require('../middlewares/auth');
const { getTransacciones, getTransaccionesAlumno, cobrar, anularVenta } = require('../controllers/transaccionesController');

router.get('/', verificarToken, soloAdmin, getTransacciones);
router.get('/alumno/:id', verificarToken, getTransaccionesAlumno);
router.post('/cobrar', verificarToken, cobrar);
router.delete('/:id/anular', verificarToken, anularVenta);

module.exports = router;