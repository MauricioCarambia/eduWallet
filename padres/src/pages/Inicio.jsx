import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { SkeletonCards, SkeletonTable } from '../components/Skeleton'
import api from '../api/axios'
import { pushSoportado, obtenerSuscripcionActual, activarPush } from '../utils/push'

const fmt = n => `$${Number(n).toLocaleString('es-AR')}`

export default function Inicio() {
  const { padre } = useAuth()
  const navigate = useNavigate()
  const [alumnos, setAlumnos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [modalVincular, setModalVincular] = useState(false)
  const [todosAlumnos, setTodosAlumnos] = useState([])
  const [busqAlumno, setBusqAlumno] = useState('')
  const [msg, setMsg] = useState(null)
  const [mostrarPush, setMostrarPush] = useState(false)
  const [activandoPush, setActivandoPush] = useState(false)

  const showMsg = (tipo, texto) => { setMsg({ tipo, texto }); setTimeout(() => setMsg(null), 3000) }

  useEffect(() => { cargar() }, [])

  useEffect(() => {
    (async () => {
      if (!pushSoportado()) return
      if (Notification.permission === 'denied') return
      if (localStorage.getItem('push_descartado') === '1') return
      const sub = await obtenerSuscripcionActual()
      if (!sub) setMostrarPush(true)
    })()
  }, [])

  const habilitarPush = async () => {
    setActivandoPush(true)
    try {
      await activarPush()
      setMostrarPush(false)
      showMsg('ok', 'Notificaciones activadas correctamente')
    } catch (err) {
      showMsg('error', err.message || 'No se pudieron activar las notificaciones')
    } finally {
      setActivandoPush(false)
    }
  }

  const descartarPush = () => {
    localStorage.setItem('push_descartado', '1')
    setMostrarPush(false)
  }

  const cargar = async () => {
    try {
      const res = await api.get('/padres/alumnos')
      setAlumnos(res.data)
    } catch (err) {
      console.error(err)
    } finally {
      setCargando(false)
    }
  }

  const buscarAlumnos = async () => {
    try {
      const res = await api.get('/alumnos')
      setTodosAlumnos(res.data)
    } catch (err) { console.error(err) }
  }

  const vincular = async (alumno_id) => {
    try {
      await api.post('/padres/alumnos/vincular', { alumno_id, relacion: 'tutor' })
      showMsg('ok', 'Alumno vinculado correctamente')
      setModalVincular(false)
      cargar()
    } catch (err) {
      showMsg('error', err.response?.data?.error || 'Error al vincular')
    }
  }

  const alumnosFiltrados = todosAlumnos.filter(a =>
    a.nombre.toLowerCase().includes(busqAlumno.toLowerCase()) ||
    a.curso.toLowerCase().includes(busqAlumno.toLowerCase())
  )

  if (cargando) return <div><SkeletonCards count={2} /><SkeletonTable rows={5} cols={3} /></div>

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, margin: '0 0 4px', color: 'var(--text)' }}>Hola, {padre?.nombre.split(' ')[0]}</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: 0 }}>
          {alumnos.length === 0 ? 'Vinculá a tus hijos para comenzar' : `${alumnos.length} alumno${alumnos.length > 1 ? 's' : ''} vinculado${alumnos.length > 1 ? 's' : ''}`}
        </p>
      </div>

      {msg && (
        <div style={{ padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16, background: msg.tipo === 'ok' ? 'var(--green-bg)' : 'var(--red-bg)', color: msg.tipo === 'ok' ? 'var(--green)' : 'var(--red)', borderLeft: `3px solid ${msg.tipo === 'ok' ? 'var(--green)' : 'var(--red)'}` }}>
          {msg.texto}
        </div>
      )}

      {mostrarPush && (
        <div style={{ background: 'var(--bg-card)', borderRadius: 14, padding: '14px 16px', marginBottom: 16, border: '1px solid var(--border)', boxShadow: 'var(--shadow)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--brand-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="2"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ margin: '0 0 2px', fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Activar notificaciones</p>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>Enterate al instante de recargas, compras y saldo bajo.</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button onClick={habilitarPush} disabled={activandoPush} style={{ padding: '6px 12px', border: 'none', borderRadius: 8, background: 'var(--brand)', color: 'white', fontSize: 12, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap', opacity: activandoPush ? 0.7 : 1 }}>
              {activandoPush ? 'Activando...' : 'Activar'}
            </button>
            <button onClick={descartarPush} style={{ padding: '4px 12px', border: 'none', background: 'none', color: 'var(--text-tertiary)', fontSize: 11, cursor: 'pointer' }}>
              Ahora no
            </button>
          </div>
        </div>
      )}

      {alumnos.length === 0 ? (
        <div style={{ background: 'var(--bg-card)', borderRadius: 16, padding: '2rem', textAlign: 'center', border: '1px solid var(--border)', boxShadow: 'var(--shadow)' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
          </div>
          <p style={{ fontSize: 15, fontWeight: 500, marginBottom: 6, color: 'var(--text)' }}>Sin alumnos vinculados</p>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>Vinculá a tu hijo/a para ver su saldo y movimientos</p>
          <button onClick={() => { setModalVincular(true); buscarAlumnos() }} style={{ padding: '10px 20px', border: 'none', borderRadius: 10, background: 'var(--brand)', color: 'white', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
            + Vincular alumno
          </button>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gap: 12, marginBottom: 16 }}>
            {alumnos.map(a => (
              <div key={a.id} style={{ background: 'var(--bg-card)', borderRadius: 16, padding: '1.25rem', border: '1px solid var(--border)', boxShadow: 'var(--shadow)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 14, background: 'var(--brand-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: 'var(--brand)', flexShrink: 0 }}>
                    {a.nombre.split(' ').slice(0, 2).map(n => n[0]).join('')}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{a.nombre}</p>
                    <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>{a.curso} · {a.relacion}</p>
                  </div>
                  <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, background: a.activo ? 'var(--green-bg)' : 'var(--red-bg)', color: a.activo ? 'var(--green)' : 'var(--red)', fontWeight: 500 }}>
                    {a.activo ? 'Activa' : 'Bloqueada'}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
                  <div style={{ background: parseFloat(a.saldo) < 200 ? 'var(--red-bg)' : 'var(--green-bg)', borderRadius: 10, padding: '10px 12px' }}>
                    <p style={{ margin: '0 0 2px', fontSize: 11, color: 'var(--text-secondary)' }}>Saldo disponible</p>
                    <p style={{ margin: 0, fontSize: 20, fontWeight: 700, color: parseFloat(a.saldo) < 200 ? 'var(--red)' : 'var(--green)' }}>{fmt(a.saldo)}</p>
                  </div>
                  <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '10px 12px' }}>
                    <p style={{ margin: '0 0 2px', fontSize: 11, color: 'var(--text-secondary)' }}>Gastado hoy</p>
                    <p style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>{fmt(a.gasto_hoy)}</p>
                  </div>
                </div>

                {parseFloat(a.saldo) < 200 && (
                  <div style={{ padding: '8px 12px', background: 'var(--red-bg)', borderRadius: 8, fontSize: 13, color: 'var(--red)', marginBottom: 12, borderLeft: '3px solid var(--red)' }}>
                    ⚠ Saldo bajo — recargá para evitar inconvenientes
                  </div>
                )}

                {a.alergias !== 'Ninguna' && (
                  <div style={{ padding: '8px 12px', background: 'var(--amber-bg)', borderRadius: 8, fontSize: 13, color: 'var(--amber)', marginBottom: 12, borderLeft: '3px solid var(--amber)' }}>
                    ⚠ Alergia registrada: {a.alergias}
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <button onClick={() => navigate('/recargar')} style={{ padding: '10px', border: 'none', borderRadius: 10, background: 'var(--brand)', color: 'white', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>Recargar saldo</button>
                  <button onClick={() => navigate('/historial')} style={{ padding: '10px', border: '1.5px solid var(--border)', borderRadius: 10, background: 'var(--bg-card)', fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>Ver historial</button>
                </div>
              </div>
            ))}
          </div>
          <button onClick={() => { setModalVincular(true); buscarAlumnos() }} style={{ width: '100%', padding: '12px', border: '1.5px dashed var(--border)', borderRadius: 12, background: 'var(--bg-card)', fontSize: 14, color: 'var(--text-secondary)', cursor: 'pointer' }}>
            + Vincular otro alumno
          </button>
        </>
      )}

      {modalVincular && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: '20px 20px 0 0', padding: '1.5rem', width: '100%', maxWidth: 480, maxHeight: '80vh', display: 'flex', flexDirection: 'column', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>Vincular alumno</h2>
              <button onClick={() => setModalVincular(false)} style={{ background: 'none', border: 'none', fontSize: 22, color: 'var(--text-tertiary)', cursor: 'pointer' }}>×</button>
            </div>
            <input placeholder="Buscar por nombre o curso..." value={busqAlumno} onChange={e => setBusqAlumno(e.target.value)} style={{ marginBottom: 12 }} autoFocus />
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {alumnosFiltrados.map(a => {
                const yaVinculado = alumnos.some(x => x.id === a.id)
                return (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--border-light)' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', flexShrink: 0 }}>
                      {a.nombre.split(' ').slice(0, 2).map(n => n[0]).join('')}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>{a.nombre}</p>
                      <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>{a.curso}</p>
                    </div>
                    <button onClick={() => !yaVinculado && vincular(a.id)} disabled={yaVinculado}
                      style={{ padding: '6px 14px', border: 'none', borderRadius: 8, background: yaVinculado ? 'var(--bg)' : 'var(--brand)', color: yaVinculado ? 'var(--text-tertiary)' : 'white', fontSize: 12, fontWeight: 500, cursor: yaVinculado ? 'not-allowed' : 'pointer' }}>
                      {yaVinculado ? 'Vinculado' : 'Vincular'}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}