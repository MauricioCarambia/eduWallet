// Identificador (UID) de las tarjetas NFC de los alumnos.
//
// Cada lector entrega el mismo UID en formatos distintos:
//   - NFC del celular (Web NFC):  "04:a2:3f:1b"   -> hex, orden normal
//   - lector USB (teclado):       "04A23F1B", "1B3FA204" (bytes invertidos)
//                                 o "0457401115" (el número en decimal)
// Para que una tarjeta asignada con un lector se reconozca con cualquier
// otro, se guardan todas las variantes posibles del UID y se busca por
// coincidencia con cualquiera de ellas.

const invertirBytes = hex => hex.match(/../g).reverse().join('');

// Devuelve las variantes hex (mayúsculas, sin separadores) de una lectura
const variantesUid = (lectura) => {
  const texto = String(lectura ?? '').trim().toUpperCase();
  const variantes = new Set();

  // Lectura en hexadecimal (con o sin ":" / "-" / espacios)
  const hex = texto.replace(/[\s:-]/g, '');
  if (/^[0-9A-F]+$/.test(hex) && hex.length >= 8 && hex.length <= 20 && hex.length % 2 === 0) {
    variantes.add(hex);
    variantes.add(invertirBytes(hex));
  }

  // Lectura en decimal (lectores USB que "escriben" el número)
  if (/^\d{6,20}$/.test(hex)) {
    let h = BigInt(hex).toString(16).toUpperCase();
    const largo = h.length <= 8 ? 8 : h.length <= 14 ? 14 : h.length + (h.length % 2);
    h = h.padStart(largo, '0');
    variantes.add(h);
    variantes.add(invertirBytes(h));
  }

  return [...variantes];
};

module.exports = { variantesUid };
