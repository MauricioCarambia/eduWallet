import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api/axios'

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

  const showMsg = (tipo, texto) => { setMsg({ tipo, texto }); setTimeout(() => setMsg(null), 3000) }

  useEffect(() => { cargar() }, [])

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

  if (cargando) return <div style={{ color: '#999', padding: '1rem' }}>Cargando...</div>

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, margin: '0 0 4px' }}>Hola, {padre?.nombre.split(' ')[0]}</h1>
        <p style={{ color: '#999', fontSize: 13, margin: 0 }}>
          {alumnos.length === 0 ? 'Vinculá a tus hijos para comenzar' : `${alumnos.length} alumno${alumnos.length > 1 ? 's' : ''} vinculado${alumnos.length > 1 ? 's' : ''}`}
        </p>
      </div>

      {msg && <div style={{ padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16, background: msg.tipo === 'ok' ? '#F0FDF4' : '#FEF2F2', color: msg.tipo === 'ok' ? '#16A34A' : '#DC2626' }}>{msg.texto}</div>}

      {alumnos.length === 0 ? (
        <div style={{ background: 'white', borderRadius: 16, padding: '2rem', textAlign: 'center', border: '1px solid #F0F0F0' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#F8F9FA', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
          </div>
          <p style={{ fontSize: 15, fontWeight: 500, marginBottom: 6 }}>Sin alumnos vinculados</p>
          <p style={{ fontSize: 13, color: '#999', marginBottom: 16 }}>Vinculá a tu hijo/a para ver su saldo y movimientos</p>
          <button onClick={() => { setModalVincular(true); buscarAlumnos() }} style={{ padding: '10px 20px', border: 'none', borderRadius: 10, background: '#111', color: 'white', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
            + Vincular alumno
          </button>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gap: 12, marginBottom: 16 }}>
            {alumnos.map(a => (
              <div key={a.id} style={{ background: 'white', borderRadius: 16, padding: '1.25rem', border: '1px solid #F0F0F0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 14, background: '#F8F9FA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: '#666', flexShrink: 0 }}>
                    {a.nombre.split(' ').slice(0, 2).map(n => n[0]).join('')}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{a.nombre}</p>
                    <p style={{ margin: 0, fontSize: 12, color: '#999' }}>{a.curso} · {a.relacion}</p>
                  </div>
                  <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, background: a.activo ? '#F0FDF4' : '#FEF2F2', color: a.activo ? '#16A34A' : '#DC2626', fontWeight: 500 }}>
                    {a.activo ? 'Activa' : 'Bloqueada'}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
                  <div style={{ background: parseFloat(a.saldo) < 200 ? '#FEF2F2' : '#F0FDF4', borderRadius: 10, padding: '10px 12px' }}>
                    <p style={{ margin: '0 0 2px', fontSize: 11, color: '#666' }}>Saldo disponible</p>
                    <p style={{ margin: 0, fontSize: 20, fontWeight: 700, color: parseFloat(a.saldo) < 200 ? '#DC2626' : '#16A34A' }}>{fmt(a.saldo)}</p>
                  </div>
                  <div style={{ background: '#F8F9FA', borderRadius: 10, padding: '10px 12px' }}>
                    <p style={{ margin: '0 0 2px', fontSize: 11, color: '#666' }}>Gastado hoy</p>
                    <p style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{fmt(a.gasto_hoy)}</p>
                  </div>
                </div>

                {parseFloat(a.saldo) < 200 && (
                  <div style={{ padding: '8px 12px', background: '#FEF2F2', borderRadius: 8, fontSize: 13, color: '#DC2626', marginBottom: 12 }}>
                    ⚠ Saldo bajo — recargá para evitar inconvenientes
                  </div>
                )}

                {a.alergias !== 'Ninguna' && (
                  <div style={{ padding: '8px 12px', background: '#FFF7ED', borderRadius: 8, fontSize: 13, color: '#D97706', marginBottom: 12 }}>
                    ⚠ Alergia registrada: {a.alergias}
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <button onClick={() => navigate('/recargar')} style={{ padding: '10px', border: 'none', borderRadius: 10, background: '#111', color: 'white', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>Recargar saldo</button>
                  <button onClick={() => navigate('/historial')} style={{ padding: '10px', border: '1px solid #F0F0F0', borderRadius: 10, background: 'white', fontSize: 13, color: '#666', cursor: 'pointer' }}>Ver historial</button>
                </div>
              </div>
            ))}
          </div>
          <button onClick={() => { setModalVincular(true); buscarAlumnos() }} style={{ width: '100%', padding: '12px', border: '1.5px dashed #E5E7EB', borderRadius: 12, background: 'white', fontSize: 14, color: '#999', cursor: 'pointer' }}>
            + Vincular otro alumno
          </button>
        </>
      )}

      {/* modal vincular */}
      {modalVincular && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'white', borderRadius: '20px 20px 0 0', padding: '1.5rem', width: '100%', maxWidth: 480, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Vincular alumno</h2>
              <button onClick={() => setModalVincular(false)} style={{ background: 'none', border: 'none', fontSize: 22, color: '#999', cursor: 'pointer' }}>×</button>
            </div>
            <input placeholder="Buscar por nombre o curso..." value={busqAlumno} onChange={e => setBusqAlumno(e.target.value)} style={{ marginBottom: 12 }} autoFocus />
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {alumnosFiltrados.map(a => {
                const yaVinculado = alumnos.some(x => x.id === a.id)
                return (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid #F8F9FA' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: '#F8F9FA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#666', flexShrink: 0 }}>
                      {a.nombre.split(' ').slice(0, 2).map(n => n[0]).join('')}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 500 }}>{a.nombre}</p>
                      <p style={{ margin: 0, fontSize: 12, color: '#999' }}>{a.curso}</p>
                    </div>
                    <button onClick={() => !yaVinculado && vincular(a.id)} disabled={yaVinculado} style={{ padding: '6px 14px', border: 'none', borderRadius: 8, background: yaVinculado ? '#F0F0F0' : '#111', color: yaVinculado ? '#999' : 'white', fontSize: 12, fontWeight: 500, cursor: yaVinculado ? 'not-allowed' : 'pointer' }}>
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