import { useState, useEffect, useRef } from 'react'
import api from '../api/axios'

const fmt = n => `$${Number(n).toLocaleString('es-AR')}`

export default function Recargar() {
  const [alumnos, setAlumnos] = useState([])
  const [alumnoId, setAlumnoId] = useState(null)
  const [monto, setMonto] = useState('')
  const [cargando, setCargando] = useState(true)
  const [paso, setPaso] = useState('monto') // 'monto' | 'pago' | 'exito'
  const [msg, setMsg] = useState(null)
  const [preferenceId, setPreferenceId] = useState(null)
  const [publicKey, setPublicKey] = useState(null)
  const bricksRef = useRef(null)
  const controllerRef = useRef(null)

  const showMsg = (tipo, texto) => { setMsg({ tipo, texto }); setTimeout(() => setMsg(null), 5000) }

  useEffect(() => { cargar() }, [])

  useEffect(() => {
    if (paso === 'pago' && preferenceId && publicKey) {
      cargarBricks()
    }
    return () => {
      if (controllerRef.current) {
        controllerRef.current.unmount()
        controllerRef.current = null
      }
    }
  }, [paso, preferenceId, publicKey])

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

  const cargarBricks = async () => {
    if (!window.MercadoPago) {
      const script = document.createElement('script')
      script.src = 'https://sdk.mercadopago.com/js/v2'
      script.onload = () => initBricks()
      document.head.appendChild(script)
    } else {
      initBricks()
    }
  }

const initBricks = async () => {
  if (controllerRef.current) {
    controllerRef.current.unmount()
    controllerRef.current = null
  }

  const mp = new window.MercadoPago(publicKey, { locale: 'es-AR' })
  const bricksBuilder = mp.bricks()

  controllerRef.current = await bricksBuilder.create('cardPayment', 'wallet_container', {
    initialization: {
      amount: parseInt(monto),
      payer: { email: '' }
    },
    customization: {
      visual: { style: { theme: 'default' } },
      paymentMethods: { maxInstallments: 1 }
    },
    callbacks: {
      onReady: () => console.log('Brick listo'),
      onError: err => { console.error(err); showMsg('error', 'Error al cargar el formulario') },
      onSubmit: async (cardFormData) => {
        try {
          const res = await api.post('/pagos/procesar', {
            ...cardFormData,
            monto: parseInt(monto),
            alumno_id: alumnoId,
            email: cardFormData.payer.email
          })
          if (res.data.status === 'approved') {
            await cargar()
            setPaso('exito')
          } else if (res.data.status === 'pending') {
            showMsg('warn', 'Pago pendiente de acreditación')
          } else {
            showMsg('error', 'Pago rechazado. Intentá con otra tarjeta.')
          }
        } catch (err) {
          showMsg('error', err.response?.data?.error || 'Error al procesar el pago')
        }
      }
    }
  })
}

const iniciarPago = async () => {
  const n = parseInt(monto)
  if (!n || n <= 0 || !alumnoId) return
  setPublicKey('TEST-d6a03f1a-d496-476c-beac-2ff87d8c947a')
  setPaso('pago')
}

  const alumnoActual = alumnos.find(a => a.id === alumnoId)

  if (cargando) return <div style={{ color: '#999' }}>Cargando...</div>
  if (alumnos.length === 0) return <div style={{ color: '#999', padding: '1rem' }}>No tenés alumnos vinculados</div>

  if (paso === 'exito') return (
    <div style={{ textAlign: 'center', padding: '2rem' }}>
      <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
      <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>¡Recarga exitosa!</h2>
      <p style={{ fontSize: 14, color: '#666', marginBottom: 20 }}>El saldo fue acreditado correctamente.</p>
      <button onClick={() => { setPaso('monto'); setMonto(''); cargar() }} style={{ padding: '12px 24px', border: 'none', borderRadius: 10, background: '#111', color: 'white', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
        Volver
      </button>
    </div>
  )

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        {paso === 'pago' && <button onClick={() => setPaso('monto')} style={{ background: 'none', border: 'none', fontSize: 20, color: '#666', cursor: 'pointer' }}>←</button>}
        <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>{paso === 'monto' ? 'Recargar saldo' : 'Confirmar pago'}</h1>
      </div>

      {/* selector alumno */}
      {alumnos.length > 1 && paso === 'monto' && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, overflowX: 'auto', paddingBottom: 4 }}>
          {alumnos.map(a => (
            <button key={a.id} onClick={() => setAlumnoId(a.id)} style={{ padding: '6px 14px', border: `1.5px solid ${alumnoId === a.id ? '#111' : '#F0F0F0'}`, borderRadius: 20, background: alumnoId === a.id ? '#111' : 'white', color: alumnoId === a.id ? 'white' : '#666', fontSize: 13, fontWeight: alumnoId === a.id ? 500 : 400, cursor: 'pointer', whiteSpace: 'nowrap' }}>{a.nombre.split(' ')[0]}</button>
          ))}
        </div>
      )}

      {/* saldo actual */}
      {alumnoActual && (
        <div style={{ background: parseFloat(alumnoActual.saldo) < 200 ? '#FEF2F2' : '#F0FDF4', borderRadius: 14, padding: '1rem 1.25rem', marginBottom: 16, border: `1px solid ${parseFloat(alumnoActual.saldo) < 200 ? '#FECACA' : '#BBF7D0'}` }}>
          <p style={{ margin: '0 0 2px', fontSize: 12, color: '#666' }}>Saldo de {alumnoActual.nombre.split(' ')[0]}</p>
          <p style={{ margin: 0, fontSize: 28, fontWeight: 700, color: parseFloat(alumnoActual.saldo) < 200 ? '#DC2626' : '#16A34A' }}>{fmt(alumnoActual.saldo)}</p>
          {monto && parseInt(monto) > 0 && <p style={{ margin: '4px 0 0', fontSize: 12, color: '#666' }}>Nuevo saldo: <b>{fmt(parseFloat(alumnoActual.saldo) + parseInt(monto))}</b></p>}
        </div>
      )}

      {msg && <div style={{ padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 14, background: msg.tipo === 'ok' ? '#F0FDF4' : '#FEF2F2', color: msg.tipo === 'ok' ? '#16A34A' : '#DC2626' }}>{msg.texto}</div>}

      {paso === 'monto' && (
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
          <button onClick={iniciarPago} disabled={!monto || parseInt(monto) <= 0} style={{ width: '100%', padding: '14px', border: 'none', borderRadius: 12, background: !monto || parseInt(monto) <= 0 ? '#F0F0F0' : '#111', color: !monto || parseInt(monto) <= 0 ? '#999' : 'white', fontSize: 15, fontWeight: 600, cursor: !monto || parseInt(monto) <= 0 ? 'not-allowed' : 'pointer' }}>
            Continuar
          </button>
        </div>
      )}

      {paso === 'pago' && (
        <div style={{ background: 'white', borderRadius: 16, padding: '1.5rem', border: '1px solid #F0F0F0' }}>
          <div style={{ padding: '10px 14px', background: '#F8F9FA', borderRadius: 10, marginBottom: 16, fontSize: 14 }}>
            Recargando <b>{fmt(parseInt(monto))}</b> para <b>{alumnoActual?.nombre.split(' ')[0]}</b>
          </div>
          <div id="wallet_container" ref={bricksRef} />
          {!preferenceId && <p style={{ color: '#999', fontSize: 13, textAlign: 'center' }}>Cargando opciones de pago...</p>}
        </div>
      )}
    </div>
  )
}