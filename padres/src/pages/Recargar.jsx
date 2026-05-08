import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/axios'

const fmt = n => `$${Number(n).toLocaleString('es-AR')}`

export default function Recargar() {
  const navigate = useNavigate()
  const [alumnos, setAlumnos] = useState([])
  const [alumnoId, setAlumnoId] = useState(null)
  const [monto, setMonto] = useState('')
  const [cargando, setCargando] = useState(true)
  const [procesando, setProcesando] = useState(false)
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

  const recargar = async () => {
    const n = parseInt(monto)
    if (!n || n <= 0) return
    setProcesando(true)
    try {
      await api.post('/padres/alumnos/recargar', { alumno_id: alumnoId, monto: n })
      showMsg('ok', `Se cargaron ${fmt(n)} correctamente`)
      setMonto('')
      cargar()
    } catch (err) {
      showMsg('error', err.response?.data?.error || 'Error al recargar')
    } finally {
      setProcesando(false)
    }
  }

  const alumnoActual = alumnos.find(a => a.id === alumnoId)

  if (cargando) return <div style={{ color: '#999' }}>Cargando...</div>
  if (alumnos.length === 0) return <div style={{ color: '#999', padding: '1rem' }}>No tenés alumnos vinculados</div>

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 600, margin: '0 0 16px' }}>Recargar saldo</h1>

      {/* selector alumno */}
      {alumnos.length > 1 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, overflowX: 'auto', paddingBottom: 4 }}>
          {alumnos.map(a => (
            <button key={a.id} onClick={() => setAlumnoId(a.id)} style={{ padding: '6px 14px', border: `1.5px solid ${alumnoId === a.id ? '#111' : '#F0F0F0'}`, borderRadius: 20, background: alumnoId === a.id ? '#111' : 'white', color: alumnoId === a.id ? 'white' : '#666', fontSize: 13, fontWeight: alumnoId === a.id ? 500 : 400, cursor: 'pointer', whiteSpace: 'nowrap' }}>{a.nombre.split(' ')[0]}</button>
          ))}
        </div>
      )}

      {/* saldo actual */}
      {alumnoActual && (
        <div style={{ background: parseFloat(alumnoActual.saldo) < 200 ? '#FEF2F2' : '#F0FDF4', borderRadius: 16, padding: '1.25rem', marginBottom: 20, border: `1px solid ${parseFloat(alumnoActual.saldo) < 200 ? '#FECACA' : '#BBF7D0'}` }}>
          <p style={{ margin: '0 0 4px', fontSize: 13, color: '#666' }}>Saldo actual de {alumnoActual.nombre.split(' ')[0]}</p>
          <p style={{ margin: 0, fontSize: 32, fontWeight: 700, color: parseFloat(alumnoActual.saldo) < 200 ? '#DC2626' : '#16A34A' }}>{fmt(alumnoActual.saldo)}</p>
        </div>
      )}

      <div style={{ background: 'white', borderRadius: 16, padding: '1.5rem', border: '1px solid #F0F0F0' }}>
        <p style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 500 }}>¿Cuánto querés cargar?</p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
          {[500, 1000, 2000, 5000].map(n => (
            <button key={n} onClick={() => setMonto(String(n))} style={{ padding: '14px', border: `2px solid ${monto == n ? '#111' : '#F0F0F0'}`, borderRadius: 12, background: monto == n ? '#111' : 'white', color: monto == n ? 'white' : '#666', fontSize: 16, fontWeight: monto == n ? 600 : 400, cursor: 'pointer' }}>{fmt(n)}</button>
          ))}
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#555', marginBottom: 6 }}>Otro monto</label>
          <input type="number" placeholder="Ingresá el monto" value={monto} onChange={e => setMonto(e.target.value)} />
        </div>

        {monto && parseInt(monto) > 0 && (
          <div style={{ padding: '10px 14px', background: '#F8F9FA', borderRadius: 10, marginBottom: 14, fontSize: 13, color: '#666' }}>
            Nuevo saldo: <b style={{ color: '#111' }}>{fmt((parseFloat(alumnoActual?.saldo) || 0) + parseInt(monto))}</b>
          </div>
        )}

        {msg && <div style={{ padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 14, background: msg.tipo === 'ok' ? '#F0FDF4' : '#FEF2F2', color: msg.tipo === 'ok' ? '#16A34A' : '#DC2626' }}>{msg.texto}</div>}

        <button onClick={recargar} disabled={!monto || parseInt(monto) <= 0 || procesando} style={{ width: '100%', padding: '14px', border: 'none', borderRadius: 12, background: !monto || parseInt(monto) <= 0 ? '#F0F0F0' : '#111', color: !monto || parseInt(monto) <= 0 ? '#999' : 'white', fontSize: 15, fontWeight: 600, cursor: !monto || parseInt(monto) <= 0 ? 'not-allowed' : 'pointer' }}>
          {procesando ? 'Procesando...' : `Recargar ${monto && parseInt(monto) > 0 ? fmt(parseInt(monto)) : ''}`}
        </button>
      </div>
    </div>
  )
}