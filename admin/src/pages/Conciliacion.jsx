import { useState, useEffect } from 'react'
import api from '../api/axios'
import { SkeletonTable } from '../components/Skeleton'

const fmt = n => `$${Number(n || 0).toLocaleString('es-AR')}`
const fecha = f => new Date(f).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

// Qué encontró la revisión, en palabras del colegio
const TIPOS = {
  aprobado_sin_saldo: 'Pago aprobado sin saldo',
  devolucion: 'Devolución',
  contracargo: 'Contracargo',
  disputa: 'Disputa abierta',
  monto_inconsistente: 'Monto que no coincide',
  no_verificado: 'No se pudo verificar',
  recarga_sin_pago: 'Recarga sin pago registrado',
  saldo_descuadrado: 'Saldo descuadrado',
}
const ESTADOS = {
  corregida: { texto: 'Corregida sola', color: 'var(--green)', bg: 'var(--green-bg)' },
  revisar: { texto: 'Revisar', color: 'var(--red)', bg: 'var(--red-bg)' },
  info: { texto: 'Para saber', color: 'var(--amber)', bg: 'var(--amber-bg)' },
}

export default function Conciliacion() {
  const [revisiones, setRevisiones] = useState([])
  const [cargando, setCargando] = useState(true)
  const [ejecutando, setEjecutando] = useState(false)
  const [dias, setDias] = useState(30)
  const [elegida, setElegida] = useState(null)
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    api.get('/conciliacion').then(r => setRevisiones(r.data)).catch(() => {}).finally(() => setCargando(false))
  }, [])

  const revisarAhora = async () => {
    setEjecutando(true); setMsg(null)
    try {
      const r = await api.post('/conciliacion', { dias })
      setRevisiones(prev => [r.data, ...prev])
      setElegida(r.data.id)
      setMsg({ tipo: 'ok', texto: `Listo: ${r.data.revisados} pagos revisados, ${r.data.corregidas} corregidos solos.` })
    } catch (err) {
      setMsg({ tipo: 'error', texto: err.response?.data?.error || 'No se pudo completar la revisión' })
    } finally { setEjecutando(false) }
  }

  const actual = revisiones.find(r => r.id === elegida) || revisiones[0]
  const difs = actual?.diferencias || []
  const pendientes = difs.filter(d => d.estado === 'revisar').length

  if (cargando) return <SkeletonTable rows={5} cols={4} />

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <div style={{ maxWidth: 620 }}>
          <h1 style={{ fontSize: 22, fontWeight: 600, margin: '0 0 4px', color: 'var(--text)' }}>Conciliación con Mercado Pago</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: 0, lineHeight: 1.5 }}>
            Compara las recargas con lo que registró Mercado Pago. Si un pago aprobado no sumó saldo, lo acredita; si una recarga se devolvió o tuvo un contracargo, lo descuenta.
            Lo que necesita una persona queda marcado para revisar. Se hace sola todas las noches.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label htmlFor="dias" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Últimos</label>
          <select id="dias" value={dias} onChange={e => setDias(Number(e.target.value))} style={{ width: 'auto' }}>
            {[7, 30, 60, 90].map(d => <option key={d} value={d}>{d} días</option>)}
          </select>
          <button onClick={revisarAhora} disabled={ejecutando} style={{ padding: '9px 16px', border: 'none', borderRadius: 'var(--radius)', background: 'var(--brand)', color: 'white', fontSize: 13, fontWeight: 600, cursor: ejecutando ? 'wait' : 'pointer', opacity: ejecutando ? 0.6 : 1 }}>
            {ejecutando ? 'Revisando...' : 'Revisar ahora'}
          </button>
        </div>
      </div>

      {msg && <div style={{ padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16, background: msg.tipo === 'ok' ? 'var(--green-bg)' : 'var(--red-bg)', color: msg.tipo === 'ok' ? 'var(--green)' : 'var(--red)' }}>{msg.texto}</div>}

      {!actual ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 14, background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)' }}>
          Todavía no hay revisiones. La primera se hace esta noche, o tocá <b>Revisar ahora</b>.
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
            {[
              ['Pagos revisados', actual.revisados, 'var(--text)'],
              ['Corregidos solos', actual.corregidas, 'var(--green)'],
              ['Para revisar', pendientes, pendientes ? 'var(--red)' : 'var(--text)'],
            ].map(([t, v, c]) => (
              <div key={t} style={{ background: 'var(--bg-card)', borderRadius: 12, padding: '14px 16px', border: '1px solid var(--border)' }}>
                <p style={{ margin: '0 0 4px', fontSize: 12, color: 'var(--text-secondary)' }}>{t}</p>
                <p style={{ margin: 0, fontSize: 24, fontWeight: 700, color: c }}>{v}</p>
              </div>
            ))}
          </div>

          <div style={{ background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden', marginBottom: 20 }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontSize: 13, color: 'var(--text-secondary)' }}>
              Revisión del {fecha(actual.ejecutado_en)} · últimos {actual.dias} días · {actual.origen === 'auto' ? 'automática' : `hecha por ${actual.empleado_nombre || 'la administración'}`}
            </div>
            {difs.length === 0 ? (
              <p style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--green)', fontSize: 14, margin: 0 }}>✓ Todo coincide con Mercado Pago.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      {['Estado', 'Qué pasó', 'Alumno', 'Monto', 'Detalle'].map(h => <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '.5px' }}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {[...difs].sort((a, b) => (a.estado === 'revisar' ? -1 : 0) - (b.estado === 'revisar' ? -1 : 0)).map((d, i) => {
                      const e = ESTADOS[d.estado] || ESTADOS.info
                      return (
                        <tr key={i} style={{ borderBottom: '1px solid var(--border-light)' }}>
                          <td style={{ padding: '10px 14px' }}><span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 6, background: e.bg, color: e.color, whiteSpace: 'nowrap' }}>{e.texto}</span></td>
                          <td style={{ padding: '10px 14px', fontWeight: 500, color: 'var(--text)', whiteSpace: 'nowrap' }}>{TIPOS[d.tipo] || d.tipo}</td>
                          <td style={{ padding: '10px 14px', color: 'var(--text)' }}>{d.alumno || '—'}</td>
                          <td style={{ padding: '10px 14px', color: 'var(--text)', whiteSpace: 'nowrap' }}>{d.monto != null ? fmt(d.monto) : '—'}</td>
                          <td style={{ padding: '10px 14px', color: 'var(--text-secondary)', minWidth: 260 }}>{d.detalle}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {revisiones.length > 1 && (
            <>
              <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: '0 0 8px' }}>Revisiones anteriores</h2>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {revisiones.map(r => (
                  <button key={r.id} onClick={() => setElegida(r.id)} style={{ padding: '6px 12px', borderRadius: 8, border: `1.5px solid ${r.id === actual.id ? 'var(--brand)' : 'var(--border)'}`, background: 'var(--bg-card)', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer' }}>
                    {fecha(r.ejecutado_en)} · {r.diferencias.filter(d => d.estado === 'revisar').length} para revisar
                  </button>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
