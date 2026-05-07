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
      setLogs(lRes.data)
      setEmpleados(eRes.data)
    } catch (err) {
      console.error(err)
    } finally {
      setCargando(false)
    }
  }

  const acciones = ['Todos', ...new Set(logs.map(l => l.accion))]
  const empleadosNombres = ['Todos', ...new Set(logs.map(l => l.empleado_nombre).filter(Boolean))]

  const filtrados = logs.filter(l =>
    (filtroEmpleado === 'Todos' || l.empleado_nombre === filtroEmpleado) &&
    (filtroAccion === 'Todos' || l.accion === filtroAccion) &&
    (busq === '' || l.accion?.toLowerCase().includes(busq.toLowerCase()) || l.detalle?.toLowerCase().includes(busq.toLowerCase()) || l.empleado_nombre?.toLowerCase().includes(busq.toLowerCase()))
  )

  const colorAccion = accion => {
    if (accion?.includes('login') || accion?.includes('sesión')) return { bg: '#EFF6FF', color: '#2563EB' }
    if (accion?.includes('Nuevo') || accion?.includes('nuevo')) return { bg: '#F0FDF4', color: '#16A34A' }
    if (accion?.includes('eliminar') || accion?.includes('Eliminar')) return { bg: '#FEF2F2', color: '#DC2626' }
    if (accion?.includes('PIN') || accion?.includes('pin')) return { bg: '#FFF7ED', color: '#D97706' }
    if (accion?.includes('Recarga') || accion?.includes('recarga')) return { bg: '#F0FDF4', color: '#16A34A' }
    if (accion?.includes('Cierre') || accion?.includes('cierre')) return { bg: '#FEF2F2', color: '#DC2626' }
    if (accion?.includes('Apertura') || accion?.includes('apertura')) return { bg: '#F0FDF4', color: '#16A34A' }
    return { bg: '#F8F9FA', color: '#666' }
  }

  if (cargando) return <div style={{ color: '#999' }}>Cargando...</div>

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, margin: '0 0 4px' }}>Auditoría</h1>
        <p style={{ color: '#999', fontSize: 13, margin: 0 }}>{logs.length} eventos registrados</p>
      </div>

      {/* stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total eventos', value: logs.length },
          { label: 'Hoy', value: logs.filter(l => l.fecha?.slice(0, 10) === new Date().toISOString().slice(0, 10)).length },
          { label: 'Empleados activos', value: empleados.filter(e => e.activo).length },
        ].map(s => (
          <div key={s.label} style={{ background: 'white', borderRadius: 12, padding: '1rem', border: '1px solid #F0F0F0' }}>
            <p style={{ margin: '0 0 4px', fontSize: 11, color: '#999', fontWeight: 500 }}>{s.label}</p>
            <p style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* filtros */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <input placeholder="Buscar..." value={busq} onChange={e => setBusq(e.target.value)} style={{ flex: 1, minWidth: 180 }} />
        <select value={filtroEmpleado} onChange={e => setFiltroEmpleado(e.target.value)} style={{ minWidth: 160 }}>
          {empleadosNombres.map(e => <option key={e}>{e}</option>)}
        </select>
        <select value={filtroAccion} onChange={e => setFiltroAccion(e.target.value)} style={{ minWidth: 180 }}>
          {acciones.map(a => <option key={a}>{a}</option>)}
        </select>
      </div>

      {/* lista */}
      <div style={{ background: 'white', borderRadius: 12, border: '1px solid #F0F0F0', overflow: 'hidden' }}>
        {filtrados.length === 0 ? (
          <p style={{ padding: '2rem', textAlign: 'center', color: '#999', fontSize: 13 }}>Sin registros</p>
        ) : filtrados.map((l, i) => {
          const c = colorAccion(l.accion)
          return (
            <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: i < filtrados.length - 1 ? '1px solid #F8F9FA' : 'none' }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: '#F8F9FA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: '#666', flexShrink: 0 }}>
                {l.empleado_nombre?.split(' ').slice(0, 2).map(n => n[0]).join('') || '?'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{l.accion}</span>
                  {l.detalle && <span style={{ fontSize: 12, color: '#999' }}>— {l.detalle}</span>}
                </div>
                <p style={{ margin: 0, fontSize: 11, color: '#999' }}>{l.empleado_nombre} · {new Date(l.fecha).toLocaleString('es-AR')}</p>
              </div>
              <span style={{ fontSize: 11, fontWeight: 500, padding: '3px 8px', borderRadius: 6, background: c.bg, color: c.color, whiteSpace: 'nowrap', flexShrink: 0 }}>{l.accion}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}