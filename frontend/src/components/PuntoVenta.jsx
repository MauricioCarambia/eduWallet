import { useState } from 'react'
import api from '../api/axios'

const fmt = n => `$${Number(n).toLocaleString('es-AR')}`

export default function PuntoVenta({ alumnos, setAlumnos, productos, setProductos, sesion, onCobro }) {
  const [local, setLocal] = useState('Kiosco')
  const [alumno, setAlumno] = useState(null)
  const [carrito, setCarrito] = useState([])
  const [scanning, setScanning] = useState(false)
  const [msg, setMsg] = useState(null)
  const [busq, setBusq] = useState('')
  const [descPct, setDescPct] = useState(0)
  const [caja, setCaja] = useState(null)
  const [subTab, setSubTab] = useState('venta')
  const [fondoCaja, setFondoCaja] = useState('500')

  const total = carrito.reduce((s, i) => s + i.precio * i.qty, 0)
  const totalDesc = Math.round(total * (1 - descPct / 100))

  const showMsg = (tipo, texto) => {
    setMsg({ tipo, texto })
    setTimeout(() => setMsg(null), 3500)
  }

  const simularScan = () => {
    if (!caja) { showMsg('error', 'Debés abrir caja antes de cobrar'); return }
    setScanning(true)
    setTimeout(() => {
      const activos = alumnos.filter(a => a.activo)
      setAlumno(activos[Math.floor(Math.random() * activos.length)])
      setScanning(false)
    }, 1200)
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
    if (!alumno || !caja) return
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
      // actualizar ventas de la caja localmente
      setCaja(prev => ({ ...prev, ventas: (parseFloat(prev.ventas) || 0) + totalDesc }))
      showMsg('ok', `✓ Cobrado ${fmt(totalDesc)} a ${alumno.nombre}`)
      setCarrito([]); setAlumno(null); setDescPct(0)
      onCobro()
    } catch (err) {
      showMsg('error', err.response?.data?.error || 'Error al cobrar')
    }
  }

  const abrirCaja = async () => {
    try {
      const res = await api.post('/cajas', {
        empleado_id: sesion.id,
        local,
        fondo: parseInt(fondoCaja) || 0
      })
      setCaja(res.data)
      showMsg('ok', `Caja abierta en ${local}`)
      setSubTab('venta')
    } catch (err) {
      showMsg('error', 'Error al abrir caja')
    }
  }

  const cerrarCaja = async () => {
    try {
      await api.patch(`/cajas/${caja.id}/cerrar`)
      showMsg('ok', `Caja cerrada. Total del turno: ${fmt(caja.ventas)}`)
      setCaja(null)
    } catch (err) {
      showMsg('error', 'Error al cerrar caja')
    }
  }

  const prods = productos.filter(p => p.local === local && p.nombre.toLowerCase().includes(busq.toLowerCase()))

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 10, background: caja ? '#EAF3DE' : '#FCEBEB', border: `1px solid ${caja ? '#9FE1CB' : '#F7C1C1'}` }}>
        <span style={{ fontSize: 12, color: caja ? '#3B6D11' : '#A32D2D', fontWeight: 500 }}>
          {caja ? `Caja abierta — ${caja.local} · Ventas: ${fmt(caja.ventas || 0)}` : 'Sin caja abierta'}
        </span>
        {caja && <button onClick={cerrarCaja} style={{ fontSize: 11, padding: '3px 10px', border: 'none', borderRadius: 6, background: '#A32D2D', color: 'white', cursor: 'pointer' }}>Cerrar caja</button>}
      </div>

      <div style={{ display: 'flex', gap: 4 }}>
        {['venta', 'abrir caja'].map(t => (
          <button key={t} onClick={() => setSubTab(t)} style={{ padding: '5px 12px', border: `1px solid ${subTab === t ? '#185FA5' : '#ddd'}`, borderRadius: 7, cursor: 'pointer', fontSize: 12, background: subTab === t ? '#E6F1FB' : '#f5f5f5', color: subTab === t ? '#185FA5' : '#666', textTransform: 'capitalize' }}>{t}</button>
        ))}
      </div>

      {msg && <div style={{ padding: '8px 12px', borderRadius: 8, fontSize: 13, background: msg.tipo === 'ok' ? '#EAF3DE' : msg.tipo === 'warn' ? '#FAEEDA' : '#FCEBEB', color: msg.tipo === 'ok' ? '#3B6D11' : msg.tipo === 'warn' ? '#854F0B' : '#A32D2D' }}>{msg.texto}</div>}

      {subTab === 'abrir caja' && (
        <div style={{ background: 'white', border: '1px solid #eee', borderRadius: 12, padding: '1rem', maxWidth: 340 }}>
          <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 500 }}>Abrir caja</p>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            {['Kiosco', 'Librería'].map(l => (
              <button key={l} onClick={() => setLocal(l)} style={{ flex: 1, padding: '6px', border: `1px solid ${local === l ? '#185FA5' : '#ddd'}`, borderRadius: 8, cursor: 'pointer', fontSize: 13, background: local === l ? '#E6F1FB' : '#f5f5f5', color: local === l ? '#185FA5' : '#666' }}>{l}</button>
            ))}
          </div>
          <input type="number" placeholder="Fondo de caja inicial" value={fondoCaja} onChange={e => setFondoCaja(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', marginBottom: 8, padding: '7px 10px', border: '1px solid #ddd', borderRadius: 8 }} />
          <button onClick={abrirCaja} style={{ width: '100%', padding: '8px', border: 'none', borderRadius: 8, background: '#3B6D11', color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>Abrir caja</button>
        </div>
      )}

      {subTab === 'venta' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={{ background: 'white', border: '1px solid #eee', borderRadius: 12, padding: '1rem' }}>
              <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 500, color: '#666', textTransform: 'uppercase' }}>Local</p>
              <div style={{ display: 'flex', gap: 6 }}>
                {['Kiosco', 'Librería'].map(l => (
                  <button key={l} onClick={() => { setLocal(l); setCarrito([]) }} style={{ flex: 1, padding: '6px', border: `1px solid ${local === l ? '#185FA5' : '#ddd'}`, borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: local === l ? 500 : 400, background: local === l ? '#E6F1FB' : '#f5f5f5', color: local === l ? '#185FA5' : '#666' }}>{l}</button>
                ))}
              </div>
            </div>

            <div style={{ background: 'white', border: '1px solid #eee', borderRadius: 12, padding: '1rem' }}>
              <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 500, color: '#666', textTransform: 'uppercase' }}>Alumno</p>
              {alumno ? (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#E6F1FB', color: '#185FA5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 500, fontSize: 13 }}>
                      {alumno.nombre.split(' ').slice(0, 2).map(n => n[0]).join('')}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 500 }}>{alumno.nombre}</p>
                      <p style={{ margin: 0, fontSize: 12, color: '#666' }}>{alumno.curso}</p>
                    </div>
                    <button onClick={() => { setAlumno(null); setCarrito([]) }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#999' }}>×</button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    <div style={{ background: parseFloat(alumno.saldo) > 100 ? '#EAF3DE' : '#FCEBEB', borderRadius: 8, padding: '6px 10px' }}>
                      <p style={{ margin: 0, fontSize: 10, color: '#666' }}>Saldo</p>
                      <p style={{ margin: 0, fontSize: 15, fontWeight: 500, color: parseFloat(alumno.saldo) > 100 ? '#3B6D11' : '#A32D2D' }}>{fmt(alumno.saldo)}</p>
                    </div>
                    <div style={{ background: '#f5f5f5', borderRadius: 8, padding: '6px 10px' }}>
                      <p style={{ margin: 0, fontSize: 10, color: '#666' }}>Gastado hoy</p>
                      <p style={{ margin: 0, fontSize: 15, fontWeight: 500 }}>{fmt(alumno.gasto_hoy)}</p>
                    </div>
                  </div>
                  {alumno.alergias !== 'Ninguna' && <div style={{ marginTop: 8, padding: '5px 10px', background: '#FAEEDA', borderRadius: 8, fontSize: 12, color: '#854F0B' }}>⚠ Alergia: {alumno.alergias}</div>}
                </div>
              ) : (
                <button onClick={simularScan} disabled={scanning} style={{ width: '100%', padding: '14px', border: '1px dashed #ccc', borderRadius: 8, cursor: 'pointer', fontSize: 13, background: '#f5f5f5', color: '#666' }}>
                  {scanning ? 'Leyendo NFC...' : 'Acercar tarjeta NFC / QR'}
                </button>
              )}
            </div>

            <div style={{ background: 'white', border: '1px solid #eee', borderRadius: 12, padding: '1rem' }}>
              <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 500, color: '#666', textTransform: 'uppercase' }}>Carrito</p>
              {carrito.length === 0 ? <p style={{ fontSize: 13, color: '#aaa', margin: 0 }}>Sin productos</p> : (
                <>
                  {carrito.map(i => (
                    <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid #f0f0f0' }}>
                      <span style={{ fontSize: 13, flex: 1 }}>{i.nombre}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <button onClick={() => remProd(i.id)} style={{ width: 20, height: 20, border: '1px solid #ddd', borderRadius: 4, cursor: 'pointer', fontSize: 13, background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                        <span style={{ fontSize: 12, minWidth: 14, textAlign: 'center' }}>{i.qty}</span>
                        <button onClick={() => addProd(i)} style={{ width: 20, height: 20, border: '1px solid #ddd', borderRadius: 4, cursor: 'pointer', fontSize: 13, background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                        <span style={{ fontSize: 12, fontWeight: 500, minWidth: 55, textAlign: 'right' }}>{fmt(i.precio * i.qty)}</span>
                      </div>
                    </div>
                  ))}
                  <div style={{ marginTop: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 12, color: '#666' }}>Descuento %</span>
                      <input type="number" min="0" max="100" value={descPct} onChange={e => setDescPct(Number(e.target.value))} style={{ width: 55, padding: '4px 6px', border: '1px solid #ddd', borderRadius: 6 }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 500 }}>Total</span>
                      <span style={{ fontSize: 14, fontWeight: 500 }}>{fmt(totalDesc)}</span>
                    </div>
                    <button onClick={cobrar} disabled={!alumno || !caja} style={{ width: '100%', padding: '8px', border: 'none', borderRadius: 8, background: alumno && caja ? '#185FA5' : '#f0f0f0', color: alumno && caja ? 'white' : '#aaa', cursor: alumno && caja ? 'pointer' : 'not-allowed', fontSize: 13, fontWeight: 500 }}>Cobrar</button>
                  </div>
                </>
              )}
            </div>
          </div>

          <div style={{ background: 'white', border: '1px solid #eee', borderRadius: 12, padding: '1rem' }}>
            <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 500, color: '#666', textTransform: 'uppercase' }}>Productos — {local}</p>
            <input placeholder="Buscar..." value={busq} onChange={e => setBusq(e.target.value)} style={{ width: '100%', marginBottom: 8, boxSizing: 'border-box', padding: '6px 10px', border: '1px solid #ddd', borderRadius: 8, fontSize: 12 }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, maxHeight: 420, overflowY: 'auto' }}>
              {prods.map(p => (
                <button key={p.id} onClick={() => addProd(p)} style={{ padding: '7px', border: `1px solid ${p.stock === 0 ? '#F7C1C1' : '#eee'}`, borderRadius: 8, cursor: p.stock === 0 ? 'not-allowed' : 'pointer', background: p.stock === 0 ? '#FCEBEB' : '#f9f9f9', textAlign: 'left', opacity: p.stock === 0 ? 0.5 : 1 }}>
                  <p style={{ margin: 0, fontSize: 11 }}>{p.nombre}</p>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 500, color: '#185FA5' }}>{fmt(p.precio)}</p>
                  <p style={{ margin: 0, fontSize: 10, color: p.stock <= 3 ? '#A32D2D' : '#aaa' }}>Stock: {p.stock}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}