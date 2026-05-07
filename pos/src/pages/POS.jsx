import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import api from '../api/axios'

const fmt = n => `$${Number(n).toLocaleString('es-AR')}`

export default function POS() {
  const { sesion, logout } = useAuth()
  const navigate = useNavigate()
  const [caja, setCaja] = useState(null)
  const [local, setLocal] = useState('Kiosco')
  const [productos, setProductos] = useState([])
  const [alumnos, setAlumnos] = useState([])
  const [carrito, setCarrito] = useState([])
  const [alumno, setAlumno] = useState(null)
  const [scanning, setScanning] = useState(false)
  const [busq, setBusq] = useState('')
  const [descPct, setDescPct] = useState(0)
  const [vista, setVista] = useState('caja') // 'caja' | 'venta' | 'ventas'
  const [fondoCaja, setFondoCaja] = useState('500')
  const [msg, setMsg] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [procesando, setProcesando] = useState(false)
  const busqRef = useRef(null)

  const showMsg = (tipo, texto) => { setMsg({ tipo, texto }); setTimeout(() => setMsg(null), 4000) }

  useEffect(() => { cargarDatos() }, [])

  const cargarDatos = async () => {
    try {
      const [pRes, aRes] = await Promise.all([api.get('/productos'), api.get('/alumnos')])
      setProductos(pRes.data)
      setAlumnos(aRes.data)
    } catch (err) {
      console.error(err)
    } finally {
      setCargando(false)
    }
  }

  const total = carrito.reduce((s, i) => s + i.precio * i.qty, 0)
  const totalDesc = Math.round(total * (1 - descPct / 100))
  const prods = productos.filter(p => p.local === local && p.nombre.toLowerCase().includes(busq.toLowerCase()))
  const [txsHoy, setTxsHoy] = useState([])

  const cargarVentasHoy = async () => {
    try {
      const res = await api.get('/transacciones')
      const hoy = new Date().toISOString().slice(0, 10)
      setTxsHoy(res.data.filter(t => t.fecha?.slice(0, 10) === hoy && t.lugar === local && t.tipo === 'compra'))
    } catch (err) { console.error(err) }
  }

  const abrirCaja = async () => {
    try {
      const res = await api.post('/cajas', { empleado_id: sesion.id, local, fondo: parseInt(fondoCaja) || 0 })
      setCaja(res.data)
      setVista('venta')
      showMsg('ok', `Caja abierta en ${local}`)
    } catch (err) { showMsg('error', 'Error al abrir caja') }
  }

  const cerrarCaja = async () => {
    if (!confirm(`¿Cerrar caja? Total del turno: ${fmt(caja.ventas || 0)}`)) return
    try {
      await api.patch(`/cajas/${caja.id}/cerrar`)
      showMsg('ok', `Caja cerrada. Total: ${fmt(caja.ventas || 0)}`)
      setCaja(null)
      setCarrito([])
      setAlumno(null)
      setVista('caja')
    } catch (err) { showMsg('error', 'Error al cerrar caja') }
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
        alumno_id: alumno.id,
        empleado_id: sesion.id,
        caja_id: caja.id,
        items: carrito.map(i => ({ id: i.id, nombre: i.nombre, precio: i.precio, qty: i.qty })),
        lugar: local,
        descuento: descPct
      })
      setAlumnos(prev => prev.map(a => a.id === res.data.alumno.id ? res.data.alumno : a))
      setProductos(prev => prev.map(p => {
        const item = carrito.find(i => i.id === p.id)
        return item ? { ...p, stock: p.stock - item.qty } : p
      }))
      setCaja(prev => ({ ...prev, ventas: (parseFloat(prev.ventas) || 0) + totalDesc, tx_count: (prev.tx_count || 0) + 1 }))
      showMsg('ok', `✓ Cobrado ${fmt(totalDesc)} a ${alumno.nombre}`)
      setCarrito([])
      setAlumno(null)
      setDescPct(0)
      setTimeout(() => busqRef.current?.focus(), 100)
    } catch (err) {
      showMsg('error', err.response?.data?.error || 'Error al cobrar')
    } finally {
      setProcesando(false)
    }
  }

  const handleLogout = () => { logout(); navigate('/') }

  if (cargando) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#999', fontSize: 14 }}>Cargando...</div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#F8F9FA', display: 'flex', flexDirection: 'column' }}>
      {/* header */}
      <div style={{ background: 'white', borderBottom: '1px solid #F0F0F0', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>EduWallet POS</p>
            <p style={{ margin: 0, fontSize: 11, color: '#999' }}>{sesion.nombre}</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {caja && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ textAlign: 'right' }}>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#16A34A' }}>{fmt(caja.ventas || 0)}</p>
                <p style={{ margin: 0, fontSize: 10, color: '#999' }}>{caja.tx_count || 0} ventas · {local}</p>
              </div>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#16A34A' }} />
            </div>
          )}
          <button onClick={handleLogout} style={{ padding: '6px 12px', border: '1px solid #F0F0F0', borderRadius: 8, background: 'white', fontSize: 12, color: '#666' }}>Salir</button>
        </div>
      </div>

      {/* toast */}
      {msg && (
        <div style={{ position: 'fixed', top: 70, left: '50%', transform: 'translateX(-50%)', zIndex: 100, padding: '10px 20px', borderRadius: 10, fontSize: 14, fontWeight: 500, background: msg.tipo === 'ok' ? '#111' : msg.tipo === 'warn' ? '#D97706' : '#DC2626', color: 'white', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', whiteSpace: 'nowrap' }}>
          {msg.texto}
        </div>
      )}

      {/* pantalla abrir caja */}
      {vista === 'caja' && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
          <div style={{ background: 'white', borderRadius: 20, padding: '2rem', width: '100%', maxWidth: 400, border: '1px solid #F0F0F0', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 6px' }}>Abrir caja</h2>
            <p style={{ fontSize: 14, color: '#999', margin: '0 0 20px' }}>Seleccioná el local y el fondo inicial</p>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#555', marginBottom: 8 }}>Local</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {['Kiosco', 'Librería'].map(l => (
                  <button key={l} onClick={() => setLocal(l)} style={{ padding: '14px', border: `2px solid ${local === l ? '#111' : '#F0F0F0'}`, borderRadius: 12, background: local === l ? '#111' : 'white', color: local === l ? 'white' : '#666', fontSize: 15, fontWeight: local === l ? 600 : 400 }}>{l}</button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#555', marginBottom: 8 }}>Fondo inicial</label>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                {[500, 1000, 2000].map(n => (
                  <button key={n} onClick={() => setFondoCaja(String(n))} style={{ flex: 1, padding: '10px', border: `1.5px solid ${fondoCaja == n ? '#111' : '#F0F0F0'}`, borderRadius: 10, background: fondoCaja == n ? '#111' : 'white', color: fondoCaja == n ? 'white' : '#666', fontSize: 13 }}>{fmt(n)}</button>
                ))}
              </div>
              <input type="number" value={fondoCaja} onChange={e => setFondoCaja(e.target.value)} placeholder="Otro monto" style={{ width: '100%' }} />
            </div>
            <button onClick={abrirCaja} style={{ width: '100%', padding: '16px', border: 'none', borderRadius: 12, background: '#16A34A', color: 'white', fontSize: 16, fontWeight: 600 }}>
              Abrir caja
            </button>
          </div>
        </div>
      )}

      {/* pantalla ventas del día */}
      {vista === 'ventas' && (
        <div style={{ flex: 1, padding: '16px', maxWidth: 600, margin: '0 auto', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <button onClick={() => setVista('venta')} style={{ background: 'none', border: 'none', fontSize: 20, color: '#666', padding: '4px' }}>←</button>
            <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Ventas del turno</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            <div style={{ background: 'white', borderRadius: 12, padding: '1rem', border: '1px solid #F0F0F0' }}>
              <p style={{ margin: '0 0 4px', fontSize: 11, color: '#999' }}>Total cobrado</p>
              <p style={{ margin: 0, fontSize: 22, fontWeight: 600, color: '#16A34A' }}>{fmt(caja?.ventas || 0)}</p>
            </div>
            <div style={{ background: 'white', borderRadius: 12, padding: '1rem', border: '1px solid #F0F0F0' }}>
              <p style={{ margin: '0 0 4px', fontSize: 11, color: '#999' }}>Transacciones</p>
              <p style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>{caja?.tx_count || 0}</p>
            </div>
          </div>
          <button onClick={() => { cargarVentasHoy(); }} style={{ width: '100%', padding: '12px', border: '1px solid #F0F0F0', borderRadius: 10, background: 'white', fontSize: 14, color: '#666', marginBottom: 12 }}>
            Actualizar
          </button>
          <div style={{ background: 'white', borderRadius: 12, border: '1px solid #F0F0F0', overflow: 'hidden' }}>
            {txsHoy.length === 0 ? (
              <p style={{ padding: '2rem', textAlign: 'center', color: '#999', fontSize: 14 }}>Sin ventas aún</p>
            ) : txsHoy.map(t => (
              <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #F8F9FA' }}>
                <div>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 500 }}>{t.alumno_nombre}</p>
                  <p style={{ margin: 0, fontSize: 12, color: '#999' }}>{t.descripcion} · {new Date(t.fecha).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
                <span style={{ fontSize: 15, fontWeight: 600 }}>{fmt(t.monto)}</span>
              </div>
            ))}
          </div>
          <button onClick={cerrarCaja} style={{ width: '100%', marginTop: 16, padding: '14px', border: 'none', borderRadius: 12, background: '#DC2626', color: 'white', fontSize: 15, fontWeight: 600 }}>
            Cerrar caja
          </button>
        </div>
      )}

      {/* pantalla principal de venta */}
      {vista === 'venta' && (
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 340px', gap: 0, overflow: 'hidden', height: 'calc(100vh - 57px)' }}>
          {/* productos */}
          <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRight: '1px solid #F0F0F0' }}>
            {/* selector local + buscar */}
            <div style={{ padding: '12px 16px', background: 'white', borderBottom: '1px solid #F0F0F0' }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                {['Kiosco', 'Librería'].map(l => (
                  <button key={l} onClick={() => { setLocal(l); setCarrito([]); setBusq('') }} style={{ flex: 1, padding: '10px', border: `2px solid ${local === l ? '#111' : '#F0F0F0'}`, borderRadius: 10, background: local === l ? '#111' : 'white', color: local === l ? 'white' : '#666', fontSize: 14, fontWeight: local === l ? 600 : 400 }}>{l}</button>
                ))}
                <button onClick={() => { setVista('ventas'); cargarVentasHoy() }} style={{ padding: '10px 14px', border: '1px solid #F0F0F0', borderRadius: 10, background: 'white', color: '#666', fontSize: 13 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                </button>
              </div>
              <input ref={busqRef} placeholder="Buscar producto..." value={busq} onChange={e => setBusq(e.target.value)} style={{ width: '100%' }} />
            </div>
            {/* grilla productos */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10 }}>
                {prods.map(p => (
                  <button key={p.id} onClick={() => addProd(p)} disabled={p.stock === 0}
                    style={{ padding: '14px 12px', border: `1.5px solid ${p.stock === 0 ? '#FEE2E2' : '#F0F0F0'}`, borderRadius: 14, background: p.stock === 0 ? '#FFF5F5' : 'white', textAlign: 'left', opacity: p.stock === 0 ? 0.6 : 1 }}>
                    <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 500, color: '#111', lineHeight: 1.3 }}>{p.nombre}</p>
                    <p style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700, color: '#111' }}>{fmt(p.precio)}</p>
                    <p style={{ margin: 0, fontSize: 11, color: p.stock <= 3 ? '#DC2626' : '#999' }}>Stock: {p.stock}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* panel derecho */}
          <div style={{ display: 'flex', flexDirection: 'column', background: 'white', overflow: 'hidden' }}>
            {/* alumno */}
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #F0F0F0' }}>
              {alumno ? (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 12, background: '#F8F9FA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#666', flexShrink: 0 }}>
                      {alumno.nombre.split(' ').slice(0, 2).map(n => n[0]).join('')}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{alumno.nombre}</p>
                      <p style={{ margin: 0, fontSize: 12, color: '#999' }}>{alumno.curso}</p>
                    </div>
                    <button onClick={() => { setAlumno(null); setCarrito([]) }} style={{ background: 'none', border: 'none', fontSize: 22, color: '#999', padding: '0 4px' }}>×</button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div style={{ background: parseFloat(alumno.saldo) < 200 ? '#FEF2F2' : '#F0FDF4', borderRadius: 10, padding: '8px 12px' }}>
                      <p style={{ margin: '0 0 2px', fontSize: 10, color: '#666' }}>Saldo</p>
                      <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: parseFloat(alumno.saldo) < 200 ? '#DC2626' : '#16A34A' }}>{fmt(alumno.saldo)}</p>
                    </div>
                    <div style={{ background: '#F8F9FA', borderRadius: 10, padding: '8px 12px' }}>
                      <p style={{ margin: '0 0 2px', fontSize: 10, color: '#666' }}>Gastado hoy</p>
                      <p style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{fmt(alumno.gasto_hoy)}</p>
                    </div>
                  </div>
                  {alumno.alergias !== 'Ninguna' && (
                    <div style={{ marginTop: 8, padding: '7px 12px', background: '#FFF7ED', borderRadius: 8, fontSize: 13, color: '#D97706', fontWeight: 500 }}>⚠ Alergia: {alumno.alergias}</div>
                  )}
                </div>
              ) : (
                <button onClick={simularScan} disabled={scanning}
                  style={{ width: '100%', padding: '20px', border: '2px dashed #E5E7EB', borderRadius: 14, background: '#F8F9FA', fontSize: 14, color: '#999', fontWeight: 500 }}>
                  {scanning ? (
                    <span>Leyendo tarjeta...</span>
                  ) : (
                    <span>📲 Acercar tarjeta NFC / QR</span>
                  )}
                </button>
              )}
            </div>

            {/* carrito */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
              {carrito.length === 0 ? (
                <p style={{ color: '#ccc', fontSize: 14, textAlign: 'center', marginTop: 20 }}>Sin productos</p>
              ) : carrito.map(i => (
                <div key={i.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid #F8F9FA' }}>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{i.nombre}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button onClick={() => remProd(i.id)} style={{ width: 26, height: 26, border: '1px solid #F0F0F0', borderRadius: 7, background: 'white', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}>−</button>
                    <span style={{ fontSize: 14, fontWeight: 600, minWidth: 18, textAlign: 'center' }}>{i.qty}</span>
                    <button onClick={() => addProd(i)} style={{ width: 26, height: 26, border: '1px solid #F0F0F0', borderRadius: 7, background: 'white', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}>+</button>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600, minWidth: 65, textAlign: 'right' }}>{fmt(i.precio * i.qty)}</span>
                </div>
              ))}
            </div>

            {/* total y cobrar */}
            <div style={{ padding: '14px 16px', borderTop: '1px solid #F0F0F0' }}>
              {carrito.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <span style={{ fontSize: 13, color: '#999' }}>Descuento %</span>
                  <input type="number" min="0" max="100" value={descPct} onChange={e => setDescPct(Number(e.target.value))} style={{ width: 70, padding: '6px 10px', fontSize: 13 }} />
                  {descPct > 0 && <span style={{ fontSize: 12, color: '#16A34A' }}>−{fmt(total - totalDesc)}</span>}
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: 16, fontWeight: 600 }}>Total</span>
                <span style={{ fontSize: 24, fontWeight: 700 }}>{fmt(totalDesc)}</span>
              </div>
              <button onClick={cobrar} disabled={!alumno || carrito.length === 0 || procesando}
                style={{ width: '100%', padding: '16px', border: 'none', borderRadius: 14, background: !alumno || carrito.length === 0 ? '#F0F0F0' : '#111', color: !alumno || carrito.length === 0 ? '#999' : 'white', fontSize: 16, fontWeight: 700, cursor: !alumno || carrito.length === 0 ? 'not-allowed' : 'pointer' }}>
                {procesando ? 'Procesando...' : 'Cobrar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}