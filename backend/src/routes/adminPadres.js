const express = require('express');
const router = express.Router();
const { getPadres, togglePadre, desvincularAlumno, vincularAlumno, eliminarPadre } = require('../controllers/adminPadresController');
const { verificarToken, soloAdmin } = require('../middlewares/auth');

router.get('/', verificarToken, soloAdmin, getPadres);
router.patch('/:id/toggle', verificarToken, soloAdmin, togglePadre);
router.delete('/:padre_id/alumnos/:alumno_id', verificarToken, soloAdmin, desvincularAlumno);
router.post('/:padre_id/alumnos', verificarToken, soloAdmin, vincularAlumno);
router.delete('/:id', verificarToken, soloAdmin, eliminarPadre);

module.exports = router;