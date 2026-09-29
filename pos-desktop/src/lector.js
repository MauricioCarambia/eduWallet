// Lector de tarjetas NFC por PC/SC (ACR122U y cualquier lector PC/SC) usando
// la API de Windows (winscard.dll) a través de koffi, sin compilar nada.
//
// Cada ~300 ms intenta conectarse a la tarjeta de cada lector; si hay una,
// le pide su número de serie (UID) con el comando estándar GET DATA
// (FF CA 00 00 00) y avisa una vez por cada vez que se apoya la tarjeta.

const SCARD_S_SUCCESS = 0;
const SCARD_SCOPE_USER = 0;
const SCARD_SHARE_SHARED = 2;
const SCARD_PROTOCOL_T0 = 1;
const SCARD_PROTOCOL_T1 = 2;
const SCARD_LEAVE_CARD = 0;

// Códigos de error (se comparan como enteros sin signo)
const ERRORES = {
  0x8010001D: 'servicio',         // SCARD_E_NO_SERVICE: el servicio arranca al enchufar un lector
  0x8010002E: 'sin_lectores',     // SCARD_E_NO_READERS_AVAILABLE
  0x8010000C: 'sin_tarjeta',      // SCARD_E_NO_SMARTCARD
  0x80100069: 'sin_tarjeta',      // SCARD_W_REMOVED_CARD
  0x80100066: 'sin_tarjeta',      // SCARD_W_UNRESPONSIVE_CARD
  0x80100067: 'sin_tarjeta',      // SCARD_W_UNPOWERED_CARD
  0x8010000B: 'ocupado',          // SCARD_E_SHARING_VIOLATION
  0x80100009: 'lector_desconocido', // SCARD_E_UNKNOWN_READER (se desenchufó)
  0x80100017: 'lector_desconocido', // SCARD_E_READER_UNAVAILABLE
  0x80100006: 'contexto',         // SCARD_E_INVALID_HANDLE
};
const tipoError = codigo => ERRORES[codigo >>> 0] || 'otro';

// Respuesta de GET DATA: UID + 90 00 -> "04A23F1B..." (hex, orden normal,
// igual que el NFC del celular). null si la tarjeta no respondió bien.
const uidDeRespuesta = (bytes) => {
  if (!bytes || bytes.length < 3) return null;
  const sw1 = bytes[bytes.length - 2];
  const sw2 = bytes[bytes.length - 1];
  if (sw1 !== 0x90 || sw2 !== 0x00) return null;
  return Buffer.from(bytes.slice(0, -2)).toString('hex').toUpperCase();
};

// "Lector A\0Lector B\0\0" -> ['Lector A', 'Lector B']
const separarLectores = texto => texto.split('\0').filter(Boolean);

function crearApiWinscard() {
  const koffi = require('koffi');
  const lib = koffi.load('winscard.dll');
  const SCARD_IO_REQUEST = koffi.struct('SCARD_IO_REQUEST', { dwProtocol: 'uint32', cbPciLength: 'uint32' });
  return {
    SCARD_IO_REQUEST,
    establecer: lib.func('int32 __stdcall SCardEstablishContext(uint32 dwScope, void *r1, void *r2, _Out_ uintptr *phContext)'),
    liberar: lib.func('int32 __stdcall SCardReleaseContext(uintptr hContext)'),
    listar: lib.func('int32 __stdcall SCardListReadersW(uintptr hContext, const char16_t *groups, _Out_ char16_t *readers, _Inout_ uint32 *len)'),
    conectar: lib.func('int32 __stdcall SCardConnectW(uintptr hContext, const char16_t *reader, uint32 share, uint32 protocols, _Out_ uintptr *hCard, _Out_ uint32 *protocol)'),
    transmitir: lib.func('int32 __stdcall SCardTransmit(uintptr hCard, const SCARD_IO_REQUEST *sendPci, const uint8_t *send, uint32 sendLen, SCARD_IO_REQUEST *recvPci, _Out_ uint8_t *recv, _Inout_ uint32 *recvLen)'),
    desconectar: lib.func('int32 __stdcall SCardDisconnect(uintptr hCard, uint32 disposition)'),
  };
}

