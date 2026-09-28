// Una misma tarjeta NFC leída con distintos lectores tiene que reconocerse
// siempre: celular (Web NFC), lector USB en hex, hex invertido o decimal.

const { variantesUid } = require('../src/services/tarjetasService');

const coinciden = (a, b) => variantesUid(a).some(v => variantesUid(b).includes(v));

describe('variantesUid', () => {
  // UID 04:A2:3F:1B
  const celular = '04:a2:3f:1b';
  const lecturas = {
    'USB en hex': '04A23F1B',
    'USB en hex con espacios': '04 A2 3F 1B',
    'USB en hex con bytes invertidos': '1B3FA204',
    'USB en decimal (bytes invertidos)': String(0x1B3FA204),
    'USB en decimal (orden normal, 10 dígitos)': String(0x04A23F1B).padStart(10, '0'),
  };

  test.each(Object.entries(lecturas))('reconoce la tarjeta del celular leída por %s', (_, lectura) => {
    expect(coinciden(celular, lectura)).toBe(true);
  });

  test('tarjetas de 7 bytes (NTAG)', () => {
    expect(coinciden('04:11:22:33:44:55:66', '04112233445566')).toBe(true);
    expect(coinciden('04:11:22:33:44:55:66', '66554433221104')).toBe(true);
  });

  test('tarjetas distintas no coinciden', () => {
    expect(coinciden('04:a2:3f:1b', '04:a2:3f:1c')).toBe(false);
    expect(coinciden('04:a2:3f:1b', String(0x04A23F1C))).toBe(false);
  });

  test('lecturas inválidas no generan variantes', () => {
    for (const x of ['', '12', 'hola', null, undefined, '04A23F1']) expect(variantesUid(x)).toEqual([]);
  });
});
