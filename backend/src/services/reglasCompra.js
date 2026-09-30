// Reglas de compra que pone la familia y alérgenos: qué se le puede vender a
// un alumno. Las funciones de este archivo no tocan la base: reciben los datos
// y devuelven qué no se permite, así se usan igual en el cobro y en los tests.

const ALERGENOS = {
  mani: 'Maní',
  frutos_secos: 'Frutos secos',
  gluten: 'Gluten (TACC)',
  leche: 'Leche / lactosa',
  huevo: 'Huevo',
  soja: 'Soja',
  pescado: 'Pescado y mariscos',
  sesamo: 'Sésamo',
};

const CATEGORIAS = ['comida', 'bebida', 'golosina', 'útil', 'otro'];
const NOMBRE_CATEGORIA = { comida: 'comida', bebida: 'bebidas', golosina: 'golosinas', 'útil': 'útiles escolares', otro: 'otros productos' };

const MAX_POR_DIA = 20;
const MAX_PRODUCTOS_BLOQUEADOS = 300;

// Texto libre → claves de alérgenos ("Maní, celíaco" → ['mani', 'gluten'])
const PATRONES_ALERGENOS = [
  ['mani', /man[ií]/i],
  ['frutos_secos', /frutos? secos|nuez|nueces|almendra|avellana|casta[ñn]a/i],
  ['gluten', /gluten|tacc|cel[ií]ac|trigo/i],
  ['leche', /leche|lact|l[aá]cteo/i],
  ['huevo', /huevo/i],
  ['soja', /soja/i],
  ['pescado', /pescado|marisco|crust[aá]ceo/i],
  ['sesamo', /s[eé]samo/i],
];
const deducirAlergenos = texto => {
  const t = String(texto ?? '');
  return PATRONES_ALERGENOS.filter(([clave, re]) => clave === t.trim() || re.test(t)).map(([clave]) => clave);
};

// Deja sólo claves de alérgenos conocidas, sin repetir
const normalizarAlergenos = lista =>
  [...new Set((Array.isArray(lista) ? lista : []).map(String).filter(a => a in ALERGENOS))];

// Valida lo que manda la familia y devuelve las reglas limpias (o un error)
const normalizarRestricciones = (entrada = {}, zonasColegio = []) => {
  const categorias = [...new Set((entrada.categorias_bloqueadas || []).map(String))];
  if (categorias.some(c => !CATEGORIAS.includes(c))) return { error: 'Categoría inválida' };

  const zonas = [...new Set((entrada.zonas_bloqueadas || []).map(String))];
  if (zonas.some(z => !zonasColegio.includes(z))) return { error: 'Zona inválida' };

  const productos = [...new Set((entrada.productos_bloqueados || []).map(Number))];
  if (productos.some(p => !Number.isInteger(p) || p <= 0)) return { error: 'Producto inválido' };
  if (productos.length > MAX_PRODUCTOS_BLOQUEADOS) return { error: 'Demasiados productos bloqueados' };

  const maximos = {};
  for (const [cat, valor] of Object.entries(entrada.maximos || {})) {
    if (!CATEGORIAS.includes(cat)) return { error: 'Categoría inválida' };
    if (valor === null || valor === '' || valor === undefined) continue;
    const n = Number(valor);
    if (!Number.isInteger(n) || n < 0 || n > MAX_POR_DIA) return { error: `El máximo por día tiene que ser entre 0 y ${MAX_POR_DIA}` };
    if (!categorias.includes(cat)) maximos[cat] = n;
  }

  return { restricciones: { categorias_bloqueadas: categorias, zonas_bloqueadas: zonas, productos_bloqueados: productos, maximos } };
};

const listaAlergenos = claves => claves.map(a => ALERGENOS[a] || a).join(', ');

