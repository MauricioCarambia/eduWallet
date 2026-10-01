import { useSyncExternalStore } from 'react'

// Ancho de la ventana, para adaptar el POS a PC, tablet y celular
const suscribir = cb => { window.addEventListener('resize', cb); return () => window.removeEventListener('resize', cb) }
const leer = () => window.innerWidth

export const ANCHO_CELULAR = 768   // menos: celular (una columna, menú escondido)
export const ANCHO_TABLET = 1100   // menos: tablet (menú angosto)

export default function useAncho() {
  return useSyncExternalStore(suscribir, leer)
}
