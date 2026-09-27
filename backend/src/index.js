require('dotenv').config();
require('./db/conexion');
require('./tareas');

const app = require('./app');
const { migrarSplit } = require('./db/migracion_split');

const PORT = process.env.PORT || 3001;

// Las columnas de comisión tienen que existir antes de aceptar recargas
migrarSplit()
  .catch(err => console.error('Error en migración de split de pagos:', err.message))
  .finally(() => {
    app.listen(PORT, () => {
      console.log(`Servidor corriendo en puerto ${PORT}`);
    });
  });
