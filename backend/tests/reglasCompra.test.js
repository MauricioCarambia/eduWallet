// Reglas de compra de la familia, alergias y avisos (funciones puras).
const { evaluarReglas, normalizarRestricciones, conflictosAlergia, normalizarAlergenos, deducirAlergenos, resumenReglas } = require('../src/services/reglasCompra');
const { quiereCompra, cruzoUmbral } = require('../src/services/notificacionesService');

const alumno = (r = {}, extra = {}) => ({ nombre: 'Martina López', restricciones: r, limite_semanal: null, ...extra });
const alfajor = { id: 1, nombre: 'Alfajor', categoria: 'golosina', qty: 1 };
const coca = { id: 2, nombre: 'Coca', categoria: 'bebida', qty: 1 };
const agua = { id: 3, nombre: 'Agua', categoria: 'bebida', qty: 1 };

describe('reglas de la familia', () => {
  test('sin reglas se permite todo', () => {
    expect(evaluarReglas({ alumno: alumno(), lineas: [alfajor, coca], lugar: 'Kiosco' })).toEqual([]);
  });

  test('categoría bloqueada ("no golosinas")', () => {
    const m = evaluarReglas({ alumno: alumno({ categorias_bloqueadas: ['golosina'] }), lineas: [alfajor, agua], lugar: 'Kiosco' });
    expect(m).toHaveLength(1);
    expect(m[0]).toMatch(/golosinas \(Alfajor\)/);
  });

  test('producto puntual bloqueado ("no energizantes")', () => {
    expect(evaluarReglas({ alumno: alumno({ productos_bloqueados: [2] }), lineas: [coca], lugar: 'Kiosco' })[0]).toMatch(/Coca/);
  });

  test('zona bloqueada ("solo comedor")', () => {
    expect(evaluarReglas({ alumno: alumno({ zonas_bloqueadas: ['Kiosco'] }), lineas: [agua], lugar: 'Kiosco' })[0]).toMatch(/Kiosco/);
    expect(evaluarReglas({ alumno: alumno({ zonas_bloqueadas: ['Kiosco'] }), lineas: [agua], lugar: 'Comedor' })).toEqual([]);
  });

  test('máximo por día ("máximo 1 gaseosa por día") cuenta lo ya comprado y el carrito', () => {
    const a = alumno({ maximos: { bebida: 1 } });
    expect(evaluarReglas({ alumno: a, lineas: [coca], lugar: 'Kiosco', hoyPorCategoria: {} })).toEqual([]);
    expect(evaluarReglas({ alumno: a, lineas: [coca], lugar: 'Kiosco', hoyPorCategoria: { bebida: 1 } })[0]).toMatch(/ya compró 1 de bebidas hoy: la familia permite hasta 1 por día/);
    expect(evaluarReglas({ alumno: a, lineas: [{ ...coca, qty: 2 }], lugar: 'Kiosco' })).toHaveLength(1);
  });

  test('límite semanal', () => {
    const a = alumno({}, { limite_semanal: '30000' });
    expect(evaluarReglas({ alumno: a, lineas: [coca], lugar: 'K', gastoSemana: 28000, total: 1500 })).toEqual([]);
    expect(evaluarReglas({ alumno: a, lineas: [coca], lugar: 'K', gastoSemana: 29000, total: 1500 })[0]).toMatch(/límite semanal/);
  });

  test('valida lo que manda la familia', () => {
    expect(normalizarRestricciones({ categorias_bloqueadas: ['armas'] }).error).toBeTruthy();
    expect(normalizarRestricciones({ zonas_bloqueadas: ['Marte'] }, ['Kiosco']).error).toBeTruthy();
    expect(normalizarRestricciones({ maximos: { bebida: -1 } }).error).toBeTruthy();
    const { restricciones } = normalizarRestricciones({ categorias_bloqueadas: ['golosina', 'golosina'], maximos: { bebida: '1', golosina: 2, comida: '' }, productos_bloqueados: ['7'] }, ['Kiosco']);
    expect(restricciones).toEqual({ categorias_bloqueadas: ['golosina'], zonas_bloqueadas: [], productos_bloqueados: [7], maximos: { bebida: 1 } });
  });

  test('resumen para el cajero', () => {
    expect(resumenReglas(alumno({ categorias_bloqueadas: ['golosina'], maximos: { bebida: 1 } }, { limite_semanal: 30000 })))
      .toEqual(['sin golosinas', 'bebidas: hasta 1 por día', 'hasta $30.000/semana']);
  });
});

describe('alergias', () => {
  test('detecta los productos con alérgenos del alumno', () => {
    const r = conflictosAlergia(['mani', 'leche'], [{ id: 1, nombre: 'Alfajor', alergenos: ['gluten', 'mani'] }, { id: 2, nombre: 'Agua', alergenos: [] }]);
    expect(r).toEqual([{ id: 1, nombre: 'Alfajor', alergenos: ['mani'] }]);
  });

  test('sólo se aceptan alérgenos conocidos', () => {
    expect(normalizarAlergenos(['mani', 'mani', 'kryptonita'])).toEqual(['mani']);
  });

  test('deduce alérgenos del texto libre (alumnos viejos, importación de productos)', () => {
    expect(deducirAlergenos('Celíaco, alérgico al maní')).toEqual(['mani', 'gluten']);
    expect(deducirAlergenos('Intolerante a la lactosa')).toEqual(['leche']);
    expect(deducirAlergenos('Ninguna')).toEqual([]);
  });
});

describe('avisos', () => {
  const padre = { notif_compras: 'mayores', notif_compras_minimo: '10000', notif_saldo_bajo: true, umbral_saldo_bajo: '5000' };

  test('compras: todas, sólo las mayores a un monto o ninguna', () => {
    expect(quiereCompra({ notif_compras: 'todas' }, 100)).toBe(true);
    expect(quiereCompra(padre, 9999)).toBe(false);
    expect(quiereCompra(padre, 10000)).toBe(true);
    expect(quiereCompra({ notif_compras: 'ninguna' }, 99999)).toBe(false);
  });

  test('saldo bajo: se avisa una sola vez, al cruzar el umbral', () => {
    expect(cruzoUmbral(padre, 6000, 4000)).toBe(true);
    expect(cruzoUmbral(padre, 4000, 3000)).toBe(false);
    expect(cruzoUmbral({ ...padre, notif_saldo_bajo: false }, 6000, 4000)).toBe(false);
  });
});
