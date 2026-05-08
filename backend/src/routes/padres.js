const express = require('express');
const router = express.Router();
const { registro, login, getAlumnos, vincularAlumno, recargarSaldo, toggleBloqueo, actualizarLimite } = require('../controllers/padresController');
const { verificarPadre } = require('../middlewares/auth');

router.post('/registro', registro);
router.post('/login', login);
router.get('/alumnos', verificarPadre, getAlumnos);
router.post('/alumnos/vincular', verificarPadre, vincularAlumno);
router.post('/alumnos/recargar', verificarPadre, recargarSaldo);
router.patch('/alumnos/:alumno_id/toggle', verificarPadre, toggleBloqueo);
router.patch('/alumnos/:alumno_id/limite', verificarPadre, actualizarLimite);

module.exports = router;