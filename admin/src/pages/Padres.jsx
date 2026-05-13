import { useState, useEffect } from 'react'
import api from '../api/axios'

const fmt = n => `$${Number(n).toLocaleString('es-AR')}`

function Modal({ title, onClose, children }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
      <div style={{ background: 'white', borderRadius: 16, padding: '1.5rem', width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, color: '#999', lineHeight: 1 }}>×</button>
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
      const [pRes, aRes] = await Promise.all([
        api.get('/admin/padres'),
        api.get('/alumnos')
      ])
      setPadres(pRes.data)
      setAlumnos(aRes.data)
    } catch (err) {
      console.error(err)
    } finally {
      setCargando(false)
    }
  }

  const togglePadre = async id => {
    try {
      const res = await api.patch(`/admin/padres/${id}/toggle`)
      setPadres(prev => prev.map(p => p.id === id ? { ...p, activo: res.data.activo } : p))
    } catch (err) { showMsg('error', 'Error') }
  }

  const desvincular = async (padreId, alumnoId) => {
    if (!confirm('¿Desvincular este alumno?')) return
    try {
      await api.delete(`/admin/padres/${padreId}/alumnos/${alumnoId}`)
      setPadres(prev => prev.map(p => p.id === padreId ? {
        ...p, alumnos: p.alumnos.filter(a => a.id !== alumnoId)
      } : p))
      showMsg('ok', 'Alumno desvinculado')
    } catch (err) { showMsg('error', 'Error al desvincular') }
  }

  const vincular = async () => {
    if (!alumnoVincular) return
    try {
      await api.post(`/admin/padres/${seleccionado.id}/alumnos`, {
        alumno_id: parseInt(alumnoVincular),
        relacion
      })
      showMsg('ok', 'Alumno vinculado correctamente')
      setModal(null)
      cargar()
    } catch (err) { showMsg('error', err.response?.data?.error || 'Error al vincular') }
  }

  const eliminar = async id => {
    if (!confirm('¿Eliminar este padre y todas sus vinculaciones?')) return
    try {
      await api.delete(`/admin/padres/${id}`)
      setPadres(prev => prev.filter(p => p.id !== id))
      showMsg('ok', 'Padre eliminado')
    } catch (err) { showMsg('error', 'Error al eliminar') }
  }

  const filtrados = padres.filter(p =>
    p.nombre.toLowerCase().includes(busq.toLowerCase()) ||
    p.email.toLowerCase().includes(busq.toLowerCase())
  )

  if (cargando) return <div style={{ color: '#999' }}>Cargando...</div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: '0 0 4px' }}>Padres y tutores</h1>
          <p style={{ color: '#999', fontSize: 13, margin: 0 }}>{padres.length} registrados</p>
        </div>
      </div>

      {msg && <div style={{ padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16, background: msg.tipo === 'ok' ? '#F0FDF4' : '#FEF2F2', color: msg.tipo === 'ok' ? '#16A34A' : '#DC2626' }}>{msg.texto}</div>}

      <input placeholder="Buscar por nombre o email..." value={busq} onChange={e => setBusq(e.target.value)} style={{ width: '100%', marginBottom: 16 }} />

      <div style={{ display: 'grid', gap: 10 }}>
        {filtrados.map(p => (
          <div key={p.id} style={{ background: 'white', borderRadius: 12, padding: '1rem 1.25rem', border: '1px solid #F0F0F0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: p.alumnos?.length > 0 ? 12 : 0 }}>
              <div style={{ width: 38, height: 38, borderRadius: 12, background: '#F8F9FA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#666', flexShrink: 0 }}>
                {p.nombre.split(' ').slice(0, 2).map(n => n[0]).join('')}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 500 }}>{p.nombre}</p>
                <p style={{ margin: 0, fontSize: 12, color: '#999' }}>{p.email} · {p.alumnos?.length || 0} alumno{p.alumnos?.length !== 1 ? 's' : ''} vinculado{p.alumnos?.length !== 1 ? 's' : ''}</p>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ fontSize: 10, fontWeight: 500, padding: '2px 7px', borderRadius: 6, background: p.activo ? '#F0FDF4' : '#FEF2F2', color: p.activo ? '#16A34A' : '#DC2626' }}>
                  {p.activo ? 'Activo' : 'Inactivo'}
                </span>
                <button onClick={() => { setSeleccionado(p); setModal('vincular') }} style={{ padding: '4px 10px', border: '1px solid #F0F0F0', borderRadius: 6, background: 'white', fontSize: 11, cursor: 'pointer', color: '#666' }}>+ Alumno</button>
                <button onClick={() => togglePadre(p.id)} style={{ padding: '4px 10px', border: 'none', borderRadius: 6, fontSize: 11, cursor: 'pointer', background: p.activo ? '#FEF2F2' : '#F0FDF4', color: p.activo ? '#DC2626' : '#16A34A', fontWeight: 500 }}>
                  {p.activo ? 'Deshabilitar' : 'Habilitar'}
                </button>
                <button onClick={() => eliminar(p.id)} style={{ padding: '4px 8px', border: 'none', borderRadius: 6, background: '#FEF2F2', color: '#DC2626', fontSize: 12, cursor: 'pointer' }}>×</button>
              </div>
            </div>

            {p.alumnos?.length > 0 && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {p.alumnos.map(a => (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', background: '#F8F9FA', borderRadius: 8, border: '1px solid #F0F0F0' }}>
                    <div>
                      <p style={{ margin: 0, fontSize: 12, fontWeight: 500 }}>{a.nombre}</p>
                      <p style={{ margin: 0, fontSize: 10, color: '#999' }}>{a.curso} · {fmt(a.saldo)} · {a.relacion}</p>
                    </div>
                    <button onClick={() => desvincular(p.id, a.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#DC2626', padding: '0 2px' }}>×</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        {filtrados.length === 0 && <p style={{ textAlign: 'center', color: '#999', fontSize: 13, padding: '2rem' }}>Sin padres registrados</p>}
      </div>

      {modal === 'vincular' && seleccionado && (
        <Modal title={`Vincular alumno a ${seleccionado.nombre}`} onClose={() => setModal(null)}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#555', marginBottom: 5 }}>Alumno</label>
            <select value={alumnoVincular} onChange={e => setAlumnoVincular(e.target.value)} style={{ width: '100%' }}>
              <option value="">Seleccioná un alumno</option>
              {alumnos.filter(a => !seleccionado.alumnos?.some(x => x.id === a.id)).map(a => (
                <option key={a.id} value={a.id}>{a.nombre} — {a.curso}</option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#555', marginBottom: 5 }}>Relación</label>
            <select value={relacion} onChange={e => setRelacion(e.target.value)} style={{ width: '100%' }}>
              <option value="tutor">Tutor</option>
              <option value="madre">Madre</option>
              <option value="padre">Padre</option>
              <option value="abuelo/a">Abuelo/a</option>
              <option value="otro">Otro</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setModal(null)} style={{ padding: '8px 16px', border: '1px solid #F0F0F0', borderRadius: 8, background: 'white', fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
            <button onClick={vincular} style={{ padding: '8px 16px', border: 'none', borderRadius: 8, background: '#111', color: 'white', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>Vincular</button>
          </div>
        </Modal>
      )}
    </div>
  )
}