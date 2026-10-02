// Datos de un alumno para el personal del POS: sin el código del QR, las
// tarjetas ni el código de vinculación. Con el código de vinculación cualquiera
// se puede vincular como padre del alumno (ver su historial, cambiar sus
// límites); con el del QR, armar su credencial. El admin sí los ve (los
// necesita para entregarlos).
const OCULTOS = ['qr', 'nfc_claves', 'nfc_uid', 'codigo_vinculacion'];

const alumnoPara = (empleado, alumno) => {
  if (!alumno || empleado?.rol === 'admin') return alumno;
  const copia = { ...alumno };
  for (const c of OCULTOS) delete copia[c];
  return copia;
};

module.exports = { alumnoPara };
