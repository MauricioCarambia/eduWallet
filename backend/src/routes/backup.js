const express = require('express');
const router = express.Router();
const { descargarBackup, enviarBackupEmail } = require('../controllers/backupController');
const { verificarToken, soloAdmin } = require('../middlewares/auth');

router.get('/descargar', verificarToken, soloAdmin, descargarBackup);
router.post('/email', verificarToken, soloAdmin, enviarBackupEmail);

module.exports = router;