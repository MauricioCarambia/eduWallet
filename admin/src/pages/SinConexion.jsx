import { useState, useEffect, useCallback } from 'react'
import api from '../api/axios'
import { SkeletonTable } from '../components/Skeleton'
import Icono from '../components/Icono'

// Ventas hechas con la caja sin internet (modo offline del POS): qué se vendió,
// cuándo se subió y qué alumnos quedaron con saldo negativo
const fmt = n => `${Number(n) < 0 ? '−' : ''}${Math.abs(Number(n || 0)).toLocaleString('es-AR')}`
const fecha = f => new Date(f).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

// "1 min después", "2 h después", "al otro día"
const demora = (vendida, subida) => {
  if (!subida) return '—'
  const min = Math.max(0, Math.round((new Date(subida) - new Date(vendida)) / 60000))
  if (min < 1) return 'enseguida'
  if (min < 60) return `${min} min después`
  if (min < 24 * 60) return `${Math.round(min / 60)} h después`
  return `${Math.round(min / 1440)} día${Math.round(min / 1440) > 1 ? 's' : ''} después`
}

const celda = { padding: '10px 12px', borderBottom: '1px solid var(--border-light)', verticalAlign: 'top' }
const encabezado = { padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.5px', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)' }
const tarjeta = { background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden', marginBottom: 20 }

export default function SinConexion() {
  const [datos, setDatos] = useState(null)
  const [dias, setDias] = useState(30)
  const [avisando, setAvisando] = useState(null)
  const [avisados, setAvisados] = useState([])
  const [msg, setMsg] = useState(null)

  const cargar = useCallback(() => {
    api.get('/offline/resumen', { params: { dias } }).then(r => setDatos(r.data)).catch(() => setDatos({ error: true }))
  }, [dias])
  useEffect(() => { cargar() }, [cargar])

  const avisar = async a => {
    setAvisando(a.id); setMsg(null)
    try {
      const r = await api.post(`/offline/recordar/${a.id}`)
      setAvisados(prev => [...prev, a.id])
      setMsg({ tipo: 'ok', texto: `Listo: se le avisó a ${r.data.avisados === 1 ? 'la familia' : `${r.data.avisados} padres`} de ${a.nombre}.` })
    } catch (err) {
      setMsg({ tipo: 'error', texto: err.response?.data?.error || 'No se pudo avisar' })
    } finally { setAvisando(null) }
  }

  if (!datos) return <SkeletonTable rows={5} cols={5} />
  if (datos.error) return <p style={{ color: 'var(--red)', fontSize: 14 }}>No se pudieron cargar las ventas sin conexión. Probá de nuevo en un rato.</p>

  const { ventas, cantidad, total, sincronizaciones, negativos, deuda } = datos

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <div style={{ maxWidth: 640 }}>
          <h1 style={{ fontSize: 22, fontWeight: 600, margin: '0 0 4px', color: 'var(--text)' }}>Ventas sin conexión</h1>
          <p style={{ color: 'var(--text)', fontSize: 13, margin: 0, lineHeight: 1.5 }}>
            Cuando se corta internet, el POS sigue cobrando y sube las ventas solo al volver la conexión. Acá ves esas ventas y los alumnos que quedaron con saldo negativo:
            la diferencia se descuenta sola de su próxima recarga. El tope por alumno se cambia en Configuración.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label htmlFor="dias" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Últimos</label>
          <select id="dias" value={dias} onChange={e => setDias(Number(e.target.value))} style={{ width: 'auto' }}>
            {[7, 30, 90, 365].map(d => <option key={d} value={d}>{d === 365 ? '12 meses' : `${d} días`}</option>)}
          </select>
        </div>
      </div>

      {msg && <div role="status" style={{ padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16, background: msg.tipo === 'ok' ? 'var(--green-bg)' : 'var(--red-bg)', color: msg.tipo === 'ok' ? 'var(--green)' : 'var(--red)', borderLeft: `3px solid ${msg.tipo === 'ok' ? 'var(--green)' : 'var(--red)'}` }}>{msg.texto}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          ['Ventas sin conexión', cantidad, 'var(--text)', `en ${dias === 365 ? '12 meses' : `${dias} días`}`],
          ['Monto vendido', fmt(total), 'var(--text)', 'ya sumado a cada caja'],
          ['Veces que se subieron', sincronizaciones, 'var(--text)', 'al volver internet'],
          ['Saldo negativo', negativos.length, negativos.length ? 'var(--red)' : 'var(--text)', negativos.length ? `deben ${fmt(deuda)} en total` : 'nadie debe'],
        ].map(([t, v, c, sub]) => (
          <div key={t} style={{ background: 'var(--bg-card)', borderRadius: 12, padding: '14px 16px', border: '1px solid var(--border)' }}>
            <p style={{ margin: '0 0 4px', fontSize: 12, color: 'var(--text-secondary)' }}>{t}</p>
            <p style={{ margin: 0, fontSize: 24, fontWeight: 700, color: c }}>{v}</p>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>{sub}</p>
          </div>
        ))}
      </div>

      {/* saldos negativos */}
      <div style={tarjeta}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, margin: 0, color: 'var(--text)' }}>Alumnos con saldo negativo</h2>
        </div>
        {negativos.length === 0 ? (
          <p style={{ padding: '16px', margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>
            <span style={{ color: 'var(--green)', fontWeight: 600 }}>✓ Ningún alumno debe plata.</span> Si después de un corte alguien queda en negativo, aparece acá.
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead><tr>{['Alumno', 'Saldo', 'Última compra sin conexión', ''].map(h => <th key={h} style={encabezado}>{h}</th>)}</tr></thead>
              <tbody>
                {negativos.map(a => (
                  <tr key={a.id}>
                    <td style={celda}><span style={{ fontWeight: 500, color: 'var(--text)' }}>{a.nombre}</span><span style={{ color: 'var(--text-secondary)' }}> · {a.curso}</span></td>
                    <td style={{ ...celda, fontWeight: 700, color: 'var(--red)', whiteSpace: 'nowrap' }}>{fmt(a.saldo)}</td>
                    <td style={{ ...celda, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{a.ultima_sin_conexion ? fecha(a.ultima_sin_conexion) : '—'}</td>
                    <td style={{ ...celda, textAlign: 'right' }}>
                      {a.padres === 0 ? <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Sin padres vinculados</span>
                        : avisados.includes(a.id) ? <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--green)' }}>✓ Avisado</span>
                        : <button onClick={() => avisar(a)} disabled={avisando === a.id} style={{ padding: '6px 12px', border: '1.5px solid var(--border)', borderRadius: 8, background: 'var(--bg-card)', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap' }}>
                            {avisando === a.id ? 'Avisando...' : 'Avisar a la familia'}
                          </button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ventas sin conexión */}
      <div style={tarjeta}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, margin: 0, color: 'var(--text)' }}>Ventas hechas sin internet</h2>
        </div>
        {ventas.length === 0 ? (
          <p style={{ padding: '16px', margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>No hubo ventas sin conexión en este período.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead><tr>{['Vendida', 'Se subió', 'Alumno', 'Detalle', 'Zona y cajero', 'Monto'].map(h => <th key={h} style={encabezado}>{h}</th>)}</tr></thead>
              <tbody>
                {ventas.map(v => (
                  <tr key={v.id} style={{ opacity: v.anulada ? 0.6 : 1 }}>
                    <td style={{ ...celda, whiteSpace: 'nowrap', color: 'var(--text)' }}>{fecha(v.fecha)}</td>
                    <td style={{ ...celda, whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>{demora(v.fecha, v.sincronizada_en)}</td>
                    <td style={{ ...celda, whiteSpace: 'nowrap', fontWeight: 500, color: 'var(--text)' }}>{v.alumno_nombre}</td>
                    <td style={{ ...celda, color: 'var(--text-secondary)' }}>
                      {v.anulada && <span style={{ display: 'inline-block', marginRight: 6, fontSize: 11, fontWeight: 500, padding: '1px 7px', borderRadius: 6, background: 'var(--bg-subtle)', color: 'var(--text-secondary)' }}>Anulada</span>}
                      {v.descripcion?.replace(/^\[ANULADA\]\s*/, '')}
                    </td>
                    <td style={{ ...celda, whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>{v.lugar}{v.empleado_nombre ? ` · ${v.empleado_nombre}` : ''}</td>
                    <td style={{ ...celda, whiteSpace: 'nowrap', fontWeight: 700, color: 'var(--text)', textDecoration: v.anulada ? 'line-through' : 'none' }}>{fmt(v.monto)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>
        <Icono nombre="alerta" />Sin internet, el POS controla con lo último que sabía: si un alumno compró en dos cajas sin conexión al mismo tiempo, puede quedar en negativo.
        Por eso hay un tope por día (Configuración → Cobro sin internet).
      </p>
    </div>
  )
}
