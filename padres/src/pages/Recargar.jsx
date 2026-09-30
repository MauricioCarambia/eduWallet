import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import api from '../api/axios'
import { SkeletonCards } from '../components/Skeleton'

const fmt = n => `$${Number(n).toLocaleString('es-AR')}`

// Mismo cálculo que el backend (modelo B): la comisión se suma al saldo
// que se quiere cargar. El backend recalcula, esto es sólo para mostrar.
const redondear = n => Math.round(n * 100) / 100
const cotizar = (monto, pct) => {
  const comision = redondear(monto * Number(pct || 0) / 100)
  return { comision, total: redondear(monto + comision) }
}

const ESTADOS = {
  pendiente:  { label: 'Pendiente',  color: 'var(--amber)', bg: 'var(--amber-bg)' },
  acreditado: { label: 'Acreditado', color: 'var(--green)', bg: 'var(--green-bg)' },
  rechazado:  { label: 'Rechazado',  color: 'var(--red)',   bg: 'var(--red-bg)' },
  vencido:    { label: 'Vencido',    color: 'var(--text-secondary)', bg: 'var(--bg)' },
}

const FILTROS = [
  { valor: '',           label: 'Todas' },
  { valor: 'acreditado', label: 'Acreditadas' },
  { valor: 'pendiente',  label: 'Pendientes' },
  { valor: 'rechazado',  label: 'Rechazadas' },
  { valor: 'vencido',    label: 'Vencidas' },
]

