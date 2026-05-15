const { hacerBackup } = require('../services/backupService');

const descargarBackup = async (req, res) => {
  try {
    const { sql, nombre } = await hacerBackup(false);
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="${nombre}"`);
    res.send(sql);
  } catch (err) {
    res.status(500).json({ error: 'Error al generar backup' });
  }
};

const enviarBackupEmail = async (req, res) => {
  try {
    await hacerBackup(true);
    res.json({ mensaje: 'Backup enviado por email correctamente' });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Error al enviar backup' });
  }
};

module.exports = { descargarBackup, enviarBackupEmail };