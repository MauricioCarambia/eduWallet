const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

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
const localesRoutes = require('./routes/locales');
const superadminRoutes = require('./routes/superadmin');
const mpRoutes = require('./routes/mp');
const contactoRoutes = require('./routes/contacto');
const conciliacionRoutes = require('./routes/conciliacion');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./docs/swagger');

const app = express();

app.set('trust proxy', 1);

// ── Logging ──────────────────────────────────────────────────────────────────
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

// Formato legible para consola en desarrollo
const devFormat = ':method :url :status :response-time ms - :res[content-length]';

// Formato detallado para archivo en producción
const fileFormat = ':remote-addr - :method :url HTTP/:http-version :status :res[content-length] ":referrer" ":user-agent" - :response-time ms';

// Stream hacia archivo (rotación diaria por nombre de fecha)
const logFileName = () => `koletap-${new Date().toISOString().slice(0, 10)}.log`;
const logStream = {
  write: (msg) => {
    const filePath = path.join(logsDir, logFileName());
    fs.appendFileSync(filePath, msg);
  }
};

// En desarrollo: consola con colores. En producción: archivo + errores en consola.
// En tests: sin logging para no ensuciar la salida.
if (process.env.NODE_ENV === 'test') {
  // sin logging
} else if (process.env.NODE_ENV !== 'production') {
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
app.use(express.json({ limit: '1mb' })); // la importación de productos manda hasta 1000 filas

// El primer pedido de cada día cierra las cajas del día anterior y pone el
// gasto diario en 0 (no depende de que el servidor esté despierto a la medianoche)
app.use('/api', require('./services/tareasDiarias').alDia);

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
app.use('/api/locales', localesRoutes);
app.use('/api/superadmin', superadminRoutes);
app.use('/api/mp', mpRoutes);
app.use('/api/contacto', contactoRoutes);
app.use('/api/conciliacion', conciliacionRoutes);
app.use('/api/offline', require('./routes/offline'));
app.use('/api/proveedores', require('./routes/proveedores'));
app.use('/api/rentabilidad', require('./routes/rentabilidad'));

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: 'KoleTap API Docs',
}));
app.get('/api/docs.json', (req, res) => res.json(swaggerSpec));

app.get('/', (req, res) => {
  res.json({ mensaje: 'KoleTap API funcionando correctamente' });
});

module.exports = app;
