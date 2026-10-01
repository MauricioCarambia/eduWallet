// Alérgenos que se pueden marcar en los productos (las mismas claves que el backend)
export const ALERGENOS = {
  mani: 'Maní',
  frutos_secos: 'Frutos secos',
  gluten: 'Gluten (TACC)',
  leche: 'Leche / lactosa',
  huevo: 'Huevo',
  soja: 'Soja',
  pescado: 'Pescado y mariscos',
  sesamo: 'Sésamo',
}

export const nombresAlergenos = claves => (claves || []).map(a => ALERGENOS[a] || a).join(', ')

const NOMBRE_CATEGORIA = { comida: 'comida', bebida: 'bebidas', golosina: 'golosinas', 'útil': 'útiles', otro: 'otros' }
const pesos = n => `$${Number(n).toLocaleString('es-AR')}`

// Límite de gasto por zona que puso la familia: si este monto lo pasa, devuelve por qué.
// ctrl.gasto_zona: lo ya gastado en cada zona { Kiosco: { hoy, semana } }
export function excedeLimiteZona(zona, monto, ctrl) {
  const lz = ctrl?.restricciones?.limites_zona?.[zona]
  if (!lz) return null
  const ya = Number(ctrl.gasto_zona?.[zona]?.[lz.periodo === 'dia' ? 'hoy' : 'semana'] || 0)
  if (ya + Number(monto) <= Number(lz.monto)) return null
  return `En ${zona} la familia permite hasta ${pesos(lz.monto)} por ${lz.periodo === 'dia' ? 'día' : 'semana'} (ya gastó ${pesos(ya)})`
}

// Si la familia no permite vender este producto al alumno, devuelve por qué.
// ctrl: lo que devuelve GET /alumnos/:id/control; carrito: lo que ya se agregó
export function motivoBloqueo(p, ctrl, carrito = []) {
  if (!ctrl) return null
  const r = ctrl.restricciones || {}
  if ((r.zonas_bloqueadas || []).includes(p.local)) return `La familia no permite compras en ${p.local}`
  if ((r.productos_bloqueados || []).includes(p.id)) return `La familia no permite comprar ${p.nombre}`
  if ((r.categorias_bloqueadas || []).includes(p.categoria)) return `La familia no permite comprar ${NOMBRE_CATEGORIA[p.categoria] || p.categoria}`
  const max = r.maximos?.[p.categoria]
  if (max != null) {
    const ya = Number(ctrl.hoy_por_categoria?.[p.categoria] || 0)
    const enCarrito = carrito.filter(i => i.categoria === p.categoria).reduce((s, i) => s + i.qty, 0)
    if (ya + enCarrito + 1 > max) return `La familia permite hasta ${max} de ${NOMBRE_CATEGORIA[p.categoria] || p.categoria} por día (ya lleva ${ya + enCarrito})`
  }
  // límite de gasto en la zona, contando lo que ya está en el carrito
  const enCarrito = carrito.reduce((s, i) => s + Number(i.precio) * i.qty, 0)
  const zona = excedeLimiteZona(p.local, enCarrito + Number(p.precio), ctrl)
  if (zona) return zona
  return null
}

// Alérgenos del alumno que tiene el producto
export const alergiasDe = (p, ctrl) => (ctrl?.alergenos?.length ? (p.alergenos || []).filter(a => ctrl.alergenos.includes(a)) : [])
