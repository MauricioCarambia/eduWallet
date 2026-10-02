import { useState, useEffect, useRef } from 'react'
import { SkeletonCards } from '../components/Skeleton'
import { useAuth } from '../context/AuthContext'
import { useCaja } from '../context/CajaContext'
import api from '../api/axios'
import { hoyAR } from '../utils/fechas'
import useUmbralStock from '../hooks/useUmbralStock'
import { useLocales } from '../hooks/useLocales'
import useLectorTarjeta, { nfcDisponible, nfcEnOtroNavegador, escucharNfc, useLectorEscritorio } from '../hooks/useLectorTarjeta'
import { motivoBloqueo, alergiasDe, nombresAlergenos, excedeLimiteZona } from '../utils/alergenos'
import Icono from '../components/Icono'
import CatalogoVenta from '../components/CatalogoVenta'
import useAncho, { ANCHO_CELULAR, ANCHO_TABLET } from '../hooks/useAncho'
import { offlineHabilitado, esErrorDeRed, instalada } from '../offline/estado'
import { leerCopia, refrescarCopia, encolarVenta, gastadoSinConexionHoy, anularEnCola, transaccionDeVenta, esCajaLocal, sincronizar } from '../offline/sync'
import { buscarCredencial } from '../offline/credenciales'

