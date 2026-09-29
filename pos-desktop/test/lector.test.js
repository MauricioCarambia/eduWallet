// Lógica del lector PC/SC con una API de Windows simulada.
const test = require('node:test');
const assert = require('node:assert');
const { iniciarLector, uidDeRespuesta, separarLectores, tipoError } = require('../src/lector');

test('UID de la respuesta de GET DATA', () => {
  assert.strictEqual(uidDeRespuesta([0x04, 0xA2, 0x3F, 0x1B, 0x90, 0x00]), '04A23F1B');
  assert.strictEqual(uidDeRespuesta([0x04, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x90, 0x00]), '04112233445566');
  assert.strictEqual(uidDeRespuesta([0x63, 0x00]), null);
  assert.strictEqual(uidDeRespuesta([0x04, 0xA2, 0x6A, 0x81]), null);
});

test('lista de lectores', () => {
  assert.deepStrictEqual(separarLectores('ACS ACR122 0\0Otro lector\0\0'), ['ACS ACR122 0', 'Otro lector']);
  assert.strictEqual(tipoError(-2146435060), 'sin_tarjeta'); // 0x8010000C como entero con signo
});

// API simulada: un lector y una tarjeta que se apoya y se retira
function apiSimulada(estado) {
  return {
    establecer: (_s, _a, _b, h) => { if (estado.sinServicio) return 0x8010001D | 0; h[0] = 1; return 0; },
    liberar: () => 0,
    listar: (_c, _g, buf, len) => {
      const texto = estado.lectores.map(l => l + '\0').join('') + '\0';
      if (!estado.lectores.length) return 0x8010002E | 0;
      if (!buf) { len[0] = texto.length; return 0; }
      buf.write(texto, 'utf16le'); len[0] = texto.length; return 0;
    },
    conectar: (_c, _l, _s, _p, h, prot) => { if (!estado.uid) return 0x8010000C | 0; h[0] = 7; prot[0] = 2; return 0; },
    transmitir: (_h, _pci, _send, _len, _r, recv, recvLen) => {
      const bytes = Buffer.concat([Buffer.from(estado.uid, 'hex'), Buffer.from([0x90, 0x00])]);
      bytes.copy(recv); recvLen[0] = bytes.length; return 0;
    },
    desconectar: () => 0,
  };
}

const esperar = ms => new Promise(r => setTimeout(r, ms));

test('avisa una vez por cada vez que se apoya la tarjeta', async () => {
  const estado = { lectores: ['ACS ACR122 0'], uid: null };
  const leidas = [];
  const estados = [];
  const l = iniciarLector({ api: apiSimulada(estado), intervaloMs: 10, onTarjeta: uid => leidas.push(uid), onEstado: e => estados.push(e) });
  await esperar(40);
  estado.uid = '04A23F1B';          // se apoya
  await esperar(60);                 // sigue apoyada varios ciclos
  estado.uid = null;                 // se retira
  await esperar(40);
  estado.uid = '04A23F1B';          // se vuelve a apoyar
  await esperar(40);
  l.detener();
  assert.deepStrictEqual(leidas, ['04A23F1B', '04A23F1B']);
  assert.ok(estados.some(e => e.conectado && e.lectores[0] === 'ACS ACR122 0'));
});

test('sin servicio o sin lector no falla y avisa desconectado', async () => {
  const estado = { lectores: [], uid: null, sinServicio: true };
  const estados = [];
  const l = iniciarLector({ api: apiSimulada(estado), intervaloMs: 10, onEstado: e => estados.push(e) });
  await esperar(30);
  l.detener();
  assert.deepStrictEqual(estados[0], { conectado: false, lectores: [], error: null });
});
