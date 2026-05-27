import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useCaja } from '../context/CajaContext'
import api from '../api/axios'

const fmt = n => `$${Number(n).toLocaleString('es-AR')}`

export default function Historial() {
  const { sesion } = useAuth()
  const { caja } = useCaja()
  const [txs, setTxs] = useState([])
  const [cargando, setCargando] = useState(true)
  const [filtro, setFiltro] = useState('turno')
  const [busq, setBusq] = useState('')
  const [msg, setMsg] = useState(null)

  const showMsg = (tipo, texto) => { setMsg({ tipo, texto }); setTimeout(() => setMsg(null), 3000) }

  useEffect(() => { cargar() }, [])

  const cargar = async () => {
    try { const tRes = await api.get('/transacciones'); setTxs(tRes.data) }
    catch (err) { console.error(err) } finally { setCargando(false) }
  }

  const hoy = new Date().toISOString().slice(0, 10)

  const txsFiltradas = txs.filter(t => {
    const matchBusq = busq === '' || t.alumno_nombre?.toLowerCase().includes(busq.toLowerCase()) || t.descripcion?.toLowerCase().includes(busq.toLowerCase())
    if (filtro === 'turno' && caja) {
      const inicio = new Date(caja.apertura)
      const fecha = new Date(t.fecha)
      return t.lugar === caja.local && fecha >= inicio && t.tipo === 'compra' && matchBusq
    }
    if (filtro === 'hoy') return t.fecha?.slice(0, 10) === hoy && t.tipo === 'compra' && matchBusq
    return t.tipo === 'compra' && matchBusq
  })

  const totalFiltrado = txsFiltradas.reduce((s, t) => s + parseFloat(t.monto), 0)

  if (cargando) return <div style={{ color: 'var(--text-tertiary)' }}>Cargando...</div>

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, margin: '0 0 4px', color: 'var(--text)' }}>Historial de ventas</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: 0 }}>{txsFiltradas.length} transacciones</p>
      </div>

      {msg && <div style={{ padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16, background: msg.tipo === 'ok' ? 'var(--green-bg)' : 'var(--red-bg)', color: msg.tipo === 'ok' ? 'var(--green)' : 'var(--red)', borderLeft: `3px solid ${msg.tipo === 'ok' ? 'var(--green)' : 'var(--red)'}` }}>{msg.texto}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 16 }}>
        {[
          { label: filtro === 'turno' ? 'Total del turno' : filtro === 'hoy' ? 'Total de hoy' : 'Total general', value: fmt(totalFiltrado), color: 'var(--green)' },
          { label: 'Transacciones', value: txsFiltradas.length, color: 'var(--text)' },
          { label: 'Ticket promedio', value: txsFiltradas.length > 0 ? fmt(Math.round(totalFiltrado / txsFiltradas.length)) : '$0', color: 'var(--text)' },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--bg-card)', borderRadius: 12, padding: '1rem', border: '1px solid var(--border)', boxShadow: 'var(--shadow)' }}>
            <p style={{ margin: '0 0 4px', fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.5px' }}>{s.label}</p>
            <p style={{ margin: 0, fontSize: 20, fontWeight: 600, color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {[['turno', 'Mi turno'], ['hoy', 'Hoy'], ['todo', 'Todo']].map(([val, label]) => (
          <button key={val} onClick={() => setFiltro(val)} style={{ padding: '6px 14px', border: `1px solid ${filtro === val ? 'var(--brand)' : 'var(--border)'}`, borderRadius: 8, background: filtro === val ? 'var(--brand)' : 'var(--bg-card)', color: filtro === val ? 'white' : 'var(--text-secondary)', fontSize: 13, cursor: 'pointer', fontWeight: filtro === val ? 500 : 400 }}>{label}</button>
        ))}
        <input placeholder="Buscar alumno o producto..." value={busq} onChange={e => setBusq(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
      </div>

      <div style={{ background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
        {txsFiltradas.length === 0
          ? <p style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>Sin transacciones</p>
          : txsFiltradas.map((t, i) => (
            <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: i < txsFiltradas.length - 1 ? '1px solid var(--border-light)' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', flexShrink: 0 }}>
                  {t.alumno_nombre?.split(' ').slice(0, 2).map(n => n[0]).join('') || '?'}
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{t.alumno_nombre}</p>
                  <p style={{ margin: 0, fontSize: 11, color: 'var(--text-tertiary)' }}>{t.descripcion} · {t.lugar} · {new Date(t.fecha).toLocaleString('es-AR')}</p>
                </div>
              </div>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{fmt(t.monto)}</span>
            </div>
          ))}
      </div>
    </div>
  )
}