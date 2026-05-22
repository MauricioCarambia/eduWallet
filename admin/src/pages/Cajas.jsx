import { useState, useEffect } from 'react'
import api from '../api/axios'

const fmt = n => `$${Number(n).toLocaleString('es-AR')}`

function Modal({ title, onClose, children }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
      <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', border: '1.5px solid var(--border)', boxShadow: 'var(--shadow-md)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, color: 'var(--text-tertiary)', cursor: 'pointer' }}>×</button>
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
      setCajas(cRes.data); setTxs(tRes.data)
    } catch (err) { console.error(err) }
    finally { setCargando(false) }
  }

  const cerrarCaja = async id => {
    if (!confirm('¿Cerrar esta caja?')) return
    try {
      await api.patch(`/cajas/${id}/cerrar`)
      setCajas(p => p.map(c => c.id === id ? { ...c, abierta: false, cierre: new Date().toISOString() } : c))
      showMsg('ok', 'Caja cerrada correctamente')
    } catch { showMsg('error', 'Error al cerrar caja') }
  }

  const cajasFiltradas = cajas.filter(c =>
    (filtroLocal === 'Todos' || c.local === filtroLocal) &&
    (filtroEstado === 'Todos' || (filtroEstado === 'Abiertas' ? c.abierta : !c.abierta))
  )

  const cajasAbiertas = cajas.filter(c => c.abierta)
  const totalHoy = cajas.filter(c => c.apertura?.slice(0, 10) === new Date().toISOString().slice(0, 10)).reduce((s, c) => s + parseFloat(c.ventas || 0), 0)

  const txsCaja = seleccionada ? txs.filter(t => {
    const inicio = new Date(seleccionada.apertura)
    const fin = seleccionada.cierre ? new Date(seleccionada.cierre) : new Date()
    const fecha = new Date(t.fecha)
    return t.lugar === seleccionada.local && fecha >= inicio && fecha <= fin
  }) : []

  if (cargando) return <div style={{ color: 'var(--text-tertiary)' }}>Cargando...</div>

  const filtroBtn = (label, active, onClick) => (
    <button onClick={onClick} style={{ padding: '5px 12px', border: `1.5px solid ${active ? '#1E3A5F' : 'var(--border)'}`, borderRadius: 'var(--radius)', background: active ? '#1E3A5F' : 'var(--bg-card)', color: active ? 'white' : 'var(--text-secondary)', fontSize: 12, fontWeight: active ? 600 : 400, cursor: 'pointer' }}>{label}</button>
  )

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 4px', color: 'var(--text)' }}>Cajas</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: 0 }}>Historial de turnos</p>
      </div>

      {msg && <div style={{ padding: '10px 14px', borderRadius: 'var(--radius)', fontSize: 13, marginBottom: 16, background: msg.tipo === 'ok' ? 'var(--green-bg)' : 'var(--red-bg)', color: msg.tipo === 'ok' ? 'var(--green)' : 'var(--red)', borderLeft: `3px solid ${msg.tipo === 'ok' ? 'var(--green)' : 'var(--red)'}` }}>{msg.texto}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Cajas abiertas', value: cajasAbiertas.length, color: cajasAbiertas.length > 0 ? 'var(--green)' : 'var(--text)' },
          { label: 'Ventas de hoy', value: fmt(totalHoy) },
          { label: 'Total de turnos', value: cajas.length },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: '1rem', border: '1.5px solid var(--border)', boxShadow: 'var(--shadow)' }}>
            <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.5px' }}>{s.label}</p>
            <p style={{ margin: 0, fontSize: 24, fontWeight: 700, color: s.color || 'var(--text)' }}>{s.value}</p>
          </div>
        ))}
      </div>

      {cajasAbiertas.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 10px', color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '.5px' }}>Cajas abiertas ahora</h2>
          {cajasAbiertas.map(c => (
            <div key={c.id} style={{ background: 'var(--green-bg)', borderRadius: 'var(--radius-lg)', padding: '1rem', border: '1.5px solid var(--green)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 8 }}>
              <div>
                <p style={{ margin: '0 0 2px', fontSize: 14, fontWeight: 600, color: 'var(--green)' }}>{c.local} — {c.empleado_nombre}</p>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--green)' }}>Apertura: {new Date(c.apertura).toLocaleString('es-AR')} · {c.tx_count} tx</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <p style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--green)' }}>{fmt(c.ventas)}</p>
                <button onClick={() => cerrarCaja(c.id)} style={{ padding: '7px 14px', border: 'none', borderRadius: 'var(--radius)', background: 'var(--red)', color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Cerrar caja</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {['Todos', 'Kiosco', 'Librería'].map(l => filtroBtn(l, filtroLocal === l, () => setFiltroLocal(l)))}
        <div style={{ width: 1, background: 'var(--border)', margin: '0 4px' }} />
        {['Todos', 'Abiertas', 'Cerradas'].map(e => filtroBtn(e, filtroEstado === e, () => setFiltroEstado(e)))}
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        {cajasFiltradas.map(c => (
          <div key={c.id} style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: '1rem 1.25rem', border: '1.5px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', boxShadow: 'var(--shadow)' }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: c.abierta ? 'var(--green-bg)' : 'var(--bg)', border: '1.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c.abierta ? 'var(--green)' : 'var(--text-tertiary)'} strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>
            </div>
            <div style={{ flex: 1, minWidth: 150 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{c.local}</p>
                <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 6, background: c.abierta ? 'var(--green-bg)' : 'var(--bg)', color: c.abierta ? 'var(--green)' : 'var(--text-tertiary)' }}>{c.abierta ? 'Abierta' : 'Cerrada'}</span>
              </div>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-tertiary)' }}>{c.empleado_nombre} · {new Date(c.apertura).toLocaleString('es-AR')}{c.cierre ? ` → ${new Date(c.cierre).toLocaleString('es-AR')}` : ''}</p>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-tertiary)' }}>Fondo: {fmt(c.fondo)} · {c.tx_count} transacciones</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{fmt(c.ventas)}</p>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => setSeleccionada(c)} style={{ padding: '6px 12px', border: '1.5px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--bg-card)', fontSize: 12, cursor: 'pointer', color: 'var(--text-secondary)', fontWeight: 500 }}>Ver detalle</button>
                {c.abierta && <button onClick={() => cerrarCaja(c.id)} style={{ padding: '6px 12px', border: 'none', borderRadius: 'var(--radius)', background: 'var(--red-bg)', color: 'var(--red)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Cerrar</button>}
              </div>
            </div>
          </div>
        ))}
        {cajasFiltradas.length === 0 && <p style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13, padding: '2rem' }}>Sin cajas registradas</p>}
      </div>

      {seleccionada && (
        <Modal title={`Detalle — ${seleccionada.local}`} onClose={() => setSeleccionada(null)}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
            {[['Total vendido', fmt(seleccionada.ventas)], ['Fondo inicial', fmt(seleccionada.fondo)], ['Transacciones', seleccionada.tx_count], ['Empleado', seleccionada.empleado_nombre]].map(([label, value]) => (
              <div key={label} style={{ background: 'var(--bg)', borderRadius: 'var(--radius)', padding: '10px 12px', border: '1px solid var(--border)' }}>
                <p style={{ margin: '0 0 2px', fontSize: 11, color: 'var(--text-secondary)' }}>{label}</p>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{value}</p>
              </div>
            ))}
          </div>
          <h3 style={{ fontSize: 12, fontWeight: 700, margin: '0 0 10px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.5px' }}>Transacciones del turno</h3>
          {txsCaja.length === 0 ? <p style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>Sin transacciones</p> : txsCaja.map(t => (
            <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border-light)' }}>
              <div>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--text)' }}>{t.alumno_nombre}</p>
                <p style={{ margin: 0, fontSize: 11, color: 'var(--text-tertiary)' }}>{t.descripcion} · {new Date(t.fecha).toLocaleString('es-AR')}</p>
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{fmt(t.monto)}</span>
            </div>
          ))}
        </Modal>
      )}
    </div>
  )
}