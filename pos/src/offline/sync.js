// Copia para vender sin internet y sincronización de lo hecho sin conexión:
// ventas en cola, cajas abiertas o cerradas sin internet y el aviso del equipo
// al servidor (para que el admin vea los equipos con ventas sin subir).
import api from '../api/axios'
import { leerDato, guardarDato, encolar, leerCola, quitarDeCola } from './almacen'
import { offlineHabilitado, leerEstado, cambiarEstado, esErrorDeRed } from './estado'

const CADA_COPIA = 5 * 60 * 1000   // renovar la copia cada 5 minutos con internet
const CADA_REINTENTO = 20 * 1000   // reintentar subir lo pendiente cada 20 segundos
const CADA_AVISO = 2 * 60 * 1000   // avisar al servidor el estado del equipo cada 2 minutos
const POR_TANDA = 100

const hayToken = () => { try { return !!localStorage.getItem('pos_token') } catch { return false } }
const esHoy = iso => new Date(iso).toDateString() === new Date().toDateString()
const leerLocal = (clave, porDefecto) => { try { return JSON.parse(localStorage.getItem(clave)) ?? porDefecto } catch { return porDefecto } }
const guardarLocal = (clave, valor) => { try { localStorage.setItem(clave, JSON.stringify(valor)) } catch { /* sin almacenamiento */ } }

// ─── Cajas abiertas / cerradas sin internet ────────────────────────────────
// { abiertas: [{ id_local, local, fondo, apertura, cierre? }], cierres: [{ caja_id, cierre }] }
const leerOperacionesCaja = async () => (await leerDato('cajas')) || { abiertas: [], cierres: [] }
const guardarOperacionesCaja = ops => guardarDato('cajas', ops)

export const esCajaLocal = caja => String(caja?.id ?? '').startsWith('local:')

export const abrirCajaSinConexion = async ({ local, fondo, empleadoId }) => {
  const id_local = crypto.randomUUID()
  const apertura = new Date().toISOString()
  const ops = await leerOperacionesCaja()
  ops.abiertas.push({ id_local, local, fondo: parseInt(fondo) || 0, apertura })
  await guardarOperacionesCaja(ops)
  await contarPendientes()
  return { id: 'local:' + id_local, empleado_id: empleadoId, local, fondo: parseInt(fondo) || 0, ventas: 0, tx_count: 0, abierta: true, apertura, offline: true }
}

export const cerrarCajaSinConexion = async caja => {
  const ops = await leerOperacionesCaja()
  const cierre = new Date().toISOString()
  if (esCajaLocal(caja)) {
    const abierta = ops.abiertas.find(c => 'local:' + c.id_local === caja.id)
    if (abierta) abierta.cierre = cierre
    else ops.cierres.push({ caja_id: caja.id, cierre }) // ya se creó en el servidor
  } else {
    ops.cierres.push({ caja_id: caja.id, cierre })
  }
  await guardarOperacionesCaja(ops)
  await contarPendientes()
}

// ─── Cola de ventas ─────────────────────────────────────────────────────────
const contarPendientes = async () => {
  const cola = await leerCola()
  const ops = await leerOperacionesCaja()
  cambiarEstado({
    pendientes: cola.filter(v => !v.error).length,
    conError: cola.filter(v => v.error).length,
    operaciones: ops.abiertas.length + ops.cierres.length,
  })
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
  await contarPendientes()
}

// Anular una venta hecha sin internet que todavía no se subió: sale de la cola.
// Devuelve la venta quitada, o null si ya no estaba (ya se subió).
export const anularEnCola = async idVenta => {
  const venta = (await leerCola()).find(v => v.id_venta === idVenta)
  if (!venta) return null
  await quitarDeCola([idVenta])
  await contarPendientes()
  return venta
}

// Número de transacción en el servidor de una venta ya subida (para anularla)
export const transaccionDeVenta = idVenta => leerLocal('pos_subidas', {})[idVenta] || null
const recordarSubidas = resultados => {
  const subidas = leerLocal('pos_subidas', {})
  for (const r of resultados) if (r.transaccion_id) subidas[r.id_venta] = r.transaccion_id
  guardarLocal('pos_subidas', Object.fromEntries(Object.entries(subidas).slice(-200)))
}