const GET_UID = Buffer.from([0xFF, 0xCA, 0x00, 0x00, 0x00]);

// Inicia la lectura. onTarjeta(uid, lector) se llama al apoyar una tarjeta;
// onEstado({ conectado, lectores, error }) cuando cambia el estado.
function iniciarLector({ onTarjeta, onEstado, intervaloMs = 300, api = null } = {}) {
  let w;
  try { w = api || crearApiWinscard(); }
  catch (err) {
    onEstado?.({ conectado: false, lectores: [], error: 'No se pudo cargar la librería de lectores de Windows: ' + err.message });
    return { detener() {} };
  }

  let contexto = null;
  let lectores = [];
  let ultimoEstado = '';
  const presentes = new Map(); // lector -> UID que está apoyado ahora
  let timer = null;
  let detenido = false;

  const avisarEstado = (estado) => {
    const clave = JSON.stringify(estado);
    if (clave !== ultimoEstado) { ultimoEstado = clave; onEstado?.(estado); }
  };

  const liberarContexto = () => {
    if (contexto !== null) { try { w.liberar(contexto); } catch { /* ya no existe */ } }
    contexto = null;
  };

  const asegurarContexto = () => {
    if (contexto !== null) return true;
    const h = [0];
    const r = w.establecer(SCARD_SCOPE_USER, null, null, h);
    if (r !== SCARD_S_SUCCESS) return false;
    contexto = h[0];
    return true;
  };

  const actualizarLectores = () => {
    const len = [0];
    let r = w.listar(contexto, null, null, len);
    if (r !== SCARD_S_SUCCESS) {
      if (tipoError(r) === 'contexto' || tipoError(r) === 'servicio') liberarContexto();
      lectores = [];
      return;
    }
    const buffer = Buffer.alloc(len[0] * 2);
    r = w.listar(contexto, null, buffer, len);
    lectores = r === SCARD_S_SUCCESS ? separarLectores(buffer.toString('utf16le', 0, len[0] * 2)) : [];
  };

  const leerTarjeta = (lector) => {
    const hCard = [0];
    const protocolo = [0];
    const r = w.conectar(contexto, lector, SCARD_SHARE_SHARED, SCARD_PROTOCOL_T0 | SCARD_PROTOCOL_T1, hCard, protocolo);
    if (r !== SCARD_S_SUCCESS) return { error: tipoError(r) };
    try {
      const recv = Buffer.alloc(64);
      const recvLen = [recv.length];
      const t = w.transmitir(hCard[0], { dwProtocol: protocolo[0], cbPciLength: 8 }, GET_UID, GET_UID.length, null, recv, recvLen);
      if (t !== SCARD_S_SUCCESS) return { error: tipoError(t) };
      return { uid: uidDeRespuesta([...recv.subarray(0, recvLen[0])]) };
    } finally {
      w.desconectar(hCard[0], SCARD_LEAVE_CARD);
    }
  };

  const ciclo = () => {
    if (detenido) return;
    try {
      if (!asegurarContexto()) {
        avisarEstado({ conectado: false, lectores: [], error: null });
      } else {
        actualizarLectores();
        avisarEstado({ conectado: lectores.length > 0, lectores, error: null });
        for (const lector of lectores) {
          const { uid, error } = leerTarjeta(lector);
          if (uid) {
            if (presentes.get(lector) !== uid) {
              presentes.set(lector, uid);
              onTarjeta?.(uid, lector);
            }
          } else if (error !== 'ocupado') {
            presentes.delete(lector); // se retiró la tarjeta: la próxima vez vuelve a contar
            if (error === 'contexto' || error === 'lector_desconocido') liberarContexto();
          }
        }
        for (const lector of [...presentes.keys()]) if (!lectores.includes(lector)) presentes.delete(lector);
      }
    } catch (err) {
      avisarEstado({ conectado: false, lectores: [], error: err.message });
      liberarContexto();
    }
    timer = setTimeout(ciclo, contexto === null ? 2000 : intervaloMs);
  };

  ciclo();
  return {
    detener() { detenido = true; clearTimeout(timer); liberarContexto(); },
  };
}

module.exports = { iniciarLector, uidDeRespuesta, separarLectores, tipoError };
