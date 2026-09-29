require('dotenv').config();
require('./db/conexion');
require('./tareas');

const app = require('./app');
const { migrarSplit } = require('./db/migracion_split');
const { migrarPagosVencidos } = require('./db/migracion_pagos_vencidos');
const { migrarLinkPago } = require('./db/migracion_link_pago');
const { migrarContacto2 } = require('./db/migracion_contacto2');
const { migrarPadresColegios } = require('./db/migracion_padres_colegios');
const { migrarTarjetasNfc } = require('./db/migracion_tarjetas_nfc');
const { migrarActivacionEmpleados } = require('./db/migracion_activacion_empleados');
const { migrarQrSeguro } = require('./db/migracion_qr_seguro');
const { migrarBloqueoMedios } = require('./db/migracion_bloqueo_medios');
const { migrarCodigoBarras } = require('./db/migracion_codigo_barras');

const PORT = process.env.PORT || 3001;

// Las columnas de comisión y el estado 'vencido' tienen que existir antes
// de aceptar recargas
const migrar = async () => {
  for (const [nombre, fn] of [['split de pagos', migrarSplit], ['pagos vencidos', migrarPagosVencidos], ['links de pago', migrarLinkPago], ['segundo contacto', migrarContacto2], ['padres por colegio', migrarPadresColegios], ['tarjetas NFC', migrarTarjetasNfc], ['activación de empleados', migrarActivacionEmpleados], ['QR seguros', migrarQrSeguro], ['bloqueo por medio', migrarBloqueoMedios], ['código de barras', migrarCodigoBarras]]) {
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
