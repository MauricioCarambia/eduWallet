import { useSyncExternalStore } from 'react'

// Estado del modo offline, compartido por toda la app (sin contexto de React:
// lo actualizan el cliente de la API y la sincronización).

// Etapa 1: el modo offline está en la app de escritorio. En el navegador se
// puede probar con localStorage.pos_offline = '1'.
export const offlineHabilitado = () => {
  if (typeof window === 'undefined') return false
  if (window.koletapEscritorio || window.edupassEscritorio || window.eduwalletEscritorio) return true
  try { return localStorage.getItem('pos_offline') === '1' } catch { return false }
}

let estado = {
  online: true,          // el último pedido al servidor anduvo
  pendientes: 0,         // ventas en la cola esperando subir
  conError: 0,           // ventas que el servidor no pudo registrar
  sincronizando: false,
  copiaDe: null,         // fecha de la copia offline guardada
  ultimaSync: null,      // { cantidad, cuando } de la última sincronización con ventas
}
const oyentes = new Set()

export const leerEstado = () => estado
export const cambiarEstado = cambios => {
  const nuevo = { ...estado, ...cambios }
  if (Object.keys(cambios).every(k => estado[k] === nuevo[k])) return
  estado = nuevo
  oyentes.forEach(o => o())
}
const suscribir = o => { oyentes.add(o); return () => oyentes.delete(o) }

export const useOffline = () => useSyncExternalStore(suscribir, leerEstado)

// Un error sin respuesta del servidor (sin internet, servidor caído o que no
// contestó a tiempo). Un 400/403/500 NO es de red: el servidor contestó.
export const esErrorDeRed = err => !!err && !err.response && err.code !== 'ERR_CANCELED'

// Lo llama el cliente de la API en cada respuesta
export const marcarRed = ok => {
  if (ok !== estado.online) {
    cambiarEstado({ online: ok })
    if (ok) window.dispatchEvent(new Event('koletap:conexion-volvio'))
  }
}
