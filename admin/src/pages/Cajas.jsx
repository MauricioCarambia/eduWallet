import { useState, useEffect } from 'react'
import api from '../api/axios'

const fmt = n => `$${Number(n).toLocaleString('es-AR')}`

function Modal({ title, onClose, children }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
      <div style={{ background: 'white', borderRadius: 16, padding: '1.5rem', width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, color: '#999', lineHeight: 1 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

export default function Cajas() {
  const [cajas, setCajas] = useState([])
  const [txs, setTxs] = useState([])
  const [cargando, setCargando] = useState(true)
  const [seleccionada, setSeleccionada] = useState(null)
  const [filtroLocal, setFiltroLocal] = useState('Todos')
  const [filtroEstado, setFiltroEstado] = useState('Todos')
  const [msg, setMsg] = useState(null)

  const showMsg = (tipo, texto) => { setMsg({ tipo, texto }); setTimeout(() => setMsg(null), 3000) }

  useEffect(() => { cargar() }, [])

  const cargar = async () => {
    try {
      const [cRes, tRes] = await Promise.all([api.get('/cajas'), api.get('/transacciones')])
      setCajas(cRes.data)
      setTxs(tRes.data)
    } catch (err) {
      console.error(err)
    } finally {
      setCargando(false)
    }
  }

  const cerrarCaja = async id => {
    if (!confirm('¿Cerrar esta caja?')) return
    try {
      await api.patch(`/cajas/${id}/cerrar`)
      setCajas(prev => prev.map(c => c.id === id ? { ...c, abierta: false, cierre: new Date().toISOString() } : c))
      showMsg('ok', 'Caja cerrada correctamente')
    } catch (err) { showMsg('error', 'Error al cerrar caja') }
  }

  const cajasFiltradas = cajas.filter(c =>
    (filtroLocal === 'Todos' || c.local === filtroLocal) &&
    (filtroEstado === 'Todos' || (filtroEstado === 'Abiertas' ? c.abierta : !c.abierta))
  )

  const cajasAbiertas = cajas.filter(c => c.abierta)
  const totalVentasHoy = cajas
    .filter(c => c.apertura?.slice(0, 10) === new Date().toISOString().slice(0, 10))
    .reduce((s, c) => s + parseFloat(c.ventas || 0), 0)
  const totalTurnos = cajas.length

  const txsCaja = seleccionada ? txs.filter(t => {
    const cajaInicio = new Date(seleccionada.apertura)
    const cajaFin = seleccionada.cierre ? new Date(seleccionada.cierre) : new Date()
    const txFecha = new Date(t.fecha)
    return t.lugar === seleccionada.local && txFecha >= cajaInicio && txFecha <= cajaFin
  }) : []

  if (cargando) return <div style={{ color: '#999' }}>Cargando...</div>

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, margin: '0 0 4px' }}>Cajas</h1>
        <p style={{ color: '#999', fontSize: 13, margin: 0 }}>Historial de turnos y cajas</p>
      </div>

      {msg && <div style={{ padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16, background: msg.tipo === 'ok' ? '#F0FDF4' : '#FEF2F2', color: msg.tipo === 'ok' ? '#16A34A' : '#DC2626' }}>{msg.texto}</div>}

      {/* stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Cajas abiertas', value: cajasAbiertas.length, color: cajasAbiertas.length > 0 ? '#16A34A' : '#111' },
          { label: 'Ventas de hoy', value: fmt(totalVentasHoy) },
          { label: 'Total de turnos', value: totalTurnos },
        ].map(s => (
          <div key={s.label} style={{ background: 'white', borderRadius: 12, padding: '1rem', border: '1px solid #F0F0F0' }}>
            <p style={{ margin: '0 0 4px', fontSize: 11, color: '#999', fontWeight: 500 }}>{s.label}</p>
            <p style={{ margin: 0, fontSize: 22, fontWeight: 600, color: s.color || '#111' }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* cajas abiertas ahora */}
      {cajasAbiertas.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 10px', color: '#16A34A' }}>Cajas abiertas ahora</h2>
          <div style={{ display: 'grid', gap: 8 }}>
            {cajasAbiertas.map(c => (
              <div key={c.id} style={{ background: '#F0FDF4', borderRadius: 12, padding: '1rem', border: '1px solid #BBF7D0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <p style={{ margin: '0 0 2px', fontSize: 14, fontWeight: 500 }}>{c.local} — {c.empleado_nombre}</p>
                  <p style={{ margin: 0, fontSize: 12, color: '#166534' }}>Apertura: {new Date(c.apertura).toLocaleString('es-AR')} · Fondo: {fmt(c.fondo)} · {c.tx_count} transacciones</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <p style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#166534' }}>{fmt(c.ventas)}</p>
                  <button onClick={() => cerrarCaja(c.id)} style={{ padding: '6px 14px', border: 'none', borderRadius: 8, background: '#DC2626', color: 'white', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>Cerrar caja</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* filtros */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {[['Todos', 'Kiosco', 'Librería'].map(l => ({ label: l, val: l, key: 'local' })),
          ['Todos', 'Abiertas', 'Cerradas'].map(e => ({ label: e, val: e, key: 'estado' }))
        ].flat().map(f => (
          <button key={f.label + f.key} onClick={() => f.key === 'local' ? setFiltroLocal(f.val) : setFiltroEstado(f.val)}
            style={{ padding: '5px 12px', border: `1px solid ${(f.key === 'local' ? filtroLocal : filtroEstado) === f.val ? '#111' : '#F0F0F0'}`, borderRadius: 7, background: (f.key === 'local' ? filtroLocal : filtroEstado) === f.val ? '#111' : 'white', color: (f.key === 'local' ? filtroLocal : filtroEstado) === f.val ? 'white' : '#666', fontSize: 12, cursor: 'pointer' }}>
            {f.label}
          </button>
        ))}
      </div>

      {/* lista de cajas */}
      <div style={{ display: 'grid', gap: 8 }}>
        {cajasFiltradas.map(c => (
          <div key={c.id} style={{ background: 'white', borderRadius: 12, padding: '1rem 1.25rem', border: '1px solid #F0F0F0', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: c.abierta ? '#F0FDF4' : '#F8F9FA', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c.abierta ? '#16A34A' : '#999'} strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>
            </div>
            <div style={{ flex: 1, minWidth: 150 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 500 }}>{c.local}</p>
                <span style={{ fontSize: 10, fontWeight: 500, padding: '2px 7px', borderRadius: 6, background: c.abierta ? '#F0FDF4' : '#F8F9FA', color: c.abierta ? '#16A34A' : '#999' }}>{c.abierta ? 'Abierta' : 'Cerrada'}</span>
              </div>
              <p style={{ margin: 0, fontSize: 12, color: '#999' }}>
                {c.empleado_nombre} · Apertura: {new Date(c.apertura).toLocaleString('es-AR')}
                {c.cierre && ` · Cierre: ${new Date(c.cierre).toLocaleString('es-AR')}`}
              </p>
              <p style={{ margin: 0, fontSize: 12, color: '#999' }}>Fondo: {fmt(c.fondo)} · {c.tx_count} transacciones</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{fmt(c.ventas)}</p>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => setSeleccionada(c)} style={{ padding: '5px 12px', border: '1px solid #F0F0F0', borderRadius: 7, background: 'white', fontSize: 12, cursor: 'pointer', color: '#666' }}>Ver detalle</button>
                {c.abierta && <button onClick={() => cerrarCaja(c.id)} style={{ padding: '5px 12px', border: 'none', borderRadius: 7, background: '#FEF2F2', color: '#DC2626', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>Cerrar</button>}
              </div>
            </div>
          </div>
        ))}
        {cajasFiltradas.length === 0 && <p style={{ textAlign: 'center', color: '#999', fontSize: 13, padding: '2rem' }}>Sin cajas registradas</p>}
      </div>

      {/* modal detalle */}
      {seleccionada && (
        <Modal title={`Detalle de caja — ${seleccionada.local}`} onClose={() => setSeleccionada(null)}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
            {[
              { label: 'Total vendido', value: fmt(seleccionada.ventas), color: '#111' },
              { label: 'Fondo inicial', value: fmt(seleccionada.fondo) },
              { label: 'Transacciones', value: seleccionada.tx_count },
              { label: 'Empleado', value: seleccionada.empleado_nombre },
            ].map(s => (
              <div key={s.label} style={{ background: '#F8F9FA', borderRadius: 8, padding: '10px 12px' }}>
                <p style={{ margin: '0 0 2px', fontSize: 11, color: '#999' }}>{s.label}</p>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: s.color || '#111' }}>{s.value}</p>
              </div>
            ))}
          </div>
          <div style={{ marginBottom: 12 }}>
            <p style={{ margin: '0 0 4px', fontSize: 12, color: '#999' }}>Apertura: {new Date(seleccionada.apertura).toLocaleString('es-AR')}</p>
            {seleccionada.cierre && <p style={{ margin: 0, fontSize: 12, color: '#999' }}>Cierre: {new Date(seleccionada.cierre).toLocaleString('es-AR')}</p>}
          </div>
          <h3 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 10px' }}>Transacciones del turno</h3>
          {txsCaja.length === 0 ? <p style={{ color: '#999', fontSize: 13 }}>Sin transacciones</p> : txsCaja.map(t => (
            <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #F8F9FA' }}>
              <div>
                <p style={{ margin: 0, fontSize: 13 }}>{t.alumno_nombre}</p>
                <p style={{ margin: 0, fontSize: 11, color: '#999' }}>{t.descripcion} · {new Date(t.fecha).toLocaleString('es-AR')}</p>
              </div>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{fmt(t.monto)}</span>
            </div>
          ))}
        </Modal>
      )}
    </div>
  )
}