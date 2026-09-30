import { useState, useEffect } from 'react'
import api from '../api/axios'
import { SkeletonTable } from '../components/Skeleton'
import ReglasCompra from '../components/ReglasCompra'
import AlergiasAlumno from '../components/AlergiasAlumno'
import AvisosFamilia from '../components/AvisosFamilia'

const fmt = n => `$${Number(n).toLocaleString('es-AR')}`
const pct2 = (a, b) => b ? Math.min(Math.round(a / b * 100), 100) : 0

export default function Control() {
  const [alumnos, setAlumnos] = useState([])
  const [alumnoId, setAlumnoId] = useState(null)
  const [nuevoLimite, setNuevoLimite] = useState('')
  const [cargando, setCargando] = useState(true)
  const [msg, setMsg] = useState(null)
  const [catalogoDe, setCatalogoDe] = useState({ id: null, datos: null })
  const catalogo = catalogoDe.id === alumnoId ? catalogoDe.datos : null

  const showMsg = (tipo, texto) => { setMsg({ tipo, texto }); setTimeout(() => setMsg(null), 3000) }

  useEffect(() => { cargar() }, [])

  // Productos, zonas y alérgenos del colegio del hijo elegido
  useEffect(() => {
    if (!alumnoId) return
    let vigente = true
    api.get(`/padres/alumnos/${alumnoId}/catalogo`).then(r => { if (vigente) setCatalogoDe({ id: alumnoId, datos: r.data }) }).catch(() => {})
    return () => { vigente = false }
  }, [alumnoId])

  const actualizarAlumno = datos => setAlumnos(prev => prev.map(a => a.id === datos.id ? { ...a, ...datos } : a))

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

  // Bloqueo general: ninguna compra, con ningún medio
  const toggleBloqueo = async () => {
    try {
      const res = await api.patch(`/padres/alumnos/${alumnoId}/toggle`)
      setAlumnos(prev => prev.map(a => a.id === alumnoId ? { ...a, ...res.data } : a))
      showMsg('ok', res.data.activo ? 'Compras habilitadas' : 'Todas las compras bloqueadas')
    } catch { showMsg('error', 'Error al cambiar estado') }
  }

  // Bloqueo de un solo medio: el QR de la credencial o la tarjeta/llavero
  const toggleMedio = async (medio, bloqueado) => {
    try {
      const res = await api.patch(`/padres/alumnos/${alumnoId}/medios`, { medio, bloqueado })
      setAlumnos(prev => prev.map(a => a.id === alumnoId ? { ...a, ...res.data } : a))
      const nombre = medio === 'qr' ? 'QR de la credencial' : 'Tarjeta'
      showMsg('ok', `${nombre} ${bloqueado ? 'bloqueado' : 'desbloqueado'}`)
    } catch { showMsg('error', 'Error al cambiar el estado') }
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

  if (cargando) return <SkeletonTable rows={5} cols={3} />
  if (alumnos.length === 0) return <div style={{ color: 'var(--text-tertiary)', padding: '1rem', fontSize: 14 }}>No tenés alumnos vinculados</div>

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 600, margin: '0 0 16px', color: 'var(--text)' }}>Control parental</h1>

      {alumnos.length > 1 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, overflowX: 'auto', paddingBottom: 4 }}>
          {alumnos.map(a => (
            <button key={a.id} onClick={() => setAlumnoId(a.id)} style={{ padding: '6px 14px', border: `1.5px solid ${alumnoId === a.id ? 'var(--brand)' : 'var(--border)'}`, borderRadius: 20, background: alumnoId === a.id ? 'var(--brand)' : 'var(--bg-card)', color: alumnoId === a.id ? 'white' : 'var(--text-secondary)', fontSize: 13, fontWeight: alumnoId === a.id ? 500 : 400, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              {a.nombre.split(' ')[0]}
            </button>
          ))}
        </div>
      )}

      {msg && (
        <div style={{ padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16, background: msg.tipo === 'ok' ? 'var(--green-bg)' : 'var(--red-bg)', color: msg.tipo === 'ok' ? 'var(--green)' : 'var(--red)', borderLeft: `3px solid ${msg.tipo === 'ok' ? 'var(--green)' : 'var(--red)'}` }}>
          {msg.texto}
        </div>
      )}

      {alumnoActual && (
        <div style={{ display: 'grid', gap: 12 }}>

          {/* medios de pago */}
          <div style={{ background: 'var(--bg-card)', borderRadius: 16, padding: '1.25rem', border: '1px solid var(--border)', boxShadow: 'var(--shadow)' }}>
            <h2 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 4px', color: 'var(--text)' }}>Medios de pago de {alumnoActual.nombre.split(' ')[0]}</h2>
            <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: '0 0 12px' }}>Si se pierde la credencial o la tarjeta, bloqueala acá: el resto sigue funcionando.</p>

            {[
              { medio: 'qr', titulo: 'Credencial con QR', detalle: 'La impresa o la del celular', bloqueado: alumnoActual.qr_bloqueado, disponible: true },
              { medio: 'tarjeta', titulo: 'Tarjeta o llavero', detalle: alumnoActual.nfc_uid ? 'La que se apoya en el lector' : 'Todavía no tiene una asignada', bloqueado: alumnoActual.tarjeta_bloqueada, disponible: !!alumnoActual.nfc_uid },
            ].map(m => (
              <div key={m.medio} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '10px 0', borderTop: '1px solid var(--border-light)', opacity: m.disponible ? 1 : 0.6 }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>{m.titulo}</p>
                  <p style={{ margin: 0, fontSize: 12, color: m.bloqueado ? 'var(--red)' : 'var(--text-tertiary)' }}>{m.bloqueado ? 'Bloqueado: no se puede pagar con este medio' : m.detalle}</p>
                </div>
                {m.disponible && (
                  <button onClick={() => toggleMedio(m.medio, !m.bloqueado)} style={{ flexShrink: 0, padding: '8px 12px', border: 'none', borderRadius: 10, background: m.bloqueado ? 'var(--green-bg)' : 'var(--red-bg)', color: m.bloqueado ? 'var(--green)' : 'var(--red)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    {m.bloqueado ? '🔓 Desbloquear' : '🔒 Bloquear'}
                  </button>
                )}
              </div>
            ))}

            <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: 12, marginTop: 2 }}>
              <button onClick={toggleBloqueo} style={{ width: '100%', padding: '12px', border: 'none', borderRadius: 10, background: alumnoActual.activo ? 'var(--red-bg)' : 'var(--green-bg)', color: alumnoActual.activo ? 'var(--red)' : 'var(--green)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                {alumnoActual.activo ? '🔒 Bloquear todas las compras' : '🔓 Habilitar las compras'}
              </button>
              {!alumnoActual.activo && (
                <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--red)', textAlign: 'center' }}>Todas las compras están bloqueadas, con cualquier medio.</p>
              )}
            </div>
          </div>

          {/* límite diario */}
          <div style={{ background: 'var(--bg-card)', borderRadius: 16, padding: '1.25rem', border: '1px solid var(--border)', boxShadow: 'var(--shadow)' }}>
            <h2 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 14px', color: 'var(--text)' }}>Límite de gasto diario</h2>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6, color: 'var(--text-secondary)' }}>
              <span>Gastado hoy</span>
              <span style={{ fontWeight: 600, color: 'var(--text)' }}>{fmt(alumnoActual.gasto_hoy)} / {fmt(alumnoActual.limite_diario)}</span>
            </div>
            <div style={{ height: 8, background: 'var(--bg)', borderRadius: 4, marginBottom: 14, overflow: 'hidden', border: '1px solid var(--border)' }}>
              <div style={{ height: '100%', width: `${pct2(alumnoActual.gasto_hoy, alumnoActual.limite_diario)}%`, background: pct2(alumnoActual.gasto_hoy, alumnoActual.limite_diario) > 80 ? 'var(--red)' : 'var(--brand)', borderRadius: 4, transition: 'width .3s' }} />
            </div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.5px' }}>Nuevo límite diario</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              {[300, 500, 1000].map(n => (
                <button key={n} onClick={() => setNuevoLimite(String(n))} style={{ flex: 1, padding: '9px', border: `1.5px solid ${nuevoLimite == n ? 'var(--brand)' : 'var(--border)'}`, borderRadius: 9, background: nuevoLimite == n ? 'var(--brand)' : 'var(--bg-card)', color: nuevoLimite == n ? 'white' : 'var(--text-secondary)', fontSize: 13, cursor: 'pointer' }}>
                  {fmt(n)}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="number" placeholder="Otro monto" value={nuevoLimite} onChange={e => setNuevoLimite(e.target.value)} style={{ flex: 1 }} />
              <button onClick={guardarLimite} style={{ padding: '0 18px', border: 'none', borderRadius: 10, background: 'var(--brand)', color: 'white', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>Guardar</button>
            </div>
          </div>

          {catalogo && <ReglasCompra key={`reglas-${alumnoActual.id}`} alumno={alumnoActual} catalogo={catalogo} onGuardado={actualizarAlumno} showMsg={showMsg} />}
          {catalogo && <AlergiasAlumno key={`alergias-${alumnoActual.id}`} alumno={alumnoActual} alergenos={catalogo.alergenos} onGuardado={actualizarAlumno} showMsg={showMsg} />}

          {/* datos del alumno */}
          <div style={{ background: 'var(--bg-card)', borderRadius: 16, padding: '1.25rem', border: '1px solid var(--border)', boxShadow: 'var(--shadow)' }}>
            <h2 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 14px', color: 'var(--text)' }}>Datos del alumno</h2>
            {[
              ['Nombre', alumnoActual.nombre],
              ['Curso', alumnoActual.curso],
              ['Alergias', (alumnoActual.alergenos || []).length && catalogo
                ? alumnoActual.alergenos.map(a => catalogo.alergenos[a] || a).join(', ')
                : alumnoActual.alergias],
              ['Saldo', fmt(alumnoActual.saldo)],
              ['Límite diario', fmt(alumnoActual.limite_diario) + '/día']
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-light)', fontSize: 13 }}>
                <span style={{ color: 'var(--text-secondary)' }}>{k}</span>
                <span style={{ fontWeight: 500, color: k === 'Alergias' && v !== 'Ninguna' ? 'var(--amber)' : 'var(--text)' }}>{v}</span>
              </div>
            ))}
          </div>

          <AvisosFamilia showMsg={showMsg} />

        </div>
      )}
    </div>
  )
}