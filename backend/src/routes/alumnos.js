const express = require('express');
const router = express.Router();
const { verificarToken, soloAdmin } = require('../middlewares/auth');
const { getAlumnos, getAlumno, crearAlumno, actualizarAlumno, toggleAlumno, recargarSaldo, eliminarAlumno, getGastoSemanal, getQR, importarAlumnos } = require('../controllers/alumnosController');

router.get('/', verificarToken, getAlumnos);
router.get('/:id', verificarToken, getAlumno);
router.post('/', verificarToken, soloAdmin, crearAlumno);
router.post('/importar', verificarToken, soloAdmin, importarAlumnos);
router.put('/:id', verificarToken, actualizarAlumno);
router.patch('/:id/toggle', verificarToken, actualizarAlumno);
router.post('/:id/recargar', verificarToken, recargarSaldo);
router.delete('/:id', verificarToken, soloAdmin, eliminarAlumno);
router.get('/:id/gasto-semanal', verificarToken, getGastoSemanal);
router.get('/:id/qr', verificarToken, getQR);

module.exports = router;