export default function Recargar() {
  const [alumnos, setAlumnos] = useState([])
  const [alumnoId, setAlumnoId] = useState(null)
  const [monto, setMonto] = useState('')
  const [cargando, setCargando] = useState(true)
  const [procesando, setProcesando] = useState(false)
  const [paso, setPaso] = useState('monto')
  const [msg, setMsg] = useState(null)
  const [searchParams] = useSearchParams()
  const [historial, setHistorial] = useState([])
  const [filtro, setFiltro] = useState('')

  const showMsg = (tipo, texto) => { setMsg({ tipo, texto }); setTimeout(() => setMsg(null), 6000) }

  useEffect(() => { cargar(); cargarHistorial() }, [])

  const cargarHistorial = async (estado = filtro) => {
    try {
      const res = await api.get('/pagos/historial', { params: estado ? { estado } : {} })
      setHistorial(res.data)
    } catch (err) { console.error(err) }
  }

  useEffect(() => {
    const status = searchParams.get('status')
    const paymentId = searchParams.get('payment_id')
    if (status === 'success' && paymentId) {
      verificarPago(paymentId)
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

  const verificarPago = async (paymentId) => {
    try {
      const res = await api.get(`/pagos/verificar?payment_id=${paymentId}`)
      if (res.data.status === 'approved') { setPaso('exito'); cargar() }
      cargarHistorial()
    } catch (err) { console.error(err) }
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

  if (cargando) return <div style={{ padding: '1rem' }}><SkeletonCards count={2} /></div>
  if (alumnos.length === 0) return <div style={{ color: 'var(--text-secondary)', padding: '1rem', fontSize: 14 }}>No tenés alumnos vinculados</div>

  if (paso === 'exito') return (
    <div style={{ textAlign: 'center', padding: '2rem' }}>
      <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--green-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
      <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 8, color: 'var(--text)' }}>¡Recarga exitosa!</h2>
      <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 8 }}>El saldo fue acreditado correctamente.</p>
      <p style={{ fontSize: 28, fontWeight: 700, color: 'var(--green)', marginBottom: 24 }}>{fmt(alumnoActual?.saldo || 0)}</p>
      <button onClick={() => { setPaso('monto'); setMonto('') }} style={{ padding: '12px 28px', border: 'none', borderRadius: 10, background: 'var(--brand)', color: 'var(--on-brand)', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
        Volver
      </button>
    </div>
  )

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 600, margin: '0 0 16px', color: 'var(--text)' }}>Recargar saldo</h1>

      {alumnos.length > 1 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, overflowX: 'auto', paddingBottom: 4 }}>
          {alumnos.map(a => (
            <button key={a.id} onClick={() => setAlumnoId(a.id)} style={{ padding: '6px 14px', border: `1.5px solid ${alumnoId === a.id ? 'var(--brand)' : 'var(--border)'}`, borderRadius: 20, background: alumnoId === a.id ? 'var(--brand)' : 'var(--bg-card)', color: alumnoId === a.id ? 'var(--on-brand)' : 'var(--text-secondary)', fontSize: 13, fontWeight: alumnoId === a.id ? 500 : 400, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              {a.nombre.split(' ')[0]}
            </button>
          ))}
        </div>
      )}

      {alumnoActual && (
        <div style={{ background: parseFloat(alumnoActual.saldo) < 200 ? 'var(--red-bg)' : 'var(--green-bg)', borderRadius: 14, padding: '1rem 1.25rem', marginBottom: 20, border: `1px solid ${parseFloat(alumnoActual.saldo) < 200 ? 'var(--red)' : 'var(--green)'}`, opacity: 0.9 }}>
          <p style={{ margin: '0 0 4px', fontSize: 13, color: 'var(--text-secondary)' }}>Saldo de {alumnoActual.nombre.split(' ')[0]}</p>
          <p style={{ margin: 0, fontSize: 32, fontWeight: 700, color: parseFloat(alumnoActual.saldo) < 200 ? 'var(--red)' : 'var(--green)' }}>{fmt(alumnoActual.saldo)}</p>
          {parseFloat(alumnoActual.saldo) < 200 && (
            <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--red)' }}>Saldo bajo — recargá para evitar inconvenientes</p>
          )}
        </div>
      )}

      {msg && (
        <div style={{ padding: '12px 16px', borderRadius: 10, fontSize: 14, marginBottom: 16, fontWeight: 500, background: msg.tipo === 'ok' ? 'var(--green-bg)' : msg.tipo === 'warn' ? 'var(--amber-bg)' : 'var(--red-bg)', color: msg.tipo === 'ok' ? 'var(--green)' : msg.tipo === 'warn' ? 'var(--amber)' : 'var(--red)', borderLeft: `3px solid ${msg.tipo === 'ok' ? 'var(--green)' : msg.tipo === 'warn' ? 'var(--amber)' : 'var(--red)'}` }}>
          {msg.texto}
        </div>
      )}

      <div style={{ background: 'var(--bg-card)', borderRadius: 16, padding: '1.5rem', border: '1px solid var(--border)', boxShadow: 'var(--shadow)' }}>
        <p style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>¿Cuánto querés cargar?</p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          {[500, 1000, 2000, 5000].map(n => (
            <button key={n} onClick={() => setMonto(String(n))} style={{ padding: '16px', border: `2px solid ${monto == n ? 'var(--brand)' : 'var(--border)'}`, borderRadius: 14, background: monto == n ? 'var(--brand)' : 'var(--bg-card)', color: monto == n ? 'var(--on-brand)' : 'var(--text-secondary)', fontSize: 18, fontWeight: monto == n ? 700 : 400, cursor: 'pointer', transition: 'all .15s' }}>
              {fmt(n)}
            </button>
          ))}
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.5px' }}>Otro monto</label>
          <input type="number" placeholder="Ingresá el monto" value={monto} onChange={e => setMonto(e.target.value)} />
        </div>

        {monto && parseInt(monto) > 0 && alumnoActual && (() => {
          const n = parseInt(monto)
          const { comision, total } = cotizar(n, alumnoActual.comision_pct)
          const fila = { display: 'flex', justifyContent: 'space-between', marginBottom: 4 }
          return (
            <div style={{ padding: '10px 14px', background: 'var(--bg-subtle)', borderRadius: 10, marginBottom: 16, fontSize: 13, color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
              <div style={fila}><span>Saldo a cargar</span><span>{fmt(n)}</span></div>
              {comision > 0 && <div style={fila}><span>Cargo por servicio</span><span>{fmt(comision)}</span></div>}
              <div style={{ ...fila, fontWeight: 600, color: 'var(--text)', borderTop: '1px solid var(--border)', paddingTop: 6, marginTop: 6 }}><span>Total a pagar</span><span style={{ fontSize: 15 }}>{fmt(total)}</span></div>
              <div style={{ ...fila, marginBottom: 0, marginTop: 6 }}><span>Nuevo saldo estimado</span><b style={{ color: 'var(--text)' }}>{fmt(parseFloat(alumnoActual.saldo) + n)}</b></div>
            </div>
          )
        })()}

        <button onClick={iniciarPago} disabled={!monto || parseInt(monto) <= 0 || procesando}
          style={{ width: '100%', padding: '16px', border: 'none', borderRadius: 14, background: !monto || parseInt(monto) <= 0 ? 'var(--bg-subtle)' : '#009EE3', color: !monto || parseInt(monto) <= 0 ? 'var(--text-secondary)' : 'white', fontSize: 16, fontWeight: 700, cursor: !monto || parseInt(monto) <= 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, transition: 'opacity .15s' }}>
          {procesando ? 'Redirigiendo a Mercado Pago...' : (
            <>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>
              Pagar con Mercado Pago
            </>
          )}
        </button>

        <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Pago seguro con Mercado Pago</span>
        </div>
        <p style={{ fontSize: 11, color: 'var(--text-secondary)', textAlign: 'center', marginTop: 6 }}>
          Pagá con cualquier tarjeta de débito o crédito (también las de Ualá, Naranja X, Brubank y otras billeteras), en efectivo en Rapipago / Pago Fácil o con saldo de Mercado Pago. No necesitás cuenta de Mercado Pago.
        </p>
      </div>

      {(historial.length > 0 || filtro) && (
        <div style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 12px', color: 'var(--text)' }}>Historial de recargas</h2>
          <div style={{ display: 'flex', gap: 6, marginBottom: 12, overflowX: 'auto', paddingBottom: 4 }}>
            {FILTROS.map(f => (
              <button key={f.valor} onClick={() => { setFiltro(f.valor); cargarHistorial(f.valor) }} style={{ padding: '5px 12px', border: `1.5px solid ${filtro === f.valor ? 'var(--brand)' : 'var(--border)'}`, borderRadius: 20, background: filtro === f.valor ? 'var(--brand)' : 'var(--bg-card)', color: filtro === f.valor ? 'var(--on-brand)' : 'var(--text-secondary)', fontSize: 12, fontWeight: filtro === f.valor ? 600 : 400, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                {f.label}
              </button>
            ))}
          </div>
          <div style={{ background: 'var(--bg-card)', borderRadius: 14, border: '1px solid var(--border)', boxShadow: 'var(--shadow)', overflow: 'hidden' }}>
            {historial.length === 0 && (
              <p style={{ margin: 0, padding: '16px', fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center' }}>
                No hay recargas {FILTROS.find(f => f.valor === filtro)?.label.toLowerCase()}
              </p>
            )}
            {historial.map((p, i) => {
              const e = ESTADOS[p.estado] || ESTADOS.pendiente
              return (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: i < historial.length - 1 ? '1px solid var(--border-light)' : 'none' }}>
                  <div>
                    <p style={{ margin: '0 0 2px', fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{fmt(p.monto)}</p>
                    <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>
                      {p.alumno_nombre} · {new Date(p.creado_en).toLocaleString('es-AR')}
                      {Number(p.comision) > 0 && ` · ${p.estado === 'acreditado' ? 'Pagado' : 'Total'} ${fmt(p.monto_total)}`}
                    </p>
                  </div>
                  <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, color: e.color, background: e.bg }}>{e.label}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}