import { useState, useEffect } from 'react'
import api from '../api/axios'

const LIMIT = 50

export default function Auditoria() {
  const [logs, setLogs]           = useState([])
  const [total, setTotal]         = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage]           = useState(1)
  const [empleados, setEmpleados] = useState([])
  const [cargando, setCargando]   = useState(true)
  const [filtroEmpleado, setFiltroEmpleado] = useState('Todos')
  const [filtroAccion, setFiltroAccion]     = useState('Todos')
  const [busq, setBusq]           = useState('')

  useEffect(() => { cargarEmpleados() }, [])
  useEffect(() => { cargar() }, [page])

  const cargarEmpleados = async () => {
    try {
      const eRes = await api.get('/empleados')
      setEmpleados(eRes.data)
    } catch (err) { console.error(err) }
  }

  const cargar = async () => {
    setCargando(true)
    try {
      const res = await api.get(`/auditoria?page=${page}&limit=${LIMIT}`)
      setLogs(res.data.data)
      setTotal(res.data.total)
      setTotalPages(res.data.pages)
    } catch (err) { console.error(err) }
    finally { setCargando(false) }
  }

  const irPagina = (p) => {
    if (p < 1 || p > totalPages) return
    setPage(p)
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

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 4px', color: 'var(--text)' }}>Auditoría</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: 0 }}>{total} eventos registrados en total</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total eventos', value: total },
          { label: 'Esta página', value: logs.length },
          { label: 'Empleados activos', value: empleados.filter(e => e.activo).length },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: '1rem', border: '1.5px solid var(--border)', boxShadow: 'var(--shadow)' }}>
            <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.5px' }}>{s.label}</p>
            <p style={{ margin: 0, fontSize: 24, fontWeight: 700, color: 'var(--text)' }}>{s.value}</p>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <input placeholder="Buscar en esta página..." value={busq} onChange={e => setBusq(e.target.value)} style={{ flex: 1, minWidth: 180 }} />
        <select value={filtroEmpleado} onChange={e => setFiltroEmpleado(e.target.value)} style={{ minWidth: 160 }}>
          {empleadosNombres.map(e => <option key={e}>{e}</option>)}
        </select>
        <select value={filtroAccion} onChange={e => setFiltroAccion(e.target.value)} style={{ minWidth: 180 }}>
          {acciones.map(a => <option key={a}>{a}</option>)}
        </select>
      </div>

      <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1.5px solid var(--border)', overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
        {cargando ? (
          <p style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>Cargando...</p>
        ) : filtrados.length === 0 ? (
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

      {/* Paginación */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 20 }}>
          <button
            onClick={() => irPagina(1)}
            disabled={page === 1}
            style={{ padding: '6px 10px', border: '1.5px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--bg-card)', fontSize: 12, cursor: page === 1 ? 'not-allowed' : 'pointer', color: page === 1 ? 'var(--text-tertiary)' : 'var(--text-secondary)' }}
          >«</button>
          <button
            onClick={() => irPagina(page - 1)}
            disabled={page === 1}
            style={{ padding: '6px 10px', border: '1.5px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--bg-card)', fontSize: 12, cursor: page === 1 ? 'not-allowed' : 'pointer', color: page === 1 ? 'var(--text-tertiary)' : 'var(--text-secondary)' }}
          >‹</button>

          {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
            let p
            if (totalPages <= 7) {
              p = i + 1
            } else if (page <= 4) {
              p = i + 1
            } else if (page >= totalPages - 3) {
              p = totalPages - 6 + i
            } else {
              p = page - 3 + i
            }
            return (
              <button
                key={p}
                onClick={() => irPagina(p)}
                style={{ padding: '6px 11px', border: `1.5px solid ${p === page ? 'var(--brand)' : 'var(--border)'}`, borderRadius: 'var(--radius)', background: p === page ? 'var(--brand)' : 'var(--bg-card)', color: p === page ? 'white' : 'var(--text-secondary)', fontSize: 12, fontWeight: p === page ? 700 : 400, cursor: 'pointer' }}
              >{p}</button>
            )
          })}

          <button
            onClick={() => irPagina(page + 1)}
            disabled={page === totalPages}
            style={{ padding: '6px 10px', border: '1.5px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--bg-card)', fontSize: 12, cursor: page === totalPages ? 'not-allowed' : 'pointer', color: page === totalPages ? 'var(--text-tertiary)' : 'var(--text-secondary)' }}
          >›</button>
          <button
            onClick={() => irPagina(totalPages)}
            disabled={page === totalPages}
            style={{ padding: '6px 10px', border: '1.5px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--bg-card)', fontSize: 12, cursor: page === totalPages ? 'not-allowed' : 'pointer', color: page === totalPages ? 'var(--text-tertiary)' : 'var(--text-secondary)' }}
          >»</button>

          <span style={{ fontSize: 12, color: 'var(--text-tertiary)', marginLeft: 4 }}>
            Página {page} de {totalPages} · {total} eventos
          </span>
        </div>
      )}
    </div>
  )
}