// Qué alérgenos del alumno tiene cada producto: [{ id, nombre, alergenos }]
const conflictosAlergia = (alumnoAlergenos = [], productos = []) =>
  productos
    .map(p => ({ id: p.id, nombre: p.nombre, alergenos: (p.alergenos || []).filter(a => alumnoAlergenos.includes(a)) }))
    .filter(p => p.alergenos.length > 0);

/**
 * Evalúa una compra contra las reglas de la familia.
 *  - alumno: { nombre, restricciones, limite_semanal }
 *  - lineas: [{ id, nombre, categoria, qty }]
 *  - lugar: zona donde se cobra
 *  - hoyPorCategoria: unidades ya compradas hoy por categoría
 *  - gastoSemana: lo gastado desde el lunes; total: el total de esta compra
 * Devuelve la lista de motivos por los que no se permite (vacía = se permite).
 */
const evaluarReglas = ({ alumno, lineas, lugar, hoyPorCategoria = {}, gastoSemana = 0, total = 0 }) => {
  const r = alumno.restricciones || {};
  const nombre = (alumno.nombre || '').split(' ')[0];
  const motivos = [];

  if ((r.zonas_bloqueadas || []).includes(lugar)) {
    motivos.push(`La familia de ${nombre} no permite compras en ${lugar}`);
  }
  for (const l of lineas) {
    if ((r.productos_bloqueados || []).includes(Number(l.id))) motivos.push(`La familia de ${nombre} no permite comprar ${l.nombre}`);
    else if ((r.categorias_bloqueadas || []).includes(l.categoria)) motivos.push(`La familia de ${nombre} no permite comprar ${NOMBRE_CATEGORIA[l.categoria] || l.categoria} (${l.nombre})`);
  }

  const enCarrito = {};
  for (const l of lineas) if (l.categoria) enCarrito[l.categoria] = (enCarrito[l.categoria] || 0) + l.qty;
  for (const [cat, max] of Object.entries(r.maximos || {})) {
    if (!enCarrito[cat]) continue;
    const ya = Number(hoyPorCategoria[cat] || 0);
    if (ya + enCarrito[cat] > max) {
      motivos.push(max === 0
        ? `La familia de ${nombre} no permite comprar ${NOMBRE_CATEGORIA[cat] || cat}`
        : `${nombre} puede comprar hasta ${max} ${NOMBRE_CATEGORIA[cat] || cat} por día (ya compró ${ya})`);
    }
  }

  const limite = alumno.limite_semanal == null ? null : Number(alumno.limite_semanal);
  if (limite !== null && Number(gastoSemana) + Number(total) > limite) {
    motivos.push(`Supera el límite semanal de $${limite.toLocaleString('es-AR')} (esta semana gastó $${Number(gastoSemana).toLocaleString('es-AR')})`);
  }

  return [...new Set(motivos)];
};

// Resumen en palabras de las reglas, para mostrar en el POS y en los avisos
const resumenReglas = alumno => {
  const r = alumno.restricciones || {};
  const partes = [];
  if ((r.categorias_bloqueadas || []).length) partes.push('sin ' + r.categorias_bloqueadas.map(c => NOMBRE_CATEGORIA[c] || c).join(', '));
  for (const [cat, max] of Object.entries(r.maximos || {})) partes.push(`máx. ${max} ${NOMBRE_CATEGORIA[cat] || cat}/día`);
  if ((r.zonas_bloqueadas || []).length) partes.push('no compra en ' + r.zonas_bloqueadas.join(', '));
  if ((r.productos_bloqueados || []).length) partes.push(`${r.productos_bloqueados.length} producto(s) bloqueado(s)`);
  if (alumno.limite_semanal != null) partes.push(`hasta $${Number(alumno.limite_semanal).toLocaleString('es-AR')}/semana`);
  return partes;
};

module.exports = {
  ALERGENOS, CATEGORIAS, NOMBRE_CATEGORIA,
  normalizarAlergenos, normalizarRestricciones, deducirAlergenos, conflictosAlergia, evaluarReglas, resumenReglas, listaAlergenos,
};
