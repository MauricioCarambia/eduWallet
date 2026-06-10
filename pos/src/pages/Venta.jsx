import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { useCaja } from '../context/CajaContext'
import api from '../api/axios'

const fmt = n => `$${Number(n).toLocaleString('es-AR')}`

export default function Venta() {
  const { sesion } = useAuth()
  const { caja, abrirCaja, cerrarCaja, actualizarVentas } = useCaja()
  const [productos, setProductos] = useState([])
  const [alumnos, setAlumnos] = useState([])
  const [carrito, setCarrito] = useState([])
  const [alumno, setAlumno] = useState(null)
  const [scanning, setScanning] = useState(false)
  const [busq, setBusq] = useState('')
  const [descPct, setDescPct] = useState(0)
  const [fondoCaja, setFondoCaja] = useState('500')
  const [local, setLocal] = useState('Kiosco')
  const [msg, setMsg] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [procesando, setProcesando] = useState(false)
  const [txsHoy, setTxsHoy] = useState([])
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

  const showMsg = (tipo, texto) => { setMsg({ tipo, texto }); setTimeout(() => setMsg(null), 4000) }

  useEffect(() => { cargarDatos() }, [])
  useEffect(() => {
    const handleClick = e => { if (!e.target.closest('#alumno-search')) setShowSugerencias(false) }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const cargarDatos = async () => {
    try {
      const [pRes, aRes] = await Promise.all([api.get('/productos'), api.get('/alumnos')])
      setProductos(pRes.data); setAlumnos(aRes.data)
    } catch (err) { console.error(err) } finally { setCargando(false) }
  }

  const cargarVentasHoy = async () => {
    try {
      const res = await api.get('/transacciones')
      const hoy = new Date().toISOString().slice(0, 10)
      const data = res.data.data ?? res.data
      setTxsHoy(data.filter(t => t.fecha?.slice(0, 10) === hoy && t.lugar === local && t.tipo === 'compra'))
    } catch (err) { console.error(err) }
  }

  const total = carrito.reduce((s, i) => s + i.precio * i.qty, 0)
  const totalDesc = Math.round(total * (1 - descPct / 100))
  const prods = productos.filter(p => p.local === local && p.nombre.toLowerCase().includes(busq.toLowerCase()))

  const handleAbrirCaja = async () => {
    try { await abrirCaja(local, fondoCaja); showMsg('ok', `Caja abierta en ${local}`) }
    catch (err) { showMsg('error', 'Error al abrir caja') }
  }

  const handleCerrarCaja = async () => {
    if (!confirm(`¿Cerrar caja? Total del turno: ${fmt(caja?.ventas || 0)}`)) return
    try { await cerrarCaja(); setCarrito([]); setAlumno(null); setVistaVentas(false); showMsg('ok', 'Caja cerrada') }
    catch (err) { showMsg('error', 'Error al cerrar caja') }
  }

  const simularScan = () => {
    setScanning(true)
    setTimeout(() => {
      const activos = alumnos.filter(a => a.activo)
      setAlumno(activos[Math.floor(Math.random() * activos.length)])
      setScanning(false)
    }, 1000)
  }

  const addProd = p => {
    if (p.stock <= 0) { showMsg('warn', `Sin stock: ${p.nombre}`); return }
    setCarrito(prev => {
      const ex = prev.find(i => i.id === p.id)
      if (ex && ex.qty >= p.stock) { showMsg('warn', 'Stock máximo'); return prev }
      return ex ? prev.map(i => i.id === p.id ? { ...i, qty: i.qty + 1 } : i) : [...prev, { ...p, qty: 1 }]
    })
  }

  const remProd = id => setCarrito(prev => prev.map(i => i.id === id ? { ...i, qty: i.qty - 1 } : i).filter(i => i.qty > 0))

  const cobrar = async () => {
    if (!alumno || !caja || procesando) return
    setProcesando(true)
    try {
      const res = await api.post('/transacciones/cobrar', {
        alumno_id: alumno.id, empleado_id: sesion.id, caja_id: caja.id,
        items: carrito.map(i => ({ id: i.id, nombre: i.nombre, precio: i.precio, qty: i.qty })),
        lugar: local, descuento: descPct
      })
      setAlumnos(prev => prev.map(a => a.id === res.data.alumno.id ? res.data.alumno : a))
      setProductos(prev => prev.map(p => { const item = carrito.find(i => i.id === p.id); return item ? { ...p, stock: p.stock - item.qty } : p }))
      actualizarVentas(totalDesc)
      setUltimaVenta({ id: res.data.transaccion.id, desc: carrito.map(i => i.nombre).join(', '), monto: totalDesc, items: carrito.map(i => ({ nombre: i.nombre, qty: i.qty })) })
      showMsg('ok', `✓ Cobrado ${fmt(totalDesc)} a ${alumno.nombre}`)
      setCarrito([]); setAlumno(null); setDescPct(0)
      setTimeout(() => busqRef.current?.focus(), 100)
    } catch (err) {
      showMsg('error', err.response?.data?.error || 'Error al cobrar')
    } finally { setProcesando(false) }
  }

  const anularUltimaVenta = async () => {
    if (!ultimaVenta || !confirm(`¿Anular la venta de ${fmt(ultimaVenta.monto)}?`)) return
    try {
      const res = await api.delete(`/transacciones/${ultimaVenta.id}/anular`)
      setAlumnos(prev => prev.map(a => a.id === res.data.alumno.id ? res.data.alumno : a))
      setProductos(prev => prev.map(p => { const item = ultimaVenta.items?.find(i => i.nombre === p.nombre); return item ? { ...p, stock: p.stock + item.qty } : p }))
      actualizarVentas(-ultimaVenta.monto)
      setUltimaVenta(null)
      showMsg('ok', `✓ Venta anulada. Se devolvieron ${fmt(res.data.monto)}`)
    } catch (err) { showMsg('error', err.response?.data?.error || 'Error al anular') }
  }

  const buscarPorCodigo = codigo => {
    const encontrado = alumnos.find(a => a.qr === codigo.trim())
    if (encontrado) { setAlumno(encontrado); setModoEscaneo('manual'); setEscaneandoQR(false); showMsg('ok', `✓ ${encontrado.nombre}`) }
    else showMsg('error', `Código no reconocido: ${codigo}`)
  }

  const iniciarQR = async () => {
    setEscaneandoQR(true); setErrorQR(null)
    try {
      const { BrowserQRCodeReader } = await import('@zxing/browser')
      const reader = new BrowserQRCodeReader()
      scannerRef.current = reader
      const devices = await BrowserQRCodeReader.listVideoInputDevices()
      if (devices.length === 0) { setErrorQR('No se encontró cámara'); setEscaneandoQR(false); return }
      await reader.decodeFromVideoDevice(devices[devices.length - 1].deviceId, videoRef.current, (result) => {
        if (result) { buscarPorCodigo(result.getText()); detenerQR() }
      })
    } catch (err) { setErrorQR('Error al acceder a la cámara'); setEscaneandoQR(false) }
  }

  const detenerQR = () => {
    if (scannerRef.current) { scannerRef.current.reset(); scannerRef.current = null }
    setEscaneandoQR(false)
  }

  const iniciarNFC = async () => {
    if (!('NDEFReader' in window)) { showMsg('error', 'NFC no disponible en este dispositivo'); return }
    try {
      setModoEscaneo('nfc')
      const ndef = new window.NDEFReader()
      await ndef.scan()
      showMsg('ok', 'NFC activo — acercá la tarjeta')
      ndef.onreading = ({ serialNumber }) => {
        buscarPorCodigo('NFC-' + serialNumber.replace(/:/g, '').toUpperCase())
        setModoEscaneo('manual')
      }
    } catch (err) { showMsg('error', 'Error al activar NFC: ' + err.message); setModoEscaneo('manual') }
  }

  if (cargando) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80vh', color: 'var(--text-tertiary)', fontSize: 14 }}>Cargando...</div>

  // pantalla abrir caja
  if (!caja) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
      <div style={{ background: 'var(--bg-card)', borderRadius: 20, padding: '2rem', width: '100%', maxWidth: 400, border: '1px solid var(--border)', boxShadow: 'var(--shadow-md)' }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 6px', color: 'var(--text)' }}>Abrir caja</h2>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '0 0 20px' }}>Seleccioná el local y el fondo inicial</p>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.5px' }}>Local</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {['Kiosco', 'Librería'].map(l => (
              <button key={l} onClick={() => setLocal(l)} style={{ padding: '14px', border: `2px solid ${local === l ? 'var(--brand)' : 'var(--border)'}`, borderRadius: 12, background: local === l ? 'var(--brand)' : 'var(--bg-card)', color: local === l ? 'white' : 'var(--text-secondary)', fontSize: 15, fontWeight: local === l ? 600 : 400, cursor: 'pointer' }}>{l}</button>
            ))}
          </div>
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.5px' }}>Fondo inicial</label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            {[500, 1000, 2000].map(n => (
              <button key={n} onClick={() => setFondoCaja(String(n))} style={{ flex: 1, padding: '10px', border: `1.5px solid ${fondoCaja == n ? 'var(--brand)' : 'var(--border)'}`, borderRadius: 10, background: fondoCaja == n ? 'var(--brand)' : 'var(--bg-card)', color: fondoCaja == n ? 'white' : 'var(--text-secondary)', fontSize: 13, cursor: 'pointer' }}>{fmt(n)}</button>
            ))}
          </div>
          <input type="number" value={fondoCaja} onChange={e => setFondoCaja(e.target.value)} placeholder="Otro monto" />
        </div>
        <button onClick={handleAbrirCaja} style={{ width: '100%', padding: '16px', border: 'none', borderRadius: 12, background: 'var(--green)', color: 'white', fontSize: 16, fontWeight: 600, cursor: 'pointer' }}>Abrir caja</button>
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
            <p style={{ margin: '0 0 4px', fontSize: 11, color: 'var(--text-tertiary)' }}>{s.label}</p>
            <p style={{ margin: 0, fontSize: 22, fontWeight: 600, color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>
      <button onClick={cargarVentasHoy} style={{ width: '100%', padding: '12px', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg-card)', fontSize: 14, color: 'var(--text-secondary)', marginBottom: 12, cursor: 'pointer' }}>Actualizar</button>
      <div style={{ background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden', marginBottom: 16, boxShadow: 'var(--shadow)' }}>
        {txsHoy.length === 0
          ? <p style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 14 }}>Sin ventas aún</p>
          : txsHoy.map(t => (
            <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--border-light)' }}>
              <div>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>{t.alumno_nombre}</p>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--text-tertiary)' }}>{t.descripcion} · {new Date(t.fecha).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</p>
              </div>
              <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{fmt(t.monto)}</span>
            </div>
          ))}
      </div>
      <button onClick={handleCerrarCaja} style={{ width: '100%', padding: '14px', border: 'none', borderRadius: 12, background: 'var(--red)', color: 'white', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>Cerrar caja</button>
    </div>
  )

  // pantalla principal de venta
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 0, height: 'calc(100vh - 120px)', overflow: 'hidden', margin: '-24px', borderRadius: 0 }}>
      {/* toast */}
      {msg && (
        <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 100, padding: '10px 20px', borderRadius: 10, fontSize: 14, fontWeight: 500, background: msg.tipo === 'ok' ? 'var(--brand)' : msg.tipo === 'warn' ? 'var(--amber)' : 'var(--red)', color: 'white', boxShadow: 'var(--shadow-md)', whiteSpace: 'nowrap' }}>
          {msg.texto}
        </div>
      )}

      {/* anular última venta */}
      {ultimaVenta && (
        <div style={{ position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)', zIndex: 100, padding: '10px 16px', borderRadius: 10, background: 'var(--bg-card)', boxShadow: 'var(--shadow-md)', display: 'flex', alignItems: 'center', gap: 12, whiteSpace: 'nowrap', border: '1px solid var(--border)' }}>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Última venta: <b style={{ color: 'var(--text)' }}>{fmt(ultimaVenta.monto)}</b></span>
          <button onClick={anularUltimaVenta} style={{ padding: '5px 12px', border: 'none', borderRadius: 7, background: 'var(--red-bg)', color: 'var(--red)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Anular</button>
          <button onClick={() => setUltimaVenta(null)} style={{ background: 'none', border: 'none', fontSize: 18, color: 'var(--text-tertiary)', cursor: 'pointer', padding: '0 2px' }}>×</button>
        </div>
      )}

      {/* panel productos */}
      <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRight: '1px solid var(--border)' }}>
        <div style={{ padding: '12px 16px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            {['Kiosco', 'Librería'].map(l => (
              <button key={l} onClick={() => { setLocal(l); setCarrito([]); setBusq('') }} style={{ flex: 1, padding: '10px', border: `2px solid ${local === l ? 'var(--brand)' : 'var(--border)'}`, borderRadius: 10, background: local === l ? 'var(--brand)' : 'var(--bg-card)', color: local === l ? 'white' : 'var(--text-secondary)', fontSize: 14, fontWeight: local === l ? 600 : 400, cursor: 'pointer' }}>{l}</button>
            ))}
            <button onClick={() => { setVistaVentas(true); cargarVentasHoy() }} title="Ver ventas del turno" style={{ padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg-card)', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
            </button>
          </div>
          <input ref={busqRef} placeholder="Buscar producto..." value={busq} onChange={e => setBusq(e.target.value)} />
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10 }}>
            {prods.map(p => (
              <button key={p.id} onClick={() => addProd(p)} disabled={p.stock === 0}
                style={{ padding: '14px 12px', border: `1.5px solid ${p.stock === 0 ? 'var(--red-bg)' : 'var(--border)'}`, borderRadius: 14, background: p.stock === 0 ? 'var(--red-bg)' : 'var(--bg-card)', textAlign: 'left', opacity: p.stock === 0 ? 0.6 : 1, cursor: p.stock === 0 ? 'not-allowed' : 'pointer' }}>
                <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 500, color: 'var(--text)', lineHeight: 1.3 }}>{p.nombre}</p>
                <p style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{fmt(p.precio)}</p>
                <p style={{ margin: 0, fontSize: 11, color: p.stock <= 3 ? 'var(--red)' : 'var(--text-tertiary)' }}>Stock: {p.stock}</p>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* panel derecho */}
      <div style={{ display: 'flex', flexDirection: 'column', background: 'var(--bg-card)', overflow: 'hidden', borderLeft: '1px solid var(--border)' }}>
        {/* info caja */}
        <div style={{ padding: '8px 14px', background: 'var(--green-bg)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--green)', fontWeight: 500 }}>{caja.local} · {fmt(caja.ventas || 0)}</span>
          <button onClick={handleCerrarCaja} style={{ fontSize: 11, padding: '3px 10px', border: 'none', borderRadius: 6, background: 'var(--red)', color: 'white', cursor: 'pointer' }}>Cerrar caja</button>
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
                  <p style={{ margin: 0, fontSize: 11, color: 'var(--text-tertiary)' }}>{alumno.curso}</p>
                </div>
                <button onClick={() => { setAlumno(null); setCarrito([]) }} style={{ background: 'none', border: 'none', fontSize: 20, color: 'var(--text-tertiary)', cursor: 'pointer' }}>×</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                <div style={{ background: parseFloat(alumno.saldo) < 200 ? 'var(--red-bg)' : 'var(--green-bg)', borderRadius: 8, padding: '6px 10px' }}>
                  <p style={{ margin: '0 0 1px', fontSize: 10, color: 'var(--text-secondary)' }}>Saldo</p>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: parseFloat(alumno.saldo) < 200 ? 'var(--red)' : 'var(--green)' }}>{fmt(alumno.saldo)}</p>
                </div>
                <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '6px 10px' }}>
                  <p style={{ margin: '0 0 1px', fontSize: 10, color: 'var(--text-secondary)' }}>Gastado hoy</p>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{fmt(alumno.gasto_hoy)}</p>
                </div>
              </div>
              {alumno.alergias !== 'Ninguna' && (
                <div style={{ marginTop: 6, padding: '6px 10px', background: 'var(--amber-bg)', borderRadius: 7, fontSize: 12, color: 'var(--amber)', fontWeight: 500 }}>⚠ Alergia: {alumno.alergias}</div>
              )}
            </div>
          ) : (
            <div>
              <button onClick={simularScan} disabled={scanning} style={{ width: '100%', padding: '14px', border: '2px dashed var(--border)', borderRadius: 12, background: 'var(--bg)', fontSize: 13, color: 'var(--text-tertiary)', fontWeight: 500, cursor: 'pointer', marginBottom: 8 }}>
                {scanning ? 'Leyendo tarjeta...' : '📲 Acercar tarjeta NFC / QR'}
              </button>
              <div id="alumno-search">
                <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                  {[{ id: 'manual', label: '🔍 Nombre' }, { id: 'qr', label: '📷 QR' }, { id: 'nfc', label: '📶 NFC' }].map(m => (
                    <button key={m.id} onClick={() => {
                      if (m.id === 'qr') { iniciarQR(); setModoEscaneo('qr') }
                      else if (m.id === 'nfc') iniciarNFC()
                      else { detenerQR(); setModoEscaneo('manual') }
                    }} style={{ flex: 1, padding: '8px', border: `1.5px solid ${modoEscaneo === m.id ? 'var(--brand)' : 'var(--border)'}`, borderRadius: 9, background: modoEscaneo === m.id ? 'var(--brand)' : 'var(--bg-card)', color: modoEscaneo === m.id ? 'white' : 'var(--text-secondary)', fontSize: 12, fontWeight: modoEscaneo === m.id ? 600 : 400, cursor: 'pointer' }}>{m.label}</button>
                  ))}
                </div>
                <input placeholder="Escaneá QR o buscá por nombre..." value={busqAlumno}
                  onChange={e => { setBusqAlumno(e.target.value); setShowSugerencias(true) }}
                  onKeyDown={e => { if (e.key === 'Enter' && busqAlumno.startsWith('QR-')) { buscarPorCodigo(busqAlumno); setBusqAlumno(''); setShowSugerencias(false) } }}
                  onFocus={() => setShowSugerencias(true)} style={{ marginBottom: 6 }} autoFocus />
                {showSugerencias && busqAlumno.length > 1 && !busqAlumno.startsWith('QR-') && (
                  <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: 'var(--shadow-md)', zIndex: 50, maxHeight: 200, overflowY: 'auto', marginBottom: 6 }}>
                    {alumnos.filter(a => a.activo && a.nombre.toLowerCase().includes(busqAlumno.toLowerCase())).map(a => (
                      <button key={a.id} onClick={() => { setAlumno(a); setBusqAlumno(''); setShowSugerencias(false) }}
                        style={{ width: '100%', padding: '10px 14px', border: 'none', borderBottom: '1px solid var(--border-light)', background: 'var(--bg-card)', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', flexShrink: 0 }}>
                          {a.nombre.split(' ').slice(0, 2).map(n => n[0]).join('')}
                        </div>
                        <div style={{ flex: 1 }}>
                          <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{a.nombre}</p>
                          <p style={{ margin: 0, fontSize: 11, color: 'var(--text-tertiary)' }}>{a.curso}</p>
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 600, color: parseFloat(a.saldo) < 200 ? 'var(--red)' : 'var(--green)' }}>{fmt(a.saldo)}</span>
                      </button>
                    ))}
                    {alumnos.filter(a => a.activo && a.nombre.toLowerCase().includes(busqAlumno.toLowerCase())).length === 0 && (
                      <p style={{ padding: '12px 14px', color: 'var(--text-tertiary)', fontSize: 13, margin: 0 }}>Sin resultados</p>
                    )}
                  </div>
                )}
                {escaneandoQR && (
                  <div style={{ position: 'relative', marginBottom: 6 }}>
                    <video ref={videoRef} style={{ width: '100%', borderRadius: 10, maxHeight: 200, objectFit: 'cover' }} />
                    <button onClick={detenerQR} style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: 6, color: 'white', fontSize: 12, padding: '4px 10px', cursor: 'pointer' }}>Cancelar</button>
                  </div>
                )}
                {errorQR && <p style={{ fontSize: 12, color: 'var(--red)', margin: '0 0 6px' }}>{errorQR}</p>}
                {modoEscaneo === 'nfc' && (
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
          <button onClick={cobrar} disabled={!alumno || carrito.length === 0 || procesando}
            style={{ width: '100%', padding: '14px', border: 'none', borderRadius: 12, background: !alumno || carrito.length === 0 ? 'var(--bg)' : 'var(--brand)', color: !alumno || carrito.length === 0 ? 'var(--text-tertiary)' : 'white', fontSize: 15, fontWeight: 700, cursor: !alumno || carrito.length === 0 ? 'not-allowed' : 'pointer' }}>
            {procesando ? 'Procesando...' : 'Cobrar'}
          </button>
        </div>
      </div>
    </div>
  )
}