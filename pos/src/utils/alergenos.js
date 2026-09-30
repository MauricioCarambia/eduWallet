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
    if (ya + enCarrito + 1 > max) return `Máximo ${max} ${NOMBRE_CATEGORIA[p.categoria] || p.categoria} por día (ya lleva ${ya + enCarrito})`
  }
  return null
}

// Alérgenos del alumno que tiene el producto
export const alergiasDe = (p, ctrl) => (ctrl?.alergenos?.length ? (p.alergenos || []).filter(a => ctrl.alergenos.includes(a)) : [])
