require('dotenv').config();
require('./db/conexion');
require('./tareas');

const app = require('./app');
const { migrarSplit } = require('./db/migracion_split');
const { migrarPagosVencidos } = require('./db/migracion_pagos_vencidos');

const PORT = process.env.PORT || 3001;

// Las columnas de comisión y el estado 'vencido' tienen que existir antes
// de aceptar recargas
const migrar = async () => {
  for (const [nombre, fn] of [['split de pagos', migrarSplit], ['pagos vencidos', migrarPagosVencidos]]) {
    try {
      await fn();
    } catch (err) {
      console.error(`Error en migración de ${nombre}:`, err.message);
    }
  }
};

migrar().finally(() => {
  app.listen(PORT, () => {
    console.log(`Servidor corriendo en puerto ${PORT}`);
  });
});
