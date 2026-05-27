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

  if (cargando) return <div style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>Cargando...</div>
  if (alumnos.length === 0) return <div style={{ color: 'var(--text-tertiary)', padding: '1rem', fontSize: 14 }}>No tenés alumnos vinculados</div>

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 600, margin: '0 0 16px', color: 'var(--text)' }}>Historial</h1>

      {alumnos.length > 1 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, overflowX: 'auto', paddingBottom: 4 }}>
          {alumnos.map(a => (
            <button key={a.id} onClick={() => cambiarAlumno(a.id)} style={{ padding: '6px 14px', border: `1.5px solid ${alumnoId === a.id ? 'var(--brand)' : 'var(--border)'}`, borderRadius: 20, background: alumnoId === a.id ? 'var(--brand)' : 'var(--bg-card)', color: alumnoId === a.id ? 'white' : 'var(--text-secondary)', fontSize: 13, fontWeight: alumnoId === a.id ? 500 : 400, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              {a.nombre.split(' ')[0]}
            </button>
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
        {[
          { label: 'Saldo', value: fmt(alumnoActual?.saldo || 0), color: parseFloat(alumnoActual?.saldo) < 200 ? 'var(--red)' : 'var(--green)' },
          { label: 'Total gastado', value: fmt(totalGastado), color: 'var(--text)' },
          { label: 'Total recargado', value: fmt(totalRecargado), color: 'var(--green)' },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--bg-card)', borderRadius: 12, padding: '10px 12px', border: '1px solid var(--border)', boxShadow: 'var(--shadow)' }}>
            <p style={{ margin: '0 0 2px', fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '.5px' }}>{s.label}</p>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {[['todos', 'Todos'], ['compra', 'Compras'], ['recarga', 'Recargas']].map(([val, label]) => (
          <button key={val} onClick={() => setFiltro(val)} style={{ padding: '6px 14px', border: `1.5px solid ${filtro === val ? 'var(--brand)' : 'var(--border)'}`, borderRadius: 8, background: filtro === val ? 'var(--brand)' : 'var(--bg-card)', color: filtro === val ? 'white' : 'var(--text-secondary)', fontSize: 13, cursor: 'pointer', fontWeight: filtro === val ? 500 : 400 }}>
            {label}
          </button>
        ))}
      </div>

      <div style={{ background: 'var(--bg-card)', borderRadius: 16, border: '1px solid var(--border)', overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
        {filtradas.length === 0 ? (
          <p style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 14 }}>Sin movimientos</p>
        ) : filtradas.map((t, i) => (
          <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: i < filtradas.length - 1 ? '1px solid var(--border-light)' : 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: t.tipo === 'recarga' ? 'var(--green-bg)' : 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {t.tipo === 'recarga'
                  ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>
                  : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>}
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{t.descripcion}</p>
                <p style={{ margin: 0, fontSize: 11, color: 'var(--text-tertiary)' }}>{new Date(t.fecha).toLocaleString('es-AR')} · {t.lugar}</p>
              </div>
            </div>
            <span style={{ fontSize: 14, fontWeight: 700, color: t.tipo === 'recarga' ? 'var(--green)' : 'var(--text)' }}>
              {t.tipo === 'recarga' ? '+' : '-'}{fmt(t.monto)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}