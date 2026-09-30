import { useEffect, useRef, useState } from 'react'

// Lector de tarjetas NFC por USB: se comporta como un teclado que "escribe"
// el número de la tarjeta muy rápido y termina con Enter. Se detecta por la
// velocidad (una persona no tipea 8+ caracteres a menos de 50 ms cada uno),
// así funciona sin importar qué campo tenga el cursor.
const MAX_MS_ENTRE_TECLAS = 50
const MIN_CARACTERES = 6

const MS_REPETIDA = 1500

// repetidaMs: la misma lectura repetida dentro de ese tiempo se toma una sola
// vez (los lectores de tarjetas a veces leen dos veces). Con 0 cuenta todas:
// sirve para códigos de barras, donde dos productos iguales son dos lecturas.
export default function useLectorTarjeta(onLeer, activo = true, { repetidaMs = MS_REPETIDA } = {}) {
  const onLeerRef = useRef(onLeer)
  useEffect(() => { onLeerRef.current = onLeer }, [onLeer])
  const ultimaRef = useRef({ codigo: null, t: 0 })

  useEffect(() => {
    if (!activo) return
    let buffer = ''
    let ultima = 0

    const leer = codigo => {
      const ahora = Date.now()
      const u = ultimaRef.current
      if (u.codigo === codigo && ahora - u.t < repetidaMs) return
      ultimaRef.current = { codigo, t: ahora }
      onLeerRef.current(codigo)
    }

    const onKeyDown = e => {
      const ahora = Date.now()
      if (ahora - ultima > MAX_MS_ENTRE_TECLAS) buffer = ''
      ultima = ahora

      if (e.key === 'Enter') {
        if (buffer.length >= MIN_CARACTERES) {
          e.preventDefault()
          e.stopPropagation()
          const leido = buffer
          // Sacar lo que el lector alcanzó a escribir en el campo con foco
          const el = document.activeElement
          if (el && 'value' in el && typeof el.value === 'string' && el.value.endsWith(leido)) {
            const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value')?.set
            setter?.call(el, el.value.slice(0, -leido.length))
            el.dispatchEvent(new Event('input', { bubbles: true }))
          }
          leer(leido)
        }
        buffer = ''
        return
      }
      if (e.key.length === 1) buffer += e.key
    }

    document.addEventListener('keydown', onKeyDown, true)
    // App de escritorio (KoleTap POS para Windows): el lector PC/SC
    // (ACR122U) manda las tarjetas directo, sin pasar por el teclado
    const desuscribir = escritorio()?.onTarjeta(uid => leer(uid))
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      desuscribir?.()
    }
  }, [activo, repetidaMs])
}

// ─── App de escritorio ──────────────────────────────────────────────────────
const escritorio = () => (typeof window !== 'undefined' ? (window.koletapEscritorio || window.edupassEscritorio || window.eduwalletEscritorio) : undefined) // edupass/eduwallet: app de escritorio instalada con un nombre anterior

// Estado del lector de la app de escritorio: { disponible, conectado, lectores }
// (disponible = false cuando se usa desde el navegador)
export function useLectorEscritorio() {
  const [estado, setEstado] = useState({ disponible: !!escritorio(), conectado: false, lectores: [] })
  useEffect(() => {
    const api = escritorio()
    if (!api) return
    const aplicar = e => setEstado({ disponible: true, conectado: !!e?.conectado, lectores: e?.lectores || [] })
    api.estadoLector().then(aplicar).catch(() => {})
    return api.onLector(aplicar)
  }, [])
  return estado
}

// Web NFC (Chrome en Android): lee el número de serie de la tarjeta
export const nfcDisponible = () => typeof window !== 'undefined' && 'NDEFReader' in window

export async function escucharNfc(onLeer, signal) {
  const ndef = new window.NDEFReader()
  await ndef.scan({ signal })
  ndef.onreading = ({ serialNumber }) => onLeer(serialNumber)
}
