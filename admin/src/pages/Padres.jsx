import { useState, useEffect } from 'react'
import api from '../api/axios'
import { SkeletonTable } from '../components/Skeleton'

const fmt = n => `$${Number(n).toLocaleString('es-AR')}`

function Modal({ title, onClose, children }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
      <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto', border: '1.5px solid var(--border)', boxShadow: 'var(--shadow-md)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, color: 'var(--text-tertiary)', cursor: 'pointer' }}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

export default function Padres() {
  const [padres, setPadres] = useState([])
  const [alumnos, setAlumnos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [busq, setBusq] = useState('')
  const [seleccionado, setSeleccionado] = useState(null)
  const [modal, setModal] = useState(null)
  const [alumnoVincular, setAlumnoVincular] = useState('')
  const [relacion, setRelacion] = useState('tutor')
  const [msg, setMsg] = useState(null)

  const showMsg = (tipo, texto) => { setMsg({ tipo, texto }); setTimeout(() => setMsg(null), 3000) }

  useEffect(() => { cargar() }, [])

  const cargar = async () => {
    try {
      const [pRes, aRes] = await Promise.all([api.get('/admin/padres'), api.get('/alumnos')])
      setPadres(pRes.data); setAlumnos(aRes.data)
    } catch (err) { console.error(err) }
    finally { setCargando(false) }
  }

  const togglePadre = async id => {
    try {
      const res = await api.patch(`/admin/padres/${id}/toggle`)
      setPadres(p => p.map(x => x.id === id ? { ...x, activo: res.data.activo } : x))
    } catch { showMsg('error', 'Error') }
  }

  const desvincular = async (padreId, alumnoId) => {
    if (!confirm('¿Desvincular este alumno?')) return
    try {
      await api.delete(`/admin/padres/${padreId}/alumnos/${alumnoId}`)
      setPadres(p => p.map(x => x.id === padreId ? { ...x, alumnos: x.alumnos.filter(a => a.id !== alumnoId) } : x))
      showMsg('ok', 'Alumno desvinculado')
    } catch { showMsg('error', 'Error al desvincular') }
  }

  const vincular = async () => {
    if (!alumnoVincular) return
    try {
      await api.post(`/admin/padres/${seleccionado.id}/alumnos`, { alumno_id: parseInt(alumnoVincular), relacion })
      showMsg('ok', 'Alumno vinculado'); setModal(null); cargar()
    } catch (err) { showMsg('error', err.response?.data?.error || 'Error al vincular') }
  }

  const eliminar = async id => {
    if (!confirm('¿Eliminar este padre?')) return
    try {
      await api.delete(`/admin/padres/${id}`)
      setPadres(p => p.filter(x => x.id !== id)); showMsg('ok', 'Padre eliminado')
    } catch { showMsg('error', 'Error al eliminar') }
  }

  const filtrados = padres.filter(p => p.nombre.toLowerCase().includes(busq.toLowerCase()) || p.email.toLowerCase().includes(busq.toLowerCase()))

  if (cargando) return <SkeletonTable rows={8} cols={4} />

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 4px', color: 'var(--text)' }}>Padres y tutores</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: 0 }}>{padres.length} registrados</p>
      </div>

      {msg && <div style={{ padding: '10px 14px', borderRadius: 'var(--radius)', fontSize: 13, marginBottom: 16, background: msg.tipo === 'ok' ? 'var(--green-bg)' : 'var(--red-bg)', color: msg.tipo === 'ok' ? 'var(--green)' : 'var(--red)', borderLeft: `3px solid ${msg.tipo === 'ok' ? 'var(--green)' : 'var(--red)'}` }}>{msg.texto}</div>}

      <input placeholder="Buscar por nombre o email..." value={busq} onChange={e => setBusq(e.target.value)} style={{ width: '100%', marginBottom: 16 }} />

      <div style={{ display: 'grid', gap: 10 }}>
        {filtrados.map(p => (
          <div key={p.id} style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: '1rem 1.25rem', border: '1.5px solid var(--border)', boxShadow: 'var(--shadow)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: p.alumnos?.length > 0 ? 12 : 0 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--bg)', border: '1.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', flexShrink: 0 }}>
                {p.nombre.split(' ').slice(0, 2).map(n => n[0]).join('')}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{p.nombre}</p>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--text-tertiary)' }}>{p.email} · {p.alumnos?.length || 0} alumno{p.alumnos?.length !== 1 ? 's' : ''}</p>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 6, background: p.activo ? 'var(--green-bg)' : 'var(--red-bg)', color: p.activo ? 'var(--green)' : 'var(--red)' }}>
                  {p.activo ? 'Activo' : 'Inactivo'}
                </span>
                {[
                  { label: '+ Alumno', onClick: () => { setSeleccionado(p); setModal('vincular') }, bg: 'var(--brand-light)', color: 'var(--accent)' },
                  { label: p.activo ? 'Deshabilitar' : 'Habilitar', onClick: () => togglePadre(p.id), bg: p.activo ? 'var(--red-bg)' : 'var(--green-bg)', color: p.activo ? 'var(--red)' : 'var(--green)' },
                  { label: '×', onClick: () => eliminar(p.id), bg: 'var(--red-bg)', color: 'var(--red)' },
                ].map(b => (
                  <button key={b.label} onClick={b.onClick} style={{ padding: '4px 10px', border: 'none', borderRadius: 6, background: b.bg, color: b.color, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>{b.label}</button>
                ))}
              </div>
            </div>

            {p.alumnos?.length > 0 && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {p.alumnos.map(a => (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
                    <div>
                      <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{a.nombre}</p>
                      <p style={{ margin: 0, fontSize: 10, color: 'var(--text-tertiary)' }}>{a.curso} · {fmt(a.saldo)} · {a.relacion}</p>
                    </div>
                    <button onClick={() => desvincular(p.id, a.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--red)', padding: '0 2px' }}>×</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        {filtrados.length === 0 && <p style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13, padding: '2rem' }}>Sin padres registrados</p>}
      </div>

      {modal === 'vincular' && seleccionado && (
        <Modal title={`Vincular alumno a ${seleccionado.nombre}`} onClose={() => setModal(null)}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.5px' }}>Alumno</label>
            <select value={alumnoVincular} onChange={e => setAlumnoVincular(e.target.value)}>
              <option value="">Seleccioná un alumno</option>
              {alumnos.filter(a => !seleccionado.alumnos?.some(x => x.id === a.id)).map(a => (
                <option key={a.id} value={a.id}>{a.nombre} — {a.curso}</option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.5px' }}>Relación</label>
            <select value={relacion} onChange={e => setRelacion(e.target.value)}>
              {['tutor', 'madre', 'padre', 'abuelo/a', 'otro'].map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setModal(null)} style={{ padding: '8px 16px', border: '1.5px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--bg-card)', fontSize: 13, cursor: 'pointer', color: 'var(--text-secondary)' }}>Cancelar</button>
            <button onClick={vincular} style={{ padding: '8px 18px', border: 'none', borderRadius: 'var(--radius)', background: '#1E3A5F', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Vincular</button>
          </div>
        </Modal>
      )}
    </div>
  )
}