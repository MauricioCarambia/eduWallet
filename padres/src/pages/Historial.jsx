import { useState, useEffect } from 'react'
import api from '../api/axios'

const fmt = n => `$${Number(n).toLocaleString('es-AR')}`

export default function Historial() {
  const [alumnos, setAlumnos] = useState([])
  const [txs, setTxs] = useState([])
  const [alumnoId, setAlumnoId] = useState(null)
  const [filtro, setFiltro] = useState('todos')
  const [cargando, setCargando] = useState(true)

  useEffect(() => { cargar() }, [])

  const cargar = async () => {
    try {
      const aRes = await api.get('/padres/alumnos')
      setAlumnos(aRes.data)
      if (aRes.data.length > 0) {
        setAlumnoId(aRes.data[0].id)
        const tRes = await api.get(`/transacciones/alumno/${aRes.data[0].id}`)
        setTxs(tRes.data)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setCargando(false)
    }
  }

  const cambiarAlumno = async id => {
    setAlumnoId(id)
    try {
      const res = await api.get(`/transacciones/alumno/${id}`)
      setTxs(res.data)
    } catch (err) { console.error(err) }
  }

  const filtradas = filtro === 'todos' ? txs : txs.filter(t => t.tipo === filtro)
  const totalGastado = txs.filter(t => t.tipo === 'compra').reduce((s, t) => s + parseFloat(t.monto), 0)
  const totalRecargado = txs.filter(t => t.tipo === 'recarga').reduce((s, t) => s + parseFloat(t.monto), 0)
  const alumnoActual = alumnos.find(a => a.id === alumnoId)

  if (cargando) return <div style={{ color: '#999' }}>Cargando...</div>
  if (alumnos.length === 0) return <div style={{ color: '#999', padding: '1rem' }}>No tenés alumnos vinculados</div>

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 600, margin: '0 0 16px' }}>Historial</h1>

      {/* selector alumno */}
      {alumnos.length > 1 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, overflowX: 'auto', paddingBottom: 4 }}>
          {alumnos.map(a => (
            <button key={a.id} onClick={() => cambiarAlumno(a.id)} style={{ padding: '6px 14px', border: `1.5px solid ${alumnoId === a.id ? '#111' : '#F0F0F0'}`, borderRadius: 20, background: alumnoId === a.id ? '#111' : 'white', color: alumnoId === a.id ? 'white' : '#666', fontSize: 13, fontWeight: alumnoId === a.id ? 500 : 400, cursor: 'pointer', whiteSpace: 'nowrap' }}>{a.nombre.split(' ')[0]}</button>
          ))}
        </div>
      )}

      {/* stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
        {[
          { label: 'Saldo', value: fmt(alumnoActual?.saldo || 0), color: parseFloat(alumnoActual?.saldo) < 200 ? '#DC2626' : '#16A34A' },
          { label: 'Total gastado', value: fmt(totalGastado) },
          { label: 'Total recargado', value: fmt(totalRecargado), color: '#16A34A' },
        ].map(s => (
          <div key={s.label} style={{ background: 'white', borderRadius: 12, padding: '10px 12px', border: '1px solid #F0F0F0' }}>
            <p style={{ margin: '0 0 2px', fontSize: 10, color: '#999' }}>{s.label}</p>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: s.color || '#111' }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* filtros */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {[['todos', 'Todos'], ['compra', 'Compras'], ['recarga', 'Recargas']].map(([val, label]) => (
          <button key={val} onClick={() => setFiltro(val)} style={{ padding: '6px 14px', border: `1px solid ${filtro === val ? '#111' : '#F0F0F0'}`, borderRadius: 8, background: filtro === val ? '#111' : 'white', color: filtro === val ? 'white' : '#666', fontSize: 13, cursor: 'pointer', fontWeight: filtro === val ? 500 : 400 }}>{label}</button>
        ))}
      </div>

      {/* lista */}
      <div style={{ background: 'white', borderRadius: 16, border: '1px solid #F0F0F0', overflow: 'hidden' }}>
        {filtradas.length === 0 ? (
          <p style={{ padding: '2rem', textAlign: 'center', color: '#999', fontSize: 14 }}>Sin movimientos</p>
        ) : filtradas.map((t, i) => (
          <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: i < filtradas.length - 1 ? '1px solid #F8F9FA' : 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: t.tipo === 'recarga' ? '#F0FDF4' : '#F8F9FA', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {t.tipo === 'recarga'
                  ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>
                  : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>}
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 500 }}>{t.descripcion}</p>
                <p style={{ margin: 0, fontSize: 11, color: '#999' }}>{new Date(t.fecha).toLocaleString('es-AR')} · {t.lugar}</p>
              </div>
            </div>
            <span style={{ fontSize: 14, fontWeight: 700, color: t.tipo === 'recarga' ? '#16A34A' : '#111' }}>
              {t.tipo === 'recarga' ? '+' : '-'}{fmt(t.monto)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}