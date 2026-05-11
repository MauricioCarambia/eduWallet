import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import api from '../api/axios'

const fmt = n => `$${Number(n).toLocaleString('es-AR')}`

export default function Recargar() {
  const [alumnos, setAlumnos] = useState([])
  const [alumnoId, setAlumnoId] = useState(null)
  const [monto, setMonto] = useState('')
  const [cargando, setCargando] = useState(true)
  const [procesando, setProcesando] = useState(false)
  const [paso, setPaso] = useState('monto')
  const [msg, setMsg] = useState(null)
  const [searchParams] = useSearchParams()

  const showMsg = (tipo, texto) => { setMsg({ tipo, texto }); setTimeout(() => setMsg(null), 6000) }

  useEffect(() => { cargar() }, [])

  useEffect(() => {
    const status = searchParams.get('status')
    const paymentId = searchParams.get('payment_id')
    const alumno = searchParams.get('alumno')
    const montoParam = searchParams.get('monto')

    if (status === 'success' && paymentId) {
      verificarPago(paymentId, alumno, montoParam)
    } else if (status === 'failure') {
      showMsg('error', 'El pago fue rechazado. Intentá de nuevo.')
    } else if (status === 'pending') {
      showMsg('warn', 'El pago está pendiente. Te avisaremos cuando se acredite.')
    }
  }, [searchParams])

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

  const verificarPago = async (paymentId, alumnoId, monto) => {
    try {
      const res = await api.get(`/pagos/verificar?payment_id=${paymentId}&alumno_id=${alumnoId}&monto=${monto}`)
      if (res.data.status === 'approved') {
        setPaso('exito')
        cargar()
      }
    } catch (err) {
      console.error(err)
    }
  }

  const iniciarPago = async () => {
    const n = parseInt(monto)
    if (!n || n <= 0 || !alumnoId) return
    setProcesando(true)
    try {
      const res = await api.post('/pagos/preferencia', { monto: n, alumno_id: alumnoId })
      window.location.href = res.data.init_point
    } catch (err) {
      showMsg('error', err.response?.data?.error || 'Error al iniciar el pago')
      setProcesando(false)
    }
  }

  const alumnoActual = alumnos.find(a => a.id === alumnoId)

  if (cargando) return <div style={{ color: '#999', padding: '1rem' }}>Cargando...</div>
  if (alumnos.length === 0) return <div style={{ color: '#999', padding: '1rem' }}>No tenés alumnos vinculados</div>

  if (paso === 'exito') return (
    <div style={{ textAlign: 'center', padding: '2rem' }}>
      <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
      <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 8 }}>¡Recarga exitosa!</h2>
      <p style={{ fontSize: 14, color: '#666', marginBottom: 8 }}>El saldo fue acreditado correctamente.</p>
      <p style={{ fontSize: 28, fontWeight: 700, color: '#16A34A', marginBottom: 24 }}>{fmt(alumnoActual?.saldo || 0)}</p>
      <button onClick={() => { setPaso('monto'); setMonto('') }} style={{ padding: '12px 28px', border: 'none', borderRadius: 10, background: '#111', color: 'white', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
        Volver
      </button>
    </div>
  )

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
        <div style={{ background: parseFloat(alumnoActual.saldo) < 200 ? '#FEF2F2' : '#F0FDF4', borderRadius: 14, padding: '1rem 1.25rem', marginBottom: 20, border: `1px solid ${parseFloat(alumnoActual.saldo) < 200 ? '#FECACA' : '#BBF7D0'}` }}>
          <p style={{ margin: '0 0 4px', fontSize: 13, color: '#666' }}>Saldo de {alumnoActual.nombre.split(' ')[0]}</p>
          <p style={{ margin: 0, fontSize: 32, fontWeight: 700, color: parseFloat(alumnoActual.saldo) < 200 ? '#DC2626' : '#16A34A' }}>{fmt(alumnoActual.saldo)}</p>
          {parseFloat(alumnoActual.saldo) < 200 && (
            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#DC2626' }}>Saldo bajo — recargá para evitar inconvenientes</p>
          )}
        </div>
      )}

      {msg && (
        <div style={{ padding: '12px 16px', borderRadius: 10, fontSize: 14, marginBottom: 16, background: msg.tipo === 'ok' ? '#F0FDF4' : msg.tipo === 'warn' ? '#FFF7ED' : '#FEF2F2', color: msg.tipo === 'ok' ? '#16A34A' : msg.tipo === 'warn' ? '#D97706' : '#DC2626', fontWeight: 500 }}>
          {msg.texto}
        </div>
      )}

      <div style={{ background: 'white', borderRadius: 16, padding: '1.5rem', border: '1px solid #F0F0F0' }}>
        <p style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 500 }}>¿Cuánto querés cargar?</p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          {[500, 1000, 2000, 5000].map(n => (
            <button key={n} onClick={() => setMonto(String(n))} style={{ padding: '16px', border: `2px solid ${monto == n ? '#111' : '#F0F0F0'}`, borderRadius: 14, background: monto == n ? '#111' : 'white', color: monto == n ? 'white' : '#666', fontSize: 18, fontWeight: monto == n ? 700 : 400, cursor: 'pointer', transition: 'all .15s' }}>
              {fmt(n)}
            </button>
          ))}
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#555', marginBottom: 6 }}>Otro monto</label>
          <input type="number" placeholder="Ingresá el monto" value={monto} onChange={e => setMonto(e.target.value)} />
        </div>

        {monto && parseInt(monto) > 0 && alumnoActual && (
          <div style={{ padding: '10px 14px', background: '#F8F9FA', borderRadius: 10, marginBottom: 16, fontSize: 13, color: '#666' }}>
            Nuevo saldo estimado: <b style={{ color: '#111', fontSize: 15 }}>{fmt(parseFloat(alumnoActual.saldo) + parseInt(monto))}</b>
          </div>
        )}

        <button onClick={iniciarPago} disabled={!monto || parseInt(monto) <= 0 || procesando}
          style={{ width: '100%', padding: '16px', border: 'none', borderRadius: 14, background: !monto || parseInt(monto) <= 0 ? '#F0F0F0' : '#009EE3', color: !monto || parseInt(monto) <= 0 ? '#999' : 'white', fontSize: 16, fontWeight: 700, cursor: !monto || parseInt(monto) <= 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, transition: 'opacity .15s' }}>
          {procesando ? (
            'Redirigiendo a Mercado Pago...'
          ) : (
            <>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>
              Pagar con Mercado Pago
            </>
          )}
        </button>

        <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
          <span style={{ fontSize: 12, color: '#999' }}>Pago seguro con Mercado Pago</span>
        </div>
        <p style={{ fontSize: 11, color: '#bbb', textAlign: 'center', marginTop: 6 }}>
          Aceptamos tarjeta de crédito, débito, transferencia y saldo MP
        </p>
      </div>
    </div>
  )
}