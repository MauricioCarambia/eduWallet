const express = require('express');
const router = express.Router();
const { login, getEmpleados, crearEmpleado, toggleEmpleado, cambiarPin, resetearPin } = require('../controllers/empleadosController');
const { verificarToken, soloAdmin } = require('../middlewares/auth');

router.post('/login', login);
router.get('/', verificarToken, soloAdmin, getEmpleados);
router.post('/', verificarToken, soloAdmin, crearEmpleado);
router.patch('/:id/toggle', verificarToken, soloAdmin, toggleEmpleado);
router.patch('/:id/cambiar-pin', verificarToken, cambiarPin);
router.patch('/:id/resetear-pin', verificarToken, soloAdmin, resetearPin);

module.exports = router;