// Código QR de la credencial de cada alumno.
//
// Es aleatorio (no se puede adivinar el de otro alumno) y sólo usa letras
// mayúsculas y números: los lectores de códigos USB "escriben" el código
// como un teclado y, según la distribución del teclado, pueden cambiar
// símbolos como "-". Así cualquier lector lo manda igual.
const crypto = require('crypto');

const LETRAS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin 0/O ni 1/I
const LARGO = 12;

const nuevoCodigoQr = () => 'EW' + [...crypto.randomBytes(LARGO)].map(b => LETRAS[b % LETRAS.length]).join('');

// Mayúsculas y sólo letras y números (tolera lectores que cambian "-" u otros símbolos)
const normalizarCodigo = codigo => String(codigo ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');

// ¿Es un QR de credencial? (nuevo "EW...", o el formato viejo "QR-...")
const esCodigoQr = codigo => /^(EW[A-Z0-9]{12}|QR[0-9A-Z]{10,})$/.test(normalizarCodigo(codigo));

module.exports = { nuevoCodigoQr, normalizarCodigo, esCodigoQr };
