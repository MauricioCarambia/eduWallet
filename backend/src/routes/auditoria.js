const express = require('express');
const router = express.Router();
const { getAuditoria } = require('../controllers/auditoriaController');
const { verificarToken, soloAdmin } = require('../middlewares/auth');

router.get('/', verificarToken, soloAdmin, getAuditoria);

module.exports = router;