// ─── Imagen PNG de la credencial (para guardar o mandar por WhatsApp) ──────
// Se dibuja en un canvas con el mismo diseño, a 300 dpi (85,6 × 54 mm).
const ANCHO = 1011
const ALTO = 638
const mm = n => Math.round(n * (ANCHO / 85.6))

const cargarImagen = src => new Promise((ok, falla) => {
  const img = new Image()
  img.onload = () => ok(img)
  img.onerror = falla
  img.src = src
})

// Parte el texto en renglones que entren en el ancho (máximo 3)
const renglones = (ctx, texto, ancho) => {
  const palabras = texto.split(/\s+/)
  const lineas = []
  let actual = ''
  for (const p of palabras) {
    const prueba = actual ? `${actual} ${p}` : p
    if (ctx.measureText(prueba).width <= ancho || !actual) actual = prueba
    else { lineas.push(actual); actual = p }
  }
  if (actual) lineas.push(actual)
  return lineas.slice(0, 3)
}

export async function imagenCredencial({ credencial, colegio, logo }) {
  const canvas = document.createElement('canvas')
  canvas.width = ANCHO
  canvas.height = ALTO
  const ctx = canvas.getContext('2d')
  const fuente = 'system-ui, -apple-system, "Segoe UI", sans-serif'

  // fondo blanco redondeado
  ctx.fillStyle = '#FFFFFF'
  ctx.beginPath()
  ctx.roundRect(0, 0, ANCHO, ALTO, mm(3.5))
  ctx.fill()

  const margen = mm(4)
  const lado = mm(34)
  const xQr = ANCHO - margen - lado
  const anchoTexto = xQr - margen - mm(3)

  // QR (sin suavizar, para que se lea bien)
  const qr = await cargarImagen(credencial.qr_img)
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(qr, xQr, (ALTO - lado) / 2, lado, lado)
  ctx.imageSmoothingEnabled = true

  // colegio (con logo si hay)
  let x = margen
  const yColegio = margen + mm(3)
  if (logo) {
    try {
      const img = await cargarImagen(logo)
      const l = mm(6)
      ctx.drawImage(img, x, yColegio - l + mm(1.2), l, l)
      x += l + mm(2)
    } catch { /* sin logo */ }
  }
  ctx.fillStyle = '#1D5C47'
  ctx.font = `700 ${mm(2.6)}px ${fuente}`
  ctx.textBaseline = 'alphabetic'
  ctx.fillText((colegio || 'KoleTap').toUpperCase(), x, yColegio, anchoTexto - (x - margen))

  // nombre y curso, abajo del medio
  ctx.fillStyle = '#16211D'
  ctx.font = `800 ${mm(4.6)}px ${fuente}`
  const lineas = renglones(ctx, credencial.nombre, anchoTexto)
  const alto = mm(4.6) * 1.15
  let y = ALTO / 2 + mm(1) - ((lineas.length - 1) * alto) / 2
  for (const l of lineas) { ctx.fillText(l, margen, y, anchoTexto); y += alto }
  ctx.fillStyle = '#5B6660'
  ctx.font = `400 ${mm(3.2)}px ${fuente}`
  ctx.fillText(credencial.curso || '', margen, y + mm(1))

  // pie
  ctx.fillStyle = '#6B7670'
  ctx.font = `400 ${mm(2.2)}px ${fuente}`
  ctx.fillText('Credencial KoleTap · personal e intransferible', margen, ALTO - margen, anchoTexto)

  return new Promise((ok, falla) => canvas.toBlob(b => (b ? ok(b) : falla(new Error('No se pudo generar la imagen'))), 'image/png'))
}
