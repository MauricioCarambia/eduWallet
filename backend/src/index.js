const express = require('express');
const cors = require('cors');
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

const app = express();
const PORT = process.env.PORT || 3001;

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


app.get('/', (req, res) => {
  res.json({ mensaje: 'EduWallet API funcionando correctamente' });
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});