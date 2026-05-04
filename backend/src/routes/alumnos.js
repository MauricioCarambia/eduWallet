const express = require('express');
const router = express.Router();
const { getAlumnos, getAlumno, crearAlumno, actualizarAlumno, toggleAlumno, recargarSaldo, eliminarAlumno, getGastoSemanal } = require('../controllers/alumnosController');
const { verificarToken, soloAdmin } = require('../middlewares/auth');

router.get('/', verificarToken, getAlumnos);
router.get('/:id', verificarToken, getAlumno);
router.post('/', verificarToken, soloAdmin, crearAlumno);
router.put('/:id', verificarToken, actualizarAlumno);
router.patch('/:id/toggle', verificarToken, actualizarAlumno);
router.post('/:id/recargar', verificarToken, recargarSaldo);
router.delete('/:id', verificarToken, soloAdmin, eliminarAlumno);
router.get('/:id/gasto-semanal', verificarToken, getGastoSemanal);

module.exports = router;