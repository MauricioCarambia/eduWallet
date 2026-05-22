import { useState, useEffect } from 'react'
import api from '../api/axios'

export default function Auditoria() {
  const [logs, setLogs] = useState([])
  const [empleados, setEmpleados] = useState([])
  const [cargando, setCargando] = useState(true)
  const [filtroEmpleado, setFiltroEmpleado] = useState('Todos')
  const [filtroAccion, setFiltroAccion] = useState('Todos')
  const [busq, setBusq] = useState('')

  useEffect(() => { cargar() }, [])

  const cargar = async () => {
    try {
      const [lRes, eRes] = await Promise.all([api.get('/auditoria'), api.get('/empleados')])
      setLogs(lRes.data); setEmpleados(eRes.data)
    } catch (err) { console.error(err) }
    finally { setCargando(false) }
  }

  const acciones = ['Todos', ...new Set(logs.map(l => l.accion))]
  const empleadosNombres = ['Todos', ...new Set(logs.map(l => l.empleado_nombre).filter(Boolean))]

  const filtrados = logs.filter(l =>
    (filtroEmpleado === 'Todos' || l.empleado_nombre === filtroEmpleado) &&
    (filtroAccion === 'Todos' || l.accion === filtroAccion) &&
    (busq === '' || l.accion?.toLowerCase().includes(busq.toLowerCase()) || l.detalle?.toLowerCase().includes(busq.toLowerCase()) || l.empleado_nombre?.toLowerCase().includes(busq.toLowerCase()))
  )

  const colorAccion = accion => {
    if (accion?.includes('sesión') || accion?.includes('login')) return { bg: '#EFF6FF', color: '#2563EB' }
    if (accion?.includes('Nuevo') || accion?.includes('nuevo')) return { bg: 'var(--green-bg)', color: 'var(--green)' }
    if (accion?.includes('eliminar') || accion?.includes('Eliminar')) return { bg: 'var(--red-bg)', color: 'var(--red)' }
    if (accion?.includes('PIN') || accion?.includes('Recarga')) return { bg: 'var(--amber-bg)', color: 'var(--amber)' }
    if (accion?.includes('Cierre')) return { bg: 'var(--red-bg)', color: 'var(--red)' }
    if (accion?.includes('Apertura')) return { bg: 'var(--green-bg)', color: 'var(--green)' }
    return { bg: 'var(--bg)', color: 'var(--text-secondary)' }
  }

  if (cargando) return <div style={{ color: 'var(--text-tertiary)' }}>Cargando...</div>

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 4px', color: 'var(--text)' }}>Auditoría</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: 0 }}>{logs.length} eventos registrados</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total eventos', value: logs.length },
          { label: 'Hoy', value: logs.filter(l => l.fecha?.slice(0, 10) === new Date().toISOString().slice(0, 10)).length },
          { label: 'Empleados activos', value: empleados.filter(e => e.activo).length },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: '1rem', border: '1.5px solid var(--border)', boxShadow: 'var(--shadow)' }}>
            <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.5px' }}>{s.label}</p>
            <p style={{ margin: 0, fontSize: 24, fontWeight: 700, color: 'var(--text)' }}>{s.value}</p>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <input placeholder="Buscar..." value={busq} onChange={e => setBusq(e.target.value)} style={{ flex: 1, minWidth: 180 }} />
        <select value={filtroEmpleado} onChange={e => setFiltroEmpleado(e.target.value)} style={{ minWidth: 160 }}>
          {empleadosNombres.map(e => <option key={e}>{e}</option>)}
        </select>
        <select value={filtroAccion} onChange={e => setFiltroAccion(e.target.value)} style={{ minWidth: 180 }}>
          {acciones.map(a => <option key={a}>{a}</option>)}
        </select>
      </div>

      <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1.5px solid var(--border)', overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
        {filtrados.length === 0 ? (
          <p style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>Sin registros</p>
        ) : filtrados.map((l, i) => {
          const c = colorAccion(l.accion)
          return (
            <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: i < filtrados.length - 1 ? '1px solid var(--border-light)' : 'none' }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--bg)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', flexShrink: 0 }}>
                {l.empleado_nombre?.split(' ').slice(0, 2).map(n => n[0]).join('') || '?'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{l.accion}</span>
                  {l.detalle && <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>— {l.detalle}</span>}
                </div>
                <p style={{ margin: 0, fontSize: 11, color: 'var(--text-tertiary)' }}>{l.empleado_nombre} · {new Date(l.fecha).toLocaleString('es-AR')}</p>
              </div>
              <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 6, background: c.bg, color: c.color, whiteSpace: 'nowrap', flexShrink: 0 }}>{l.accion}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}