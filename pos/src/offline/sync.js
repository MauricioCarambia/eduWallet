// Copia para vender sin internet y sincronización de las ventas en cola.
import api from '../api/axios'
import { leerDato, guardarDato, encolar, leerCola, quitarDeCola } from './almacen'
import { offlineHabilitado, leerEstado, cambiarEstado, esErrorDeRed } from './estado'

const CADA_COPIA = 5 * 60 * 1000   // renovar la copia cada 5 minutos con internet
const CADA_REINTENTO = 20 * 1000   // reintentar subir la cola cada 20 segundos
const POR_TANDA = 100

const hayToken = () => { try { return !!localStorage.getItem('pos_token') } catch { return false } }
const esHoy = iso => new Date(iso).toDateString() === new Date().toDateString()

const contarCola = async () => {
  const cola = await leerCola()
  cambiarEstado({ pendientes: cola.filter(v => !v.error).length, conError: cola.filter(v => v.error).length })
  return cola
}

export const refrescarCopia = async () => {
  if (!offlineHabilitado() || !hayToken()) return null
  try {
    const { data } = await api.get('/offline/datos', { timeout: 30000 })
    await guardarDato('copia', data)
    cambiarEstado({ copiaDe: data.generado })
    return data
  } catch { return null }
}

// La copia con las ventas de la cola ya aplicadas (saldo, gasto, stock y
// consumo por categoría), para que todo lo que muestra el POS esté al día
export const leerCopia = async () => {
  const copia = await leerDato('copia')
  if (!copia) return null
  const cola = await leerCola()
  const porAlumno = new Map(), porProducto = new Map()
  for (const v of cola) {
    const a = porAlumno.get(v.alumno_id) || { total: 0, hoy: 0, semana: 0, categorias: {} }
    a.total += v.total
    a.semana += v.total
    if (esHoy(v.fecha)) {
      a.hoy += v.total
      for (const i of v.items) if (i.categoria) a.categorias[i.categoria] = (a.categorias[i.categoria] || 0) + i.qty
    }
    porAlumno.set(v.alumno_id, a)
    for (const i of v.items) porProducto.set(i.id, (porProducto.get(i.id) || 0) + i.qty)
  }
  return {
    ...copia,
    productos: copia.productos.map(p => porProducto.has(p.id) ? { ...p, stock: Math.max(0, p.stock - porProducto.get(p.id)) } : p),
    alumnos: copia.alumnos.map(a => {
      const d = porAlumno.get(a.id)
      if (!d) return a
      const hoy = { ...a.control.hoy_por_categoria }
      for (const [c, n] of Object.entries(d.categorias)) hoy[c] = (hoy[c] || 0) + n
      return {
        ...a,
        saldo: String(Number(a.saldo) - d.total),
        gasto_hoy: String(Number(a.gasto_hoy) + d.hoy),
        control: { ...a.control, hoy_por_categoria: hoy, gasto_semana: a.control.gasto_semana == null ? null : a.control.gasto_semana + d.semana },
      }
    }),
  }
}

// Cuánto gastó un alumno hoy en ventas sin internet de esta caja (para el tope)
export const gastadoSinConexionHoy = async alumnoId =>
  (await leerCola()).filter(v => v.alumno_id === alumnoId && esHoy(v.fecha)).reduce((s, v) => s + v.total, 0)

export const encolarVenta = async venta => {
  await encolar(venta)
  await contarCola()
}

let enCurso = null
export const sincronizar = () => {
  enCurso ??= (async () => {
    if (!offlineHabilitado() || !hayToken()) return
    const cola = (await contarCola()).filter(v => !v.error)
    if (cola.length === 0) return
    cambiarEstado({ sincronizando: true })
    let subidas = 0
    try {
      for (let i = 0; i < cola.length; i += POR_TANDA) {
        const tanda = cola.slice(i, i + POR_TANDA)
        const { data } = await api.post('/offline/ventas', {
          ventas: tanda.map(({ id_venta, alumno_id, lugar, items, descuento, caja_id, empleado_id, fecha }) =>
            ({ id_venta, alumno_id, lugar, items: items.map(({ id, qty }) => ({ id, qty })), descuento, caja_id, empleado_id, fecha })),
        }, { timeout: 60000 })
        const listas = data.resultados.filter(r => r.estado === 'ok' || r.estado === 'ya_estaba').map(r => r.id_venta)
        await quitarDeCola(listas)
        subidas += listas.length
        // Errores definitivos (ej. alumno borrado): quedan marcados para revisarlos
        for (const r of data.resultados.filter(r => r.estado === 'error')) {
          const v = tanda.find(x => x.id_venta === r.id_venta)
          if (v) await encolar({ ...v, error: r.error || 'No se pudo registrar' })
        }
      }
    } catch (err) {
      if (!esErrorDeRed(err)) console.error('Sincronización offline', err)
    } finally {
      await contarCola()
      cambiarEstado({ sincronizando: false, ...(subidas ? { ultimaSync: { cantidad: subidas, cuando: new Date().toISOString() } } : {}) })
      if (subidas) {
        await refrescarCopia()
        window.dispatchEvent(new Event('koletap:sincronizado'))
      }
    }
  })().finally(() => { enCurso = null })
  return enCurso
}

let iniciado = false
export const iniciarOffline = () => {
  if (iniciado || !offlineHabilitado()) return
  iniciado = true
  leerDato('copia').then(c => c && cambiarEstado({ copiaDe: c.generado })).catch(() => {})
  contarCola().catch(() => {})
  refrescarCopia().then(() => sincronizar())
  setInterval(() => { if (leerEstado().online) refrescarCopia() }, CADA_COPIA)
  // Con ventas en cola, reintentar subirlas; sin conexión, probar si volvió
  setInterval(() => {
    if (leerEstado().pendientes > 0) sincronizar()
    else if (!leerEstado().online) refrescarCopia()
  }, CADA_REINTENTO)
  window.addEventListener('koletap:conexion-volvio', () => sincronizar())
  window.addEventListener('online', () => sincronizar())
}
