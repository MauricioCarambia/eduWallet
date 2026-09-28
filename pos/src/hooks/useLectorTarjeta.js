import { useEffect, useRef } from 'react'

// Lector de tarjetas NFC por USB: se comporta como un teclado que "escribe"
// el número de la tarjeta muy rápido y termina con Enter. Se detecta por la
// velocidad (una persona no tipea 8+ caracteres a menos de 50 ms cada uno),
// así funciona sin importar qué campo tenga el cursor.
const MAX_MS_ENTRE_TECLAS = 50
const MIN_CARACTERES = 6

export default function useLectorTarjeta(onLeer, activo = true) {
  const onLeerRef = useRef(onLeer)
  useEffect(() => { onLeerRef.current = onLeer }, [onLeer])

  useEffect(() => {
    if (!activo) return
    let buffer = ''
    let ultima = 0

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
          onLeerRef.current(leido)
        }
        buffer = ''
        return
      }
      if (e.key.length === 1) buffer += e.key
    }

    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [activo])
}

// Web NFC (Chrome en Android): lee el número de serie de la tarjeta
export const nfcDisponible = () => typeof window !== 'undefined' && 'NDEFReader' in window

export async function escucharNfc(onLeer, signal) {
  const ndef = new window.NDEFReader()
  await ndef.scan({ signal })
  ndef.onreading = ({ serialNumber }) => onLeer(serialNumber)
}
