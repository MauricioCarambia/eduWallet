// Leer una lista de productos de un Excel (.xlsx) o CSV para importarla al POS.
// Acepta los encabezados más comunes (Producto, Precio, Cantidad, EAN...) en
// cualquier orden; las columnas que sobran se ignoran.

export const MAX_FILAS = 1000

const sinAcentos = t => String(t ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[_\s]+/g, ' ')

const COLUMNAS = {
  nombre: ['nombre', 'producto', 'articulo', 'descripcion', 'detalle'],
  precio: ['precio', 'precio venta', 'precio de venta', 'valor', 'importe'],
  stock: ['stock', 'cantidad', 'existencia', 'unidades'],
  categoria: ['categoria', 'rubro', 'tipo'],
  codigo_barras: ['codigo barras', 'codigo de barras', 'cod barras', 'codigo', 'ean', 'barcode', 'upc'],
  alergenos: ['alergenos', 'alergeno', 'alergias', 'contiene'],
  grupo: ['grupo', 'familia', 'variedad', 'linea'],
  costo: ['costo', 'precio compra', 'precio de compra', 'compra'],
  unidades_bulto: ['bulto', 'unidades bulto', 'unidades por bulto', 'x caja', 'unidades por caja', 'caja'],
}

// "$ 1.500,50" → 1500.5 · "1500.5" → 1500.5 · "1.500" → 1500 (punto de miles)
export function leerNumero(v) {
  if (typeof v === 'number') return v
  let t = String(v ?? '').replace(/[$\s]/g, '')
  if (!t) return ''
  if (t.includes(',') && t.includes('.')) {
    t = t.lastIndexOf(',') > t.lastIndexOf('.') ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '')
  } else if (t.includes(',')) {
    t = t.replace(',', '.')
  } else if (/^\d{1,3}(\.\d{3})+$/.test(t)) {
    t = t.replace(/\./g, '')
  }
  const n = Number(t)
  return Number.isFinite(n) ? n : String(v).trim()
}

// El código tal cual; Excel a veces lo guarda como fórmula ="779..." para no
// perder ceros, y si lo pasó a notación científica (7,79E+12) ya no sirve.
function leerCodigo(v) {
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : { error: 'El código de barras no es válido' }
  const t = String(v ?? '').trim().replace(/^="?|"$/g, '').replace(/\s+/g, '')
  if (/^\d+([.,]\d+)?E\+?\d+$/i.test(t)) return { error: 'El código de barras quedó en notación científica: en Excel poné esa columna como Texto' }
  return t
}

// CSV con ; (Excel en español) o con , ; respeta comillas
export function leerCsv(texto) {
  const lineas = texto.replace(/^\uFEFF/, '').split(/\r?\n/)
  const primera = lineas.find(l => l.trim()) || ''
  const sep = (primera.match(/;/g) || []).length >= (primera.match(/,/g) || []).length ? ';' : ','
  return lineas.map(linea => {
    const celdas = []
    let actual = '', comillas = false
    for (let i = 0; i < linea.length; i++) {
      const c = linea[i]
      if (comillas) {
        if (c === '"' && linea[i + 1] === '"') { actual += '"'; i++ }
        else if (c === '"') comillas = false
        else actual += c
      } else if (c === '"') comillas = true
      else if (c === sep) { celdas.push(actual); actual = '' }
      else actual += c
    }
    celdas.push(actual)
    return celdas
  })
}

// Filas del archivo (la primera con los encabezados) → productos para el backend
export function filasAProductos(filas) {
  const iEncabezado = filas.findIndex(f => f.some(c => String(c ?? '').trim()))
  if (iEncabezado < 0) throw new Error('El archivo está vacío')
  const encabezados = filas[iEncabezado].map(sinAcentos)
  const indice = {}
  for (const [campo, nombres] of Object.entries(COLUMNAS)) {
    const i = encabezados.findIndex(e => nombres.includes(e))
    if (i >= 0) indice[campo] = i
  }
  if (indice.nombre === undefined || indice.precio === undefined) {
    throw new Error('No encontré las columnas "nombre" y "precio" en la primera fila')
  }

  const productos = []
  filas.slice(iEncabezado + 1).forEach((f, i) => {
    if (!f.some(c => String(c ?? '').trim())) return
    const celda = campo => (indice[campo] === undefined ? '' : f[indice[campo]] ?? '')
    const codigo = leerCodigo(celda('codigo_barras'))
    productos.push({
      fila: iEncabezado + i + 2,
      nombre: String(celda('nombre')).trim(),
      precio: leerNumero(celda('precio')),
      stock: leerNumero(celda('stock')),
      categoria: String(celda('categoria')).trim(),
      codigo_barras: typeof codigo === 'string' ? codigo : '',
      alergenos: String(celda('alergenos')).trim(),
      grupo: String(celda('grupo')).trim(),
      costo: leerNumero(celda('costo')),
      unidades_bulto: leerNumero(celda('unidades_bulto')) || 1,
      aviso: typeof codigo === 'string' ? null : codigo.error,
    })
  })
  if (productos.length === 0) throw new Error('El archivo no tiene productos debajo de los encabezados')
  if (productos.length > MAX_FILAS) throw new Error(`El archivo tiene ${productos.length} productos; se pueden importar hasta ${MAX_FILAS} por vez`)
  return productos
}

export async function leerArchivo(archivo) {
  const nombre = archivo.name.toLowerCase()
  if (nombre.endsWith('.csv') || nombre.endsWith('.txt')) return filasAProductos(leerCsv(await archivo.text()))
  if (nombre.endsWith('.xlsx')) {
    const { readSheet } = await import('read-excel-file/browser')
    return filasAProductos(await readSheet(archivo))
  }
  if (nombre.endsWith('.xls')) throw new Error('Los .xls viejos no se pueden leer: abrilo en Excel y guardalo como .xlsx')
  throw new Error('Elegí un archivo .xlsx o .csv')
}

// Planilla modelo para descargar (CSV que Excel abre directo). El código va
// como ="..." para que Excel no lo pase a notación científica.
export function descargarModelo() {
  const csv = '\uFEFFnombre;precio;stock;categoria;codigo_barras;alergenos;grupo\r\n' +
    'Alfajor de chocolate;800;24;golosina;="7790580000011";gluten, leche;Alfajores\r\n' +
    'Alfajor de dulce de leche;800;24;golosina;="7790580000028";gluten, leche;Alfajores\r\n' +
    'Agua mineral 500 ml;1000;12;bebida;;;\r\n' +
    'Lápiz negro;350;50;útil;;;\r\n'
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url; a.download = 'productos-modelo.csv'; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