let enCurso = null
export const sincronizar = () => {
  enCurso ??= (async () => {
    if (!offlineHabilitado() || !hayToken()) return
    const cola = (await contarPendientes()).filter(v => !v.error)
    const ops = await leerOperacionesCaja()
    if (cola.length === 0 && ops.abiertas.length === 0 && ops.cierres.length === 0) return
    cambiarEstado({ sincronizando: true })
    let subidas = 0, cajasListas = 0
    try {
      // Las cajas abiertas sin internet van primero (las ventas las necesitan) y
      // los cierres al final; si hay muchas ventas, van en tandas
      const tandas = Math.max(1, Math.ceil(cola.length / POR_TANDA))
      for (let i = 0; i < tandas; i++) {
        const tanda = cola.slice(i * POR_TANDA, (i + 1) * POR_TANDA)
        const primera = i === 0, ultima = i === tandas - 1
        const cierres = ultima ? [
          ...ops.cierres,
          ...ops.abiertas.filter(c => c.cierre).map(c => ({ caja_id: 'local:' + c.id_local, cierre: c.cierre })),
        ] : []
        const { data } = await api.post('/offline/ventas', {
          cajas: primera ? ops.abiertas.map(({ id_local, local, fondo, apertura }) => ({ id_local, local, fondo, apertura })) : [],
          ventas: tanda.map(({ id_venta, alumno_id, lugar, items, descuento, caja_id, empleado_id, fecha }) =>
            ({ id_venta, alumno_id, lugar, items: items.map(({ id, qty }) => ({ id, qty })), descuento, caja_id, empleado_id, fecha })),
          cierres,
        }, { timeout: 60000 })
        const listas = (data.resultados || []).filter(r => r.estado === 'ok' || r.estado === 'ya_estaba')
        await quitarDeCola(listas.map(r => r.id_venta))
        recordarSubidas(listas)
        subidas += listas.length
        // Errores definitivos (ej. alumno borrado): quedan marcados para revisarlos
        for (const r of (data.resultados || []).filter(r => r.estado === 'error')) {
          const v = tanda.find(x => x.id_venta === r.id_venta)
          if (v) await encolar({ ...v, error: r.error || 'No se pudo registrar' })
        }
        // Cajas: se sacan de lo pendiente las que ya quedaron en el servidor
        const actuales = await leerOperacionesCaja()
        const creadas = new Set((data.cajas || []).filter(c => c.estado === 'ok' || c.estado === 'ya_estaba').map(c => c.id_local))
        const cerradas = new Set((data.cierres || []).filter(c => c.estado === 'ok' || c.estado === 'error').map(c => String(c.caja_id)))
        const restantes = {
          // una caja creada queda pendiente sólo si todavía falta subir su cierre
          abiertas: actuales.abiertas.filter(c => !creadas.has(c.id_local) || (c.cierre && !cerradas.has('local:' + c.id_local)))
            .map(c => creadas.has(c.id_local) ? { ...c, creada: true } : c),
          cierres: actuales.cierres.filter(c => !cerradas.has(String(c.caja_id))),
        }
        // las cajas ya creadas que siguen abiertas no se vuelven a mandar
        restantes.abiertas = restantes.abiertas.filter(c => !(c.creada && !c.cierre))
        cajasListas += creadas.size + cerradas.size
        await guardarOperacionesCaja(restantes)
      }
    } catch (err) {
      if (!esErrorDeRed(err)) console.error('Sincronización offline', err)
    } finally {
      await contarPendientes()
      cambiarEstado({ sincronizando: false, ...(subidas ? { ultimaSync: { cantidad: subidas, cuando: new Date().toISOString() } } : {}) })
      if (subidas || cajasListas) {
        await refrescarCopia()
        window.dispatchEvent(new Event('koletap:sincronizado'))
      }
      reportarEstado()
    }
  })().finally(() => { enCurso = null })
  return enCurso
}

// ─── Aviso del equipo al servidor ───────────────────────────────────────────
const idEquipo = () => {
  let id = leerLocal('pos_dispositivo', null)
  if (!id) { id = crypto.randomUUID(); guardarLocal('pos_dispositivo', id) }
  return id
}
const nombreEquipo = () => {
  const ua = navigator.userAgent
  const so = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPad|Macintosh.*Mobile/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ? 'iPad' : /iPhone/.test(ua) ? 'iPhone' : /Mac/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : ''
  if (window.koletapEscritorio || window.edupassEscritorio || window.eduwalletEscritorio) return 'App de escritorio' + (so ? ` (${so})` : '')
  if (so === 'Android') return /Mobile/.test(ua) ? 'Celular Android' : 'Tablet Android'
  if (so === 'iPad' || so === 'iPhone') return so
  return 'Navegador' + (so ? ` (${so})` : '')
}

export const reportarEstado = async () => {
  if (!offlineHabilitado() || !hayToken()) return
  try {
    const cola = await leerCola()
    const caja = leerLocal('pos_caja', null)
    const sesion = leerLocal('pos_sesion', {})
    const sinSubir = cola.filter(v => !v.error)
    await api.post('/offline/estado', {
      dispositivo: idEquipo(),
      equipo: nombreEquipo(),
      local: caja?.local || sesion.local || null,
      pendientes: sinSubir.length,
      con_error: cola.length - sinSubir.length,
      pendientes_desde: sinSubir[0]?.fecha || null,
    }, { timeout: 15000 })
  } catch { /* sin conexión: se avisa la próxima vez */ }
}

let iniciado = false
export const iniciarOffline = () => {
  if (iniciado || !offlineHabilitado()) return
  iniciado = true
  // Pedirle al navegador que no borre los datos guardados (la cola de ventas)
  // aunque le falte espacio; en Android/PC lo da solo a las apps instaladas o muy usadas
  navigator.storage?.persist?.().catch(() => {})
  // Bajar ya la parte de la cámara para leer QR, así también anda sin internet
  setTimeout(() => { import('@zxing/browser').catch(() => {}) }, 15000)
  leerDato('copia').then(c => c && cambiarEstado({ copiaDe: c.generado })).catch(() => {})
  contarPendientes().catch(() => {})
  refrescarCopia().then(() => sincronizar())
  setInterval(() => { if (leerEstado().online) refrescarCopia() }, CADA_COPIA)
  setInterval(() => reportarEstado(), CADA_AVISO)
  // Con algo pendiente, reintentar subirlo; sin conexión, probar si volvió
  setInterval(() => {
    const e = leerEstado()
    if (e.pendientes > 0 || e.operaciones > 0) sincronizar()
    else if (!e.online) refrescarCopia()
  }, CADA_REINTENTO)
  window.addEventListener('koletap:conexion-volvio', () => sincronizar())
  window.addEventListener('online', () => sincronizar())
}
