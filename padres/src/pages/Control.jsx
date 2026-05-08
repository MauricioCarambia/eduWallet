import { useState, useEffect } from 'react'
import api from '../api/axios'

const fmt = n => `$${Number(n).toLocaleString('es-AR')}`

export default function Control() {
  const [alumnos, setAlumnos] = useState([])
  const [alumnoId, setAlumnoId] = useState(null)
  const [nuevoLimite, setNuevoLimite] = useState('')
  const [cargando, setCargando] = useState(true)
  const [msg, setMsg] = useState(null)

  const showMsg = (tipo, texto) => { setMsg({ tipo, texto }); setTimeout(() => setMsg(null), 3000) }

  useEffect(() => { cargar() }, [])

  const cargar = async () => {
    try {
      const res = await api.get('/padres/alumnos')
      setAlumnos(res.data)
      if (res.data.length > 0) setAlumnoId(res.data[0].id)
    } catch (err) {
      console.error(err)
    } finally {
      setCargando(false)
    }
  }

  const toggleBloqueo = async () => {
    try {
      const res = await api.patch(`/padres/alumnos/${alumnoId}/toggle`)
      setAlumnos(prev => prev.map(a => a.id === alumnoId ? res.data : a))
      showMsg('ok', `Tarjeta ${res.data.activo ? 'activada' : 'bloqueada'}`)
    } catch (err) { showMsg('error', 'Error al cambiar estado') }
  }

  const guardarLimite = async () => {
    const n = parseInt(nuevoLimite)
    if (!n || n <= 0) return
    try {
      const res = await api.patch(`/padres/alumnos/${alumnoId}/limite`, { limite_diario: n })
      setAlumnos(prev => prev.map(a => a.id === alumnoId ? res.data : a))
      showMsg('ok', `Límite actualizado a ${fmt(n)}/día`)
      setNuevoLimite('')
    } catch (err) { showMsg('error', 'Error al actualizar límite') }
  }

  const alumnoActual = alumnos.find(a => a.id === alumnoId)
  const pct = alumnoActual ? Math.min(pct2(alumnoActual.gasto_hoy, alumnoActual.limite_diario), 100) : 0
  function pct2(a, b) { return b ? Math.round(a / b * 100) : 0 }

  if (cargando) return <div style={{ color: '#999' }}>Cargando...</div>
  if (alumnos.length === 0) return <div style={{ color: '#999', padding: '1rem' }}>No tenés alumnos vinculados</div>

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 600, margin: '0 0 16px' }}>Control parental</h1>

      {/* selector alumno */}
      {alumnos.length > 1 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, overflowX: 'auto', paddingBottom: 4 }}>
          {alumnos.map(a => (
            <button key={a.id} onClick={() => setAlumnoId(a.id)} style={{ padding: '6px 14px', border: `1.5px solid ${alumnoId === a.id ? '#111' : '#F0F0F0'}`, borderRadius: 20, background: alumnoId === a.id ? '#111' : 'white', color: alumnoId === a.id ? 'white' : '#666', fontSize: 13, fontWeight: alumnoId === a.id ? 500 : 400, cursor: 'pointer', whiteSpace: 'nowrap' }}>{a.nombre.split(' ')[0]}</button>
          ))}
        </div>
      )}

      {msg && <div style={{ padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16, background: msg.tipo === 'ok' ? '#F0FDF4' : '#FEF2F2', color: msg.tipo === 'ok' ? '#16A34A' : '#DC2626' }}>{msg.texto}</div>}

      {alumnoActual && (
        <div style={{ display: 'grid', gap: 12 }}>
          {/* estado tarjeta */}
          <div style={{ background: 'white', borderRadius: 16, padding: '1.25rem', border: '1px solid #F0F0F0' }}>
            <h2 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 14px' }}>Estado de la tarjeta</h2>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 500 }}>{alumnoActual.nombre}</p>
                <p style={{ margin: 0, fontSize: 12, color: '#999' }}>{alumnoActual.qr}</p>
              </div>
              <span style={{ fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 8, background: alumnoActual.activo ? '#F0FDF4' : '#FEF2F2', color: alumnoActual.activo ? '#16A34A' : '#DC2626' }}>
                {alumnoActual.activo ? 'Activa' : 'Bloqueada'}
              </span>
            </div>
            <button onClick={toggleBloqueo} style={{ width: '100%', padding: '12px', border: 'none', borderRadius: 10, background: alumnoActual.activo ? '#FEF2F2' : '#F0FDF4', color: alumnoActual.activo ? '#DC2626' : '#16A34A', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              {alumnoActual.activo ? '🔒 Bloquear tarjeta' : '🔓 Desbloquear tarjeta'}
            </button>
            {!alumnoActual.activo && (
              <p style={{ margin: '8px 0 0', fontSize: 12, color: '#DC2626', textAlign: 'center' }}>La tarjeta está bloqueada. No puede realizar compras.</p>
            )}
          </div>

          {/* límite diario */}
          <div style={{ background: 'white', borderRadius: 16, padding: '1.25rem', border: '1px solid #F0F0F0' }}>
            <h2 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 14px' }}>Límite de gasto diario</h2>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
              <span color='#666'>Gastado hoy</span>
              <span style={{ fontWeight: 600 }}>{fmt(alumnoActual.gasto_hoy)} / {fmt(alumnoActual.limite_diario)}</span>
            </div>
            <div style={{ height: 8, background: '#F0F0F0', borderRadius: 4, marginBottom: 14, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct2(alumnoActual.gasto_hoy, alumnoActual.limite_diario)}%`, background: pct2(alumnoActual.gasto_hoy, alumnoActual.limite_diario) > 80 ? '#DC2626' : '#111', borderRadius: 4, transition: 'width .3s' }} />
            </div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#555', marginBottom: 6 }}>Nuevo límite diario</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              {[300, 500, 1000].map(n => (
                <button key={n} onClick={() => setNuevoLimite(String(n))} style={{ flex: 1, padding: '9px', border: `1.5px solid ${nuevoLimite == n ? '#111' : '#F0F0F0'}`, borderRadius: 9, background: nuevoLimite == n ? '#111' : 'white', color: nuevoLimite == n ? 'white' : '#666', fontSize: 13, cursor: 'pointer' }}>{fmt(n)}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="number" placeholder="Otro monto" value={nuevoLimite} onChange={e => setNuevoLimite(e.target.value)} style={{ flex: 1 }} />
              <button onClick={guardarLimite} style={{ padding: '0 18px', border: 'none', borderRadius: 10, background: '#111', color: 'white', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>Guardar</button>
            </div>
          </div>

          {/* datos del alumno */}
          <div style={{ background: 'white', borderRadius: 16, padding: '1.25rem', border: '1px solid #F0F0F0' }}>
            <h2 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 14px' }}>Datos del alumno</h2>
            {[['Nombre', alumnoActual.nombre], ['Curso', alumnoActual.curso], ['Alergias', alumnoActual.alergias], ['Saldo', fmt(alumnoActual.saldo)], ['Límite diario', fmt(alumnoActual.limite_diario) + '/día']].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #F8F9FA', fontSize: 13 }}>
                <span style={{ color: '#666' }}>{k}</span>
                <span style={{ fontWeight: 500, color: k === 'Alergias' && v !== 'Ninguna' ? '#D97706' : '#111' }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}