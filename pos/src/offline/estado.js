import { useSyncExternalStore } from 'react'

// Estado del modo offline, compartido por toda la app (sin contexto de React:
// lo actualizan el cliente de la API y la sincronización).

// iPhone / iPad (también el iPad que se presenta como Mac)
export const esIOS = () => typeof navigator !== 'undefined' &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))

// El POS abierto como app instalada (ícono en la pantalla de inicio)
export const instalada = () => typeof window !== 'undefined' &&
  (window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true)

// Modo offline: en la app de escritorio, en Android, en tablets y en PCs con
// navegador. En iPhone/iPad sólo con el POS instalado: si no, Safari puede
// borrar los datos guardados (la cola de ventas) a los pocos días.
// localStorage.pos_offline = '1' / '0' lo fuerza (para pruebas).
export const offlineHabilitado = () => {
  if (typeof window === 'undefined') return false
  try {
    const forzado = localStorage.getItem('pos_offline')
    if (forzado === '1') return true
    if (forzado === '0') return false
  } catch { /* sin almacenamiento */ }
  if (window.koletapEscritorio || window.edupassEscritorio || window.eduwalletEscritorio) return true
  return !esIOS() || instalada()
}

// iPhone/iPad sin instalar: se le explica cómo instalarlo para cobrar sin internet
export const faltaInstalarEnIOS = () => esIOS() && !instalada()

let estado = {
  online: true,          // el último pedido al servidor anduvo
  pendientes: 0,         // ventas en la cola esperando subir
  conError: 0,           // ventas que el servidor no pudo registrar
  sincronizando: false,
  copiaDe: null,         // fecha de la copia offline guardada
  ultimaSync: null,      // { cantidad, cuando } de la última sincronización con ventas
  operaciones: 0,        // cajas abiertas o cerradas sin internet, por subir
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
