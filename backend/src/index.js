const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
require('./db/conexion');
require('./tareas');

const empleadosRoutes = require('./routes/empleados');
const alumnosRoutes = require('./routes/alumnos');
const productosRoutes = require('./routes/productos');
const transaccionesRoutes = require('./routes/transacciones');
const cajasRoutes = require('./routes/cajas');
const auditoriaRoutes = require('./routes/auditoria');
const padresRoutes = require('./routes/padres');
const pagosRoutes = require('./routes/pagos');
const configuracionRoutes = require('./routes/configuracion');
const adminPadresRoutes = require('./routes/adminPadres');
const backupRoutes = require('./routes/backup');
const mensajesRoutes = require('./routes/mensajes');

const app = express();
const PORT = process.env.PORT || 3001;

// ── Logging ──────────────────────────────────────────────────────────────────
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

// Formato legible para consola en desarrollo
const devFormat = ':method :url :status :response-time ms - :res[content-length]';

// Formato detallado para archivo en producción
const fileFormat = ':remote-addr - :method :url HTTP/:http-version :status :res[content-length] ":referrer" ":user-agent" - :response-time ms';

// Stream hacia archivo (rotación diaria por nombre de fecha)
const logFileName = () => `eduwallet-${new Date().toISOString().slice(0, 10)}.log`;
const logStream = {
  write: (msg) => {
    const filePath = path.join(logsDir, logFileName());
    fs.appendFileSync(filePath, msg);
  }
};

// En desarrollo: consola con colores. En producción: archivo + errores en consola.
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
} else {
  // Solo loguear errores (4xx, 5xx) en consola
  app.use(morgan(devFormat, {
    skip: (req, res) => res.statusCode < 400
  }));
  // Todo al archivo
  app.use(morgan(fileFormat, { stream: logStream }));
}

app.use(cors());
app.use(express.json());

app.use('/api/empleados', empleadosRoutes);
app.use('/api/alumnos', alumnosRoutes);
app.use('/api/productos', productosRoutes);
app.use('/api/transacciones', transaccionesRoutes);
app.use('/api/cajas', cajasRoutes);
app.use('/api/auditoria', auditoriaRoutes);
app.use('/api/padres', padresRoutes);
app.use('/api/pagos', pagosRoutes);
app.use('/api/configuracion', configuracionRoutes);
app.use('/api/admin/padres', adminPadresRoutes);
app.use('/api/backup', backupRoutes);
app.use('/api/mensajes', mensajesRoutes);


app.get('/', (req, res) => {
  res.json({ mensaje: 'EduWallet API funcionando correctamente' });
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});