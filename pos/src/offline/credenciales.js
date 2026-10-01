// Reconocer una credencial (QR) o tarjeta sin internet. La copia offline no
// guarda los códigos sino su huella SHA-256: acá se calcula la huella de lo
// leído y se busca. Misma lógica que el servidor (credencialesService.js,
// tarjetasService.js y la huella de offlineController.js).

const normalizarCodigo = codigo => String(codigo ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')

const invertirBytes = hex => hex.match(/../g).reverse().join('')

// Variantes hex de un UID leído (cada lector lo entrega en otro formato)
export const variantesUid = lectura => {
  const texto = String(lectura ?? '').trim().toUpperCase()
  const variantes = new Set()
  const hex = texto.replace(/[\s:-]/g, '')
  if (/^[0-9A-F]+$/.test(hex) && hex.length >= 8 && hex.length <= 20 && hex.length % 2 === 0) {
    variantes.add(hex)
    variantes.add(invertirBytes(hex))
  }
  if (/^\d{6,20}$/.test(hex)) {
    let h = BigInt(hex).toString(16).toUpperCase()
    const largo = h.length <= 8 ? 8 : h.length <= 14 ? 14 : h.length + (h.length % 2)
    h = h.padStart(largo, '0')
    variantes.add(h)
    variantes.add(invertirBytes(h))
  }
  return [...variantes]
}

export const huella = async valor => {
  const datos = new TextEncoder().encode('koletap:' + valor)
  const hash = await crypto.subtle.digest('SHA-256', datos)
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('')
}

// → { alumno_id, medio } o null. "claves" es la lista [huella, alumno_id, medio] de la copia.
export const buscarCredencial = async (codigo, claves) => {
  const indice = new Map(claves.map(([h, id, medio]) => [h, { alumno_id: id, medio }]))
  const qr = normalizarCodigo(codigo)
  if (qr.length >= 6) {
    const r = indice.get(await huella(qr))
    if (r?.medio === 'qr') return r
  }
  for (const v of variantesUid(codigo)) {
    const r = indice.get(await huella(v))
    if (r?.medio === 'tarjeta') return r
  }
  return null
}