// Algo tipeado o pegado en el buscador que parece un código (sin espacios, largo) y no un nombre
const esCodigo = texto => {
  const t = texto.trim()
  return /^EW[A-Z0-9]{12}$/i.test(t) || (/^[A-Za-z0-9:'\-]{8,}$/.test(t) && /\d/.test(t))
}

// La credencial leída dos veces seguidas (pasa con algunos lectores) cuenta una
const esRepeticion = (ref, codigo) => {
  const ahora = Date.now()
  const repetida = ref.current.codigo === codigo && ahora - ref.current.t < 1500
  ref.current = { codigo, t: ahora }
  return repetida
}

// Milisegundos desde un instante (o null si no empezó)
const msDesde = t => (t ? Date.now() - t : null)

const fmt = n => `$${Number(n).toLocaleString('es-AR')}`

export default function Venta() {
  const umbral = useUmbralStock()
  const ancho = useAncho()
  const movil = ancho < ANCHO_CELULAR
  const [verCobro, setVerCobro] = useState(false) // celular: pantalla del carrito y el alumno
  const { sesion } = useAuth()
  const { caja, abrirCaja, cerrarCaja, actualizarVentas } = useCaja()
  const { locales } = useLocales()
  const [productos, setProductos] = useState([])
  const [alumnos, setAlumnos] = useState([])
  const [carrito, setCarrito] = useState([])
  const [alumno, setAlumno] = useState(null)
  const [busq, setBusq] = useState('')
  const [descPct, setDescPct] = useState(0)
  const [fondoCaja, setFondoCaja] = useState('0')
  const [local, setLocal] = useState('')
  const [msg, setMsg] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [procesando, setProcesando] = useState(false)
  const [txsHoy, setTxsHoy] = useState([])
  const [masVendidos, setMasVendidos] = useState([]) // ids de producto, del más vendido al menos
  const [vistaVentas, setVistaVentas] = useState(false)
  const busqRef = useRef(null)
  const [busqAlumno, setBusqAlumno] = useState('')
  const [showSugerencias, setShowSugerencias] = useState(false)
  const [ultimaVenta, setUltimaVenta] = useState(null)
  const [modoEscaneo, setModoEscaneo] = useState('manual')
  const [escaneandoQR, setEscaneandoQR] = useState(false)
  const [errorQR, setErrorQR] = useState(null)
  const videoRef = useRef(null)
  const scannerRef = useRef(null)
  const [controlDe, setControlDe] = useState({ id: null, datos: null })
  const [confirmados, setConfirmados] = useState([]) // productos con alérgeno que el cajero confirmó
  const [avisoAlergia, setAvisoAlergia] = useState(null) // { titulo, detalle, alConfirmar }

  // Cada mensaje dura 4 s desde que aparece (el timer del anterior no borra el nuevo)
  const timerMsg = useRef(null)
  const showMsg = (tipo, texto) => { setMsg({ tipo, texto }); clearTimeout(timerMsg.current); timerMsg.current = setTimeout(() => setMsg(null), 4000) }

  const zonaFija = sesion?.local || null

  useEffect(() => { cargarDatos() }, [])
  useEffect(() => {
    if (!local) return
    let vigente = true
    api.get('/productos/mas-vendidos', { params: { local } })
      .then(r => { if (vigente) setMasVendidos(r.data.map(x => x.producto_id)) })
      .catch(() => { if (vigente) setMasVendidos([]) })
    return () => { vigente = false }
  }, [local])

  // Reglas de la familia y alergias del alumno identificado
  const ctrl = alumno && controlDe.id === alumno.id ? controlDe.datos : null
  useEffect(() => {
    if (!alumno?.id) return
    let vigente = true
    api.get(`/alumnos/${alumno.id}/control`).then(r => { if (vigente) setControlDe({ id: alumno.id, datos: r.data }) }).catch(async err => {
      if (!offlineHabilitado() || !esErrorDeRed(err)) return
      const a = (await leerCopia())?.alumnos.find(x => x.id === alumno.id)
      if (vigente && a) setControlDe({ id: alumno.id, datos: a.control })
    })
    return () => { vigente = false }
  }, [alumno?.id])
  useEffect(() => { if (!local) setLocal(zonaFija || (locales.length > 0 ? locales[0] : '')) }, [locales, zonaFija])
  useEffect(() => {
    const handleClick = e => { if (!e.target.closest('#alumno-search')) setShowSugerencias(false) }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const cargarDatos = async () => {
    try {
      const [pRes, aRes] = await Promise.all([api.get('/productos'), api.get('/alumnos')])
      setProductos(pRes.data); setAlumnos(aRes.data)
      if (offlineHabilitado()) refrescarCopia()
    } catch (err) {
      // Sin internet: lo que quedó guardado en el equipo (con las ventas en cola ya descontadas)
      const copia = offlineHabilitado() && esErrorDeRed(err) ? await leerCopia() : null
      if (copia) { setProductos(copia.productos); setAlumnos(copia.alumnos) }
      else console.error(err)
    } finally { setCargando(false) }
  }
  // Al subir las ventas hechas sin internet, saldos y stock vuelven a venir del servidor
  useEffect(() => {
    const alSincronizar = () => cargarDatos()
    window.addEventListener('koletap:sincronizado', alSincronizar)
    return () => window.removeEventListener('koletap:sincronizado', alSincronizar)
  }, [])

  const cargarVentasHoy = async () => {
    try {
      // Las de hoy (en Argentina) de esta zona: el servidor filtra el día
      const hoy = hoyAR()
      const res = await api.get('/transacciones', { params: { desde: hoy, hasta: hoy, lugar: local, tipo: 'compra', limit: 2000 } })
      setTxsHoy(res.data.data ?? res.data)
    } catch (err) { console.error(err) }
  }

  const total = carrito.reduce((s, i) => s + i.precio * i.qty, 0)
  const totalDesc = Math.round(total * (1 - descPct / 100))
  const productosZona = productos.filter(p => p.local === local)
  // Bloqueos de la familia y alergias del alumno identificado, para pintar cada producto
  const estadoProducto = p => {
    const bloqueo = motivoBloqueo(p, ctrl, carrito)
    const alergias = alergiasDe(p, ctrl)
    return { bloqueo, alergias, apagado: p.stock === 0 || !!bloqueo || (alergias.length > 0 && !!ctrl?.bloquear_alergenos) }
  }

  const handleAbrirCaja = async () => {
    try {
      const c = await abrirCaja(local, fondoCaja)
      showMsg('ok', c?.offline ? `Caja abierta en ${c.local} sin conexión: se registra al volver internet` : `Caja abierta en ${local}`)
    }
    catch (err) { showMsg('error', err.response?.data?.error || 'Error al abrir caja') }
  }

  const handleCerrarCaja = async () => {
    if (!confirm(`¿Cerrar caja? Total del turno: ${fmt(caja?.ventas || 0)}`)) return
    try {
      const r = await cerrarCaja(); setCarrito([]); setAlumno(null); setVistaVentas(false)
      showMsg('ok', r?.sinConexion ? 'Caja cerrada sin conexión: el cierre se registra al volver internet' : 'Caja cerrada')
    }
    catch (err) { showMsg('error', err.response?.data?.error || 'Error al cerrar caja') }
  }

  const addProd = (p, confirmado = false) => {
    if (p.stock <= 0) { showMsg('warn', `Sin stock: ${p.nombre}`); return }
    const motivo = motivoBloqueo(p, ctrl, carrito)
    if (motivo) { showMsg('error', motivo); return }
    const alergias = alergiasDe(p, ctrl)
    if (alergias.length > 0) {
      const nombre = alumno.nombre.split(' ')[0]
      if (ctrl.bloquear_alergenos) { showMsg('error', `ALERGIA A ${nombresAlergenos(alergias).toUpperCase()}: la familia de ${nombre} no permite venderle ${p.nombre}`); return }
      if (!confirmado && !confirmados.includes(p.id)) {
        setAvisoAlergia({
          titulo: `ALERGIA A ${nombresAlergenos(alergias).toUpperCase()}`,
          detalle: `${nombre} es alérgico/a a ${nombresAlergenos(alergias).toLowerCase()} y ${p.nombre} lo contiene.`,
          alConfirmar: () => { setConfirmados(c => [...c, p.id]); addProd(p, true) },
        })
        return
      }
    }
    setCarrito(prev => {
      const ex = prev.find(i => i.id === p.id)
      if (ex && ex.qty >= p.stock) { showMsg('warn', 'Stock máximo'); return prev }
      return ex ? prev.map(i => i.id === p.id ? { ...i, qty: i.qty + 1 } : i) : [...prev, { ...p, qty: 1 }]
    })
  }

  const remProd = id => setCarrito(prev => prev.map(i => i.id === id ? { ...i, qty: i.qty - 1 } : i).filter(i => i.qty > 0))

  // Número único de la venta: si se corta internet a mitad del cobro y la venta
  // pasa a la cola, el servidor la toma una sola vez
  const idVentaRef = useRef(null)
  useEffect(() => { idVentaRef.current = null }, [alumno?.id])

  // Cuánto tarda cada venta (velocidad del recreo): desde el primer producto o
  // el alumno identificado hasta el cobro
  const inicioVentaRef = useRef(null)
  const ventaEnCurso = carrito.length > 0 || !!alumno
  useEffect(() => { inicioVentaRef.current = ventaEnCurso ? (inicioVentaRef.current ?? Date.now()) : null }, [ventaEnCurso])

  const cobrar = async (opciones = {}) => {
    if (!alumno || !caja || procesando) return
    setProcesando(true)
    idVentaRef.current ??= crypto.randomUUID()
    const duracion_ms = msDesde(inicioVentaRef.current)
    if (esCajaLocal(caja)) await sincronizar() // la caja abierta sin internet se crea en el servidor antes de cobrar
    try {
      const res = await api.post('/transacciones/cobrar', {
        alumno_id: alumno.id, empleado_id: sesion.id, caja_id: caja.id,
        items: carrito.map(i => ({ id: i.id, nombre: i.nombre, precio: i.precio, qty: i.qty })),
        lugar: local, descuento: descPct, confirmar_alergias: opciones.confirmarAlergias === true,
        id_venta: idVentaRef.current, duracion_ms,
      }, offlineHabilitado() ? { timeout: 15000 } : undefined) // sin respuesta en 15 s, se vende sin conexión
      idVentaRef.current = null
      setAlumnos(prev => prev.map(a => a.id === res.data.alumno.id ? res.data.alumno : a))
      setProductos(prev => prev.map(p => { const item = carrito.find(i => i.id === p.id); return item ? { ...p, stock: p.stock - item.qty } : p }))
      actualizarVentas(totalDesc)
      setUltimaVenta({ id: res.data.transaccion.id, desc: carrito.map(i => i.nombre).join(', '), monto: totalDesc, items: carrito.map(i => ({ nombre: i.nombre, qty: i.qty })) })
      showMsg('ok', `✓ Cobrado ${fmt(totalDesc)} a ${alumno.nombre}`)
      setVerCobro(false)
      setCarrito([]); setAlumno(null); setDescPct(0); setConfirmados([])
      setTimeout(() => busqRef.current?.focus(), 100)
    } catch (err) {
      const d = err.response?.data
      if (err.response?.status === 409 && d?.requiere_confirmacion) {
        // productos con alérgenos agregados antes de identificar al alumno
        setAvisoAlergia({
          titulo: `ALERGIA A ${nombresAlergenos([...new Set(d.alergias.flatMap(a => a.alergenos))]).toUpperCase()}`,
          detalle: d.error,
          textoConfirmar: 'Cobrar igual',
          alConfirmar: () => cobrar({ confirmarAlergias: true }),
        })
      } else if (offlineHabilitado() && esErrorDeRed(err)) {
        await cobrarSinConexion(opciones, duracion_ms)
      } else showMsg('error', d?.error || 'Error al cobrar')
    } finally { setProcesando(false) }
  }

  // Venta sin internet: se controla con la copia del equipo (saldo, límites,
  // reglas, alergias y el tope por día sin conexión) y queda en la cola
  const cobrarSinConexion = async (opciones = {}, duracion_ms = null) => {
    const copia = await leerCopia()
    const a = copia?.alumnos.find(x => x.id === alumno.id)
    if (!a) { showMsg('error', 'Sin internet y sin datos de este alumno en el equipo: no se puede cobrar'); return }
    const nombre = a.nombre.split(' ')[0]
    if (!a.activo) { showMsg('error', `${a.nombre}: la cuenta está bloqueada`); return }
    const porId = new Map(productos.map(p => [p.id, p]))
    const conAlergia = carrito.filter(i => porId.has(i.id) && alergiasDe(porId.get(i.id), a.control).length > 0)
    if (conAlergia.length > 0) {
      const alergenos = [...new Set(conAlergia.flatMap(i => alergiasDe(porId.get(i.id), a.control)))]
      if (a.control.bloquear_alergenos) { showMsg('error', `${nombre} es alérgico/a: no se puede vender ${conAlergia.map(i => i.nombre).join(', ')}`); return }
      if (!opciones.confirmarAlergias && !conAlergia.every(i => confirmados.includes(i.id))) {
        setAvisoAlergia({
          titulo: `ALERGIA A ${nombresAlergenos(alergenos).toUpperCase()}`,
          detalle: `${nombre} es alérgico/a a ${nombresAlergenos(alergenos).toLowerCase()}: ${conAlergia.map(i => i.nombre).join(', ')}`,
          textoConfirmar: 'Cobrar igual',
          alConfirmar: () => cobrar({ confirmarAlergias: true }),
        })
        return
      }
    }
    const total = totalDesc
    if (Number(a.saldo) < total) { showMsg('error', `Saldo insuficiente (disponible: ${fmt(a.saldo)})`); return }
    if (Number(a.gasto_hoy) + total > Number(a.limite_diario)) { showMsg('error', 'Límite diario excedido'); return }
    if (a.control.limite_semanal != null && Number(a.control.gasto_semana || 0) + total > Number(a.control.limite_semanal)) { showMsg('error', 'Límite semanal excedido'); return }
    const limiteZona = excedeLimiteZona(local, total, a.control)
    if (limiteZona) { showMsg('error', limiteZona); return }
    const tope = Number(copia.tope_offline ?? 5000)
    const yaGastado = await gastadoSinConexionHoy(a.id)
    if (yaGastado + total > tope) {
      showMsg('error', `Sin internet, cada alumno puede gastar hasta ${fmt(tope)} por día${yaGastado ? ` (${nombre} ya gastó ${fmt(yaGastado)})` : ''}`)
      return
    }

    const idVenta = idVentaRef.current
    await encolarVenta({
      id_venta: idVenta, alumno_id: a.id, alumno_nombre: a.nombre, lugar: local,
      items: carrito.map(i => ({ id: i.id, qty: i.qty, nombre: i.nombre, categoria: porId.get(i.id)?.categoria })),
      descuento: descPct, caja_id: caja.id, empleado_id: sesion.id, fecha: new Date().toISOString(), total, duracion_ms,
    })
    idVentaRef.current = null
    setAlumnos(prev => prev.map(x => x.id === a.id ? { ...x, saldo: String(Number(a.saldo) - total), gasto_hoy: String(Number(a.gasto_hoy) + total) } : x))
    setProductos(prev => prev.map(p => { const item = carrito.find(i => i.id === p.id); return item ? { ...p, stock: Math.max(0, p.stock - item.qty) } : p }))
    actualizarVentas(total)
    setUltimaVenta({ offline: true, id_venta: idVenta, alumno_id: a.id, desc: carrito.map(i => i.nombre).join(', '), monto: total, items: carrito.map(i => ({ id: i.id, nombre: i.nombre, qty: i.qty })) })
    showMsg('ok', `✓ Cobrado ${fmt(total)} a ${a.nombre} · sin conexión: se sube sola al volver internet`)
    setVerCobro(false)
    setCarrito([]); setAlumno(null); setDescPct(0); setConfirmados([])
    setTimeout(() => busqRef.current?.focus(), 100)
  }

  const anularUltimaVenta = async () => {
    if (!ultimaVenta || !confirm(`¿Anular la venta de ${fmt(ultimaVenta.monto)}?`)) return
    // Hecha sin internet y todavía sin subir: se saca de la cola y se devuelve todo acá
    if (ultimaVenta.offline && await anularEnCola(ultimaVenta.id_venta)) {
      setAlumnos(prev => prev.map(a => a.id === ultimaVenta.alumno_id ? { ...a, saldo: String(Number(a.saldo) + ultimaVenta.monto), gasto_hoy: String(Math.max(0, Number(a.gasto_hoy) - ultimaVenta.monto)) } : a))
      setProductos(prev => prev.map(p => { const item = ultimaVenta.items?.find(i => i.id === p.id); return item ? { ...p, stock: p.stock + item.qty } : p }))
      actualizarVentas(-ultimaVenta.monto)
      setUltimaVenta(null)
      showMsg('ok', `✓ Venta anulada (no se había subido). Se devolvieron ${fmt(ultimaVenta.monto)}`)
      return
    }
    // ya subida: se anula en el servidor con su número de transacción
    const id = ultimaVenta.offline ? transaccionDeVenta(ultimaVenta.id_venta) : ultimaVenta.id
    if (!id) { showMsg('error', 'No se encontró la venta para anularla. Anulala desde el admin.'); return }
    try {
      const res = await api.delete(`/transacciones/${id}/anular`)
      setAlumnos(prev => prev.map(a => a.id === res.data.alumno.id ? res.data.alumno : a))
      setProductos(prev => prev.map(p => { const item = ultimaVenta.items?.find(i => i.nombre === p.nombre); return item ? { ...p, stock: p.stock + item.qty } : p }))
      actualizarVentas(-ultimaVenta.monto)
      setUltimaVenta(null)
      showMsg('ok', `✓ Venta anulada. Se devolvieron ${fmt(res.data.monto)}`)
    } catch (err) { showMsg('error', err.response?.data?.error || 'Error al anular') }
  }

  const iniciarQR = async () => {
    setEscaneandoQR(true); setErrorQR(null)
    try {
      const { BrowserQRCodeReader } = await import('@zxing/browser')
      const reader = new BrowserQRCodeReader()
      // cámara trasera en celulares/tablets (también en iPhone); en una PC, la que haya
      scannerRef.current = await reader.decodeFromConstraints({ video: { facingMode: { ideal: 'environment' } } }, videoRef.current, (result) => {
        if (result) { identificar(result.getText()); detenerQR() }
      })
    } catch (err) { setErrorQR(err?.name === 'NotAllowedError' ? 'Permití el acceso a la cámara para escanear' : 'No se encontró una cámara'); setEscaneandoQR(false) }
  }

  const detenerQR = () => {
    if (scannerRef.current) { scannerRef.current.stop(); scannerRef.current = null }
    setEscaneandoQR(false)
  }

  // Identificar al alumno con lo que se leyó: QR de la credencial (lector USB
  // o cámara), tarjeta NFC 13,56 MHz o llavero 125 kHz, con cualquier lector.
  // El backend resuelve qué es; el POS no necesita saber qué usa el colegio.
  const identificar = async codigo => {
    // Con la caja cerrada no se puede cobrar: se avisa en vez de ignorar la lectura
    if (!caja) { showMsg('warn', 'Abrí la caja para cobrar con la credencial'); return }
    try {
      const res = await api.get('/alumnos/identificar', { params: { codigo } })
      const encontrado = alumnos.find(a => a.id === res.data.id) || res.data
      if (!encontrado.activo) { showMsg('error', `${encontrado.nombre}: la cuenta está bloqueada`); return }
      setAlumno(encontrado); setBusqAlumno(''); setShowSugerencias(false); setModoEscaneo('manual')
      showMsg('ok', `✓ ${encontrado.nombre}`)
    } catch (err) {
      if (offlineHabilitado() && esErrorDeRed(err)) { await identificarSinConexion(codigo); return }
      showMsg('error', err.response?.data?.error || 'No se pudo leer la credencial')
    }
  }

  const identificarSinConexion = async codigo => {
    const copia = await leerCopia()
    if (!copia) { showMsg('error', 'Sin internet y este equipo todavía no tiene la copia para vender sin conexión'); return }
    const r = await buscarCredencial(codigo, copia.claves)
    const encontrado = r && copia.alumnos.find(a => a.id === r.alumno_id)
    if (!encontrado) { showMsg('error', 'Sin internet: credencial no reconocida (si es nueva, va a andar cuando vuelva la conexión)'); return }
    const nombre = encontrado.nombre.split(' ')[0]
    if (r.medio === 'qr' && encontrado.qr_bloqueado) { showMsg('error', `La familia bloqueó el QR de ${nombre}. Puede pagar con otro medio.`); return }
    if (r.medio === 'tarjeta' && encontrado.tarjeta_bloqueada) { showMsg('error', `La familia bloqueó la tarjeta de ${nombre}. Puede pagar con otro medio.`); return }
    if (!encontrado.activo) { showMsg('error', `${encontrado.nombre}: la cuenta está bloqueada`); return }
    setAlumno(encontrado); setBusqAlumno(''); setShowSugerencias(false); setModoEscaneo('manual')
    showMsg('ok', `✓ ${encontrado.nombre} (sin conexión)`)
  }

  // Producto de esta zona con ese código de barras (o nada)
  const productoPorCodigo = codigo => {
    const c = codigo.replace(/\s+/g, '')
    return productos.find(p => p.local === local && p.codigo_barras && p.codigo_barras === c)
  }

  // Lector (USB o app de escritorio): escucha siempre en esta pantalla, tenga
  // el cursor donde tenga. Un código de barras de un producto lo suma al
  // carrito (cada escaneo, una unidad); cualquier otra cosa es la credencial
  // del alumno. Con la caja cerrada avisa que hay que abrirla.
  const ultimaCredencialRef = useRef({ codigo: null, t: 0 })
  const leerCodigo = codigo => {
    const producto = productoPorCodigo(codigo)
    if (producto) {
      if (!caja) { showMsg('warn', 'Abrí la caja para vender'); return }
      addProd(producto)
      return
    }
    if (!esRepeticion(ultimaCredencialRef, codigo)) identificar(codigo)
  }
  useLectorTarjeta(leerCodigo, true, { repetidaMs: 0 })
  const lectorEscritorio = useLectorEscritorio()

  // NFC del celular/tablet (Chrome en Android): queda escuchando en toda la
  // pantalla de venta, aunque se busque por nombre o con la cámara. Una vez
  // dado el permiso se prende solo al entrar, salvo que el cajero lo apague.
  const nfcAbortRef = useRef(null)
  const [nfcActivo, setNfcActivo] = useState(false)
  const leerNfcRef = useRef(null)
  useEffect(() => { leerNfcRef.current = leerCodigo })
  const detenerNFC = () => { nfcAbortRef.current?.abort(); nfcAbortRef.current = null; setNfcActivo(false) }
  const iniciarNFC = async ({ silencioso = false } = {}) => {
    if (!nfcDisponible()) { if (!silencioso) showMsg('error', 'Este dispositivo no tiene NFC (sólo Chrome en Android). Usá un lector USB.'); return }
    try {
      nfcAbortRef.current?.abort()
      const ctrl = new AbortController()
      nfcAbortRef.current = ctrl
      await escucharNfc(codigo => leerNfcRef.current?.(codigo), ctrl.signal)
      setNfcActivo(true)
    } catch (err) { if (!silencioso) showMsg('error', 'Error al activar NFC: ' + err.message); setNfcActivo(false) }
  }
  const alternarNFC = () => {
    try { localStorage.setItem('pos_nfc_apagado', nfcActivo ? '1' : '') } catch { /* sin almacenamiento */ }
    if (nfcActivo) detenerNFC(); else iniciarNFC()
  }
  useEffect(() => {
    let apagado = false
    try { apagado = localStorage.getItem('pos_nfc_apagado') === '1' } catch { /* sin almacenamiento */ }
    if (nfcDisponible() && !apagado) {
      navigator.permissions?.query({ name: 'nfc' })
        .then(p => { if (p.state === 'granted') iniciarNFC({ silencioso: true }) })
        .catch(() => {})
    }
    return () => nfcAbortRef.current?.abort()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (cargando) return <div style={{ padding: '1rem' }}><SkeletonCards count={6} /></div>

  // pantalla abrir caja
  if (!caja) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
      <div style={{ background: 'var(--bg-card)', borderRadius: 20, padding: '2rem', width: '100%', maxWidth: 400, border: '1px solid var(--border)', boxShadow: 'var(--shadow-md)' }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 6px', color: 'var(--text)' }}>Abrir caja</h2>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '0 0 20px' }}>Seleccioná el local y el fondo inicial</p>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.5px' }}>Local</label>
          {zonaFija ? (
            <div style={{ padding: '14px', border: '2px solid var(--brand)', borderRadius: 'var(--radius)', background: 'var(--brand)', color: 'var(--on-brand)', fontSize: 15, fontWeight: 600, textAlign: 'center' }}>{zonaFija}</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {locales.map(l => (
                <button key={l} onClick={() => setLocal(l)} style={{ padding: '14px', border: `2px solid ${local === l ? 'var(--brand)' : 'var(--border)'}`, borderRadius: 'var(--radius)', background: local === l ? 'var(--brand)' : 'var(--bg-card)', color: local === l ? 'var(--on-brand)' : 'var(--text-secondary)', fontSize: 15, fontWeight: local === l ? 600 : 400, cursor: 'pointer' }}>{l}</button>
              ))}
            </div>
          )}
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.5px' }}>Fondo inicial</label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            {[0, 500, 1000, 2000].map(n => (
              <button key={n} onClick={() => setFondoCaja(String(n))} style={{ flex: 1, padding: '10px', border: `1.5px solid ${fondoCaja == n ? 'var(--brand)' : 'var(--border)'}`, borderRadius: 10, background: fondoCaja == n ? 'var(--brand)' : 'var(--bg-card)', color: fondoCaja == n ? 'var(--on-brand)' : 'var(--text-secondary)', fontSize: 13, cursor: 'pointer' }}>{fmt(n)}</button>
            ))}
          </div>
          <input type="number" value={fondoCaja} onChange={e => setFondoCaja(e.target.value)} placeholder="Otro monto" />
        </div>
        <button onClick={handleAbrirCaja} style={{ width: '100%', padding: '16px', border: 'none', borderRadius: 12, background: 'var(--green)', color: 'var(--on-brand)', fontSize: 16, fontWeight: 600, cursor: 'pointer' }}>Abrir caja</button>
        {msg && <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: 8, fontSize: 13, background: 'var(--red-bg)', color: 'var(--red)' }}>{msg.texto}</div>}
      </div>
    </div>
  )

  // pantalla ventas del turno
  if (vistaVentas) return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <button onClick={() => setVistaVentas(false)} style={{ background: 'none', border: 'none', fontSize: 20, color: 'var(--text-secondary)', cursor: 'pointer' }}>←</button>
        <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0, color: 'var(--text)' }}>Ventas del turno</h2>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'Total cobrado', value: fmt(caja?.ventas || 0), color: 'var(--green)' },
          { label: 'Transacciones', value: caja?.tx_count || 0, color: 'var(--text)' }
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--bg-card)', borderRadius: 12, padding: '1rem', border: '1px solid var(--border)', boxShadow: 'var(--shadow)' }}>
            <p style={{ margin: '0 0 4px', fontSize: 11, color: 'var(--text-secondary)' }}>{s.label}</p>
            <p style={{ margin: 0, fontSize: 22, fontWeight: 600, color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>
      <button onClick={cargarVentasHoy} style={{ width: '100%', padding: '12px', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg-card)', fontSize: 14, color: 'var(--text-secondary)', marginBottom: 12, cursor: 'pointer' }}>Actualizar</button>
      <div style={{ background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden', marginBottom: 16, boxShadow: 'var(--shadow)' }}>
        {txsHoy.length === 0
          ? <p style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14 }}>Sin ventas aún</p>
          : txsHoy.map(t => (
            <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--border-light)' }}>
              <div>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>{t.alumno_nombre}</p>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>{t.descripcion} · {new Date(t.fecha).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</p>
              </div>
              <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{fmt(t.monto)}</span>
            </div>
          ))}
      </div>
      <button onClick={handleCerrarCaja} style={{ width: '100%', padding: '14px', border: 'none', borderRadius: 12, background: 'var(--red)', color: 'var(--on-brand)', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>Cerrar caja</button>
    </div>
  )

  // pantalla principal de venta
  return (
    <div style={movil
      ? { display: 'flex', flexDirection: 'column', height: 'calc(100dvh - 64px)', overflow: 'hidden', margin: '-16px' }
      : { display: 'grid', gridTemplateColumns: `1fr ${ancho < ANCHO_TABLET ? 300 : 340}px`, gap: 0, height: 'calc(100vh - 120px)', overflow: 'hidden', margin: '-24px', borderRadius: 0 }}>
      {avisoAlergia && (
        <div role="alertdialog" aria-modal="true" aria-labelledby="alergia-titulo" style={{ position: 'fixed', inset: 0, background: 'var(--overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '1rem' }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 18, width: '100%', maxWidth: 440, overflow: 'hidden', boxShadow: 'var(--shadow-md)', border: '3px solid var(--red)' }}>
            <div style={{ background: 'var(--red)', color: 'var(--on-brand)', padding: '18px 20px' }}>
              <p id="alergia-titulo" style={{ margin: 0, fontSize: 20, fontWeight: 800, letterSpacing: '.3px' }}>{avisoAlergia.titulo}</p>
            </div>
            <div style={{ padding: '18px 20px' }}>
              <p style={{ margin: '0 0 18px', fontSize: 15, color: 'var(--text)', lineHeight: 1.5 }}>{avisoAlergia.detalle}</p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button autoFocus onClick={() => setAvisoAlergia(null)} style={{ flex: 1, padding: '13px', border: 'none', borderRadius: 10, background: 'var(--brand)', color: 'var(--on-brand)', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>No vender</button>
                <button onClick={() => { const a = avisoAlergia; setAvisoAlergia(null); a.alConfirmar() }} style={{ flex: 1, padding: '13px', border: '1.5px solid var(--red)', borderRadius: 10, background: 'var(--bg-card)', color: 'var(--red)', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>{avisoAlergia.textoConfirmar || 'Vender igual'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* toast */}
      {msg && (
        <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 100, padding: '10px 20px', borderRadius: 10, fontSize: 14, fontWeight: 500, background: msg.tipo === 'ok' ? 'var(--brand)' : msg.tipo === 'warn' ? 'var(--amber)' : 'var(--red)', color: 'var(--on-brand)', boxShadow: 'var(--shadow-md)', whiteSpace: 'nowrap' }}>
          {msg.texto}
        </div>
      )}

      {/* anular última venta */}
      {ultimaVenta && (
        <div style={{ position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)', zIndex: 100, padding: '10px 16px', borderRadius: 10, background: 'var(--bg-card)', boxShadow: 'var(--shadow-md)', display: 'flex', alignItems: 'center', gap: 12, whiteSpace: 'nowrap', border: '1px solid var(--border)' }}>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Última venta: <b style={{ color: 'var(--text)' }}>{fmt(ultimaVenta.monto)}</b>{ultimaVenta.offline && ' · sin conexión'}</span>
          {<button onClick={anularUltimaVenta} style={{ padding: '5px 12px', border: 'none', borderRadius: 7, background: 'var(--red-bg)', color: 'var(--red)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Anular</button>}
          <button onClick={() => setUltimaVenta(null)} style={{ background: 'none', border: 'none', fontSize: 18, color: 'var(--text-secondary)', cursor: 'pointer', padding: '0 2px' }}>×</button>
        </div>
      )}

      {/* panel productos */}
      <div style={{ display: movil && verCobro ? 'none' : 'flex', flex: movil ? 1 : undefined, minHeight: 0, flexDirection: 'column', overflow: 'hidden', borderRight: movil ? 'none' : '1px solid var(--border)' }}>
        <CatalogoVenta
          encabezado={(
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                {zonaFija ? (
                  <div style={{ flex: 1, padding: '10px', border: '2px solid var(--brand)', borderRadius: 10, background: 'var(--brand)', color: 'var(--on-brand)', fontSize: 14, fontWeight: 600, textAlign: 'center' }}>{zonaFija}</div>
                ) : locales.map(l => (
                  <button key={l} onClick={() => { setLocal(l); setCarrito([]); setBusq('') }} style={{ flex: 1, padding: '10px', border: `2px solid ${local === l ? 'var(--brand)' : 'var(--border)'}`, borderRadius: 10, background: local === l ? 'var(--brand)' : 'var(--bg-card)', color: local === l ? 'var(--on-brand)' : 'var(--text-secondary)', fontSize: 14, fontWeight: local === l ? 600 : 400, cursor: 'pointer' }}>{l}</button>
                ))}
                <button onClick={() => { setVistaVentas(true); cargarVentasHoy() }} title="Ver ventas del turno" style={{ padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg-card)', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                </button>
              </div>
          )}
          productos={productosZona}
          carrito={carrito}
          estado={estadoProducto}
          umbral={umbral}
          busq={busq}
          setBusq={setBusq}
          busqRef={busqRef}
          onAgregar={addProd}
          productoPorCodigo={productoPorCodigo}
          masVendidos={masVendidos}
        />
      </div>

      {/* celular: barra de abajo con el carrito; abre la pantalla de cobro */}
      {movil && !verCobro && (
        <button onClick={() => setVerCobro(true)} style={{ display: 'flex', alignItems: 'center', gap: 10, margin: 0, padding: '12px 16px', border: 'none', borderTop: '1px solid var(--border)', background: 'var(--bg-card)', textAlign: 'left', boxShadow: 'var(--shadow-md)' }}>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{alumno ? alumno.nombre : 'Sin alumno: tocá para identificarlo'}</span>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{carrito.reduce((s, i) => s + i.qty, 0)} producto{carrito.reduce((s, i) => s + i.qty, 0) === 1 ? '' : 's'} · {fmt(totalDesc)}</span>
          </span>
          <span style={{ padding: '10px 18px', borderRadius: 'var(--radius)', background: 'var(--brand)', color: 'var(--on-brand)', fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap' }}>{alumno && carrito.length ? 'Cobrar ›' : 'Ver ›'}</span>
        </button>
      )}

      {/* panel derecho (en celular, pantalla de cobro) */}
      <div style={{ display: movil && !verCobro ? 'none' : 'flex', flex: movil ? 1 : undefined, minHeight: 0, flexDirection: 'column', background: 'var(--bg-card)', overflow: 'hidden', borderLeft: movil ? 'none' : '1px solid var(--border)' }}>
        {movil && (
          <button onClick={() => setVerCobro(false)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '12px 14px', border: 'none', borderBottom: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--brand)', fontSize: 14, fontWeight: 600, textAlign: 'left' }}>
            ‹ Seguir agregando productos
          </button>
        )}
        {/* info caja */}
        <div style={{ padding: '8px 14px', background: 'var(--green-bg)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--green)', fontWeight: 500 }}>{caja.local} · {fmt(caja.ventas || 0)}</span>
          <button onClick={handleCerrarCaja} style={{ fontSize: 11, padding: '3px 10px', border: 'none', borderRadius: 6, background: 'var(--red)', color: 'var(--on-brand)', cursor: 'pointer' }}>Cerrar caja</button>
        </div>

        {/* alumno */}
        <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
          {alumno ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--brand-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'var(--brand)', flexShrink: 0 }}>
                  {alumno.nombre.split(' ').slice(0, 2).map(n => n[0]).join('')}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{alumno.nombre}</p>
                  <p style={{ margin: 0, fontSize: 11, color: 'var(--text-secondary)' }}>{alumno.curso}</p>
                </div>
                <button onClick={() => { setAlumno(null); setCarrito([]); setConfirmados([]) }} style={{ background: 'none', border: 'none', fontSize: 20, color: 'var(--text-secondary)', cursor: 'pointer' }}>×</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                <div style={{ background: parseFloat(alumno.saldo) < 200 ? 'var(--red-bg)' : 'var(--green-bg)', borderRadius: 8, padding: '6px 10px' }}>
                  <p style={{ margin: '0 0 1px', fontSize: 10, color: 'var(--text-secondary)' }}>Saldo</p>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: parseFloat(alumno.saldo) < 200 ? 'var(--red)' : 'var(--green)' }}>{fmt(alumno.saldo)}</p>
                </div>
                <div style={{ background: 'var(--bg-subtle)', borderRadius: 8, padding: '6px 10px' }}>
                  <p style={{ margin: '0 0 1px', fontSize: 10, color: 'var(--text-secondary)' }}>Gastado hoy</p>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{fmt(alumno.gasto_hoy)}</p>
                </div>
              </div>
              {ctrl?.alergenos?.length > 0 ? (
                <div style={{ marginTop: 6, padding: '6px 10px', background: 'var(--red-bg)', borderRadius: 7, fontSize: 12, color: 'var(--red)', fontWeight: 600 }}>
                  <Icono nombre="alerta" />Alergia: {nombresAlergenos(ctrl.alergenos)}{ctrl.bloquear_alergenos ? ' · no se puede vender' : ' · confirmar antes de vender'}
                </div>
              ) : alumno.alergias !== 'Ninguna' && (
                <div style={{ marginTop: 6, padding: '6px 10px', background: 'var(--amber-bg)', borderRadius: 7, fontSize: 12, color: 'var(--amber)', fontWeight: 500 }}><Icono nombre="alerta" />Alergia: {alumno.alergias}</div>
              )}
              {ctrl?.resumen?.length > 0 && (
                <div style={{ marginTop: 6, padding: '6px 10px', background: 'var(--bg-subtle)', borderRadius: 7, fontSize: 12, color: 'var(--text-secondary)' }}>
                  <Icono nombre="familia" />Reglas de la familia: {ctrl.resumen.join(' · ')}
                </div>
              )}
              {parseFloat(alumno.saldo) < 0 && (
                <div style={{ marginTop: 6, padding: '6px 10px', background: 'var(--red-bg)', borderRadius: 7, fontSize: 12, color: 'var(--red)', fontWeight: 500 }}>Saldo negativo por una recarga devuelta: no puede comprar hasta que la familia recargue</div>
              )}
            </div>
          ) : (
            <div>
              <div style={{ width: '100%', padding: '12px 14px', border: '2px dashed var(--border)', borderRadius: 12, background: 'var(--bg-subtle)', fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500, marginBottom: 8, textAlign: 'center', boxSizing: 'border-box' }}>
                <Icono nombre="tarjeta" />Pasá la credencial por el lector (QR o tarjeta){nfcDisponible() ? ', tocá NFC' : ''}, escaneá el QR con la cámara o buscá por nombre
                {nfcEnOtroNavegador() && (
                  <div style={{ marginTop: 6, fontSize: 12, fontWeight: 500, color: 'var(--amber)' }}>
                    {instalada()
                      ? <>Esta app se instaló desde un navegador que no lee NFC. Para leer tarjetas con el celular, borrala e instalala desde <b>Chrome</b> (menú ⋮ → Instalar app).</>
                      : <>Para leer tarjetas con el NFC del celular, abrí el POS en <b>Chrome</b>.</>}
                  </div>
                )}
                {lectorEscritorio.disponible && (
                  <div style={{ marginTop: 6, fontSize: 12, fontWeight: 600, color: lectorEscritorio.conectado ? 'var(--green)' : 'var(--amber)' }}>
                    {lectorEscritorio.conectado ? `● Lector listo: ${lectorEscritorio.lectores[0]}` : '● Conectá el lector NFC por USB'}
                  </div>
                )}
              </div>
              <div id="alumno-search">
                <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                  {[{ id: 'manual', label: 'Nombre', icono: 'buscar' }, { id: 'qr', label: 'QR', icono: 'camara' }, ...(nfcDisponible() ? [{ id: 'nfc', label: 'NFC', icono: 'nfc' }] : [])].map(m => {
                    const activo = m.id === 'nfc' ? nfcActivo : modoEscaneo === m.id
                    return (
                      <button key={m.id} aria-pressed={activo} onClick={() => {
                        if (m.id === 'qr') { iniciarQR(); setModoEscaneo('qr') }
                        else if (m.id === 'nfc') alternarNFC()
                        else { detenerQR(); setModoEscaneo('manual') }
                      }} style={{ flex: 1, padding: '8px', border: `1.5px solid ${activo ? 'var(--brand)' : 'var(--border)'}`, borderRadius: 9, background: activo ? 'var(--brand)' : 'var(--bg-card)', color: activo ? 'var(--on-brand)' : 'var(--text-secondary)', fontSize: 12, fontWeight: activo ? 600 : 400, cursor: 'pointer' }}><Icono nombre={m.icono} />{m.label}</button>
                    )
                  })}
                </div>
                <input placeholder="Buscá por nombre o pasá la credencial..." value={busqAlumno}
                  onChange={e => { setBusqAlumno(e.target.value); setShowSugerencias(true) }}
                  onKeyDown={e => { if (e.key === 'Enter' && esCodigo(busqAlumno)) { identificar(busqAlumno.trim()); setBusqAlumno(''); setShowSugerencias(false) } }}
                  onFocus={() => setShowSugerencias(true)} style={{ marginBottom: 6 }} autoFocus />
                {showSugerencias && busqAlumno.length > 1 && !esCodigo(busqAlumno) && (
                  <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: 'var(--shadow-md)', zIndex: 50, maxHeight: 200, overflowY: 'auto', marginBottom: 6 }}>
                    {alumnos.filter(a => a.activo && a.nombre.toLowerCase().includes(busqAlumno.toLowerCase())).map(a => (
                      <button key={a.id} onClick={() => { setAlumno(a); setBusqAlumno(''); setShowSugerencias(false) }}
                        style={{ width: '100%', padding: '10px 14px', border: 'none', borderBottom: '1px solid var(--border-light)', background: 'var(--bg-card)', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--bg-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', flexShrink: 0 }}>
                          {a.nombre.split(' ').slice(0, 2).map(n => n[0]).join('')}
                        </div>
                        <div style={{ flex: 1 }}>
                          <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{a.nombre}</p>
                          <p style={{ margin: 0, fontSize: 11, color: 'var(--text-secondary)' }}>{a.curso}</p>
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 600, color: parseFloat(a.saldo) < 200 ? 'var(--red)' : 'var(--green)' }}>{fmt(a.saldo)}</span>
                      </button>
                    ))}
                    {alumnos.filter(a => a.activo && a.nombre.toLowerCase().includes(busqAlumno.toLowerCase())).length === 0 && (
                      <p style={{ padding: '12px 14px', color: 'var(--text-secondary)', fontSize: 13, margin: 0 }}>Sin resultados</p>
                    )}
                  </div>
                )}
                {escaneandoQR && (
                  <div style={{ position: 'relative', marginBottom: 6 }}>
                    <video ref={videoRef} style={{ width: '100%', borderRadius: 10, maxHeight: 200, objectFit: 'cover' }} />
                    <button onClick={detenerQR} style={{ position: 'absolute', top: 8, right: 8, background: 'var(--overlay)', border: 'none', borderRadius: 6, color: 'white', fontSize: 12, padding: '4px 10px', cursor: 'pointer' }}>Cancelar</button>
                  </div>
                )}
                {errorQR && <p style={{ fontSize: 12, color: 'var(--red)', margin: '0 0 6px' }}>{errorQR}</p>}
                {nfcActivo && (
                  <div style={{ padding: '10px 14px', background: 'var(--green-bg)', borderRadius: 8, fontSize: 13, color: 'var(--green)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green)' }} />
                    NFC activo — acercá la tarjeta del alumno
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* carrito */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px' }}>
          {carrito.length === 0
            ? <p style={{ color: 'var(--border)', fontSize: 13, textAlign: 'center', marginTop: 16 }}>Sin productos</p>
            : carrito.map(i => (
              <div key={i.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 0', borderBottom: '1px solid var(--border-light)' }}>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{i.nombre}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <button onClick={() => remProd(i.id)} style={{ width: 24, height: 24, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-card)', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', cursor: 'pointer' }}>−</button>
                  <span style={{ fontSize: 13, fontWeight: 600, minWidth: 16, textAlign: 'center', color: 'var(--text)' }}>{i.qty}</span>
                  <button onClick={() => addProd(i)} style={{ width: 24, height: 24, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-card)', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', cursor: 'pointer' }}>+</button>
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, minWidth: 60, textAlign: 'right', color: 'var(--text)' }}>{fmt(i.precio * i.qty)}</span>
              </div>
            ))}
        </div>

        {/* total y cobrar */}
        <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border)' }}>
          {carrito.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Descuento %</span>
              <input type="number" min="0" max="100" value={descPct} onChange={e => setDescPct(Number(e.target.value))} style={{ width: 60, padding: '5px 8px', fontSize: 13 }} />
              {descPct > 0 && <span style={{ fontSize: 11, color: 'var(--green)' }}>−{fmt(total - totalDesc)}</span>}
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>Total</span>
            <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>{fmt(totalDesc)}</span>
          </div>
          <button onClick={() => cobrar({ confirmarAlergias: carrito.some(i => confirmados.includes(i.id)) })} disabled={!alumno || carrito.length === 0 || procesando}
            style={{ width: '100%', padding: '14px', border: 'none', borderRadius: 'var(--radius)', background: !alumno || carrito.length === 0 ? 'var(--bg-subtle)' : 'var(--brand)', color: !alumno || carrito.length === 0 ? 'var(--text-secondary)' : 'var(--on-brand)', fontSize: 15, fontWeight: 700, cursor: !alumno || carrito.length === 0 ? 'not-allowed' : 'pointer' }}>
            {procesando ? 'Procesando...' : 'Cobrar'}
          </button>
        </div>
      </div>
    </div>
  )
}