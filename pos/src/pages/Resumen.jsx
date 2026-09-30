import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useLocales } from '../hooks/useLocales'
import api from '../api/axios'
import { SkeletonCards } from '../components/Skeleton'

const fmt = n => `$${Number(n || 0).toLocaleString('es-AR')}`

// Fechas como texto YYYY-MM-DD, en la hora de Argentina
const hoyAR = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
const sumarDias = (fecha, dias) => {
  const d = new Date(`${fecha}T12:00:00`)
  d.setDate(d.getDate() + dias)
  return d.toLocaleDateString('en-CA')
}
const fechaLarga = fecha => {
  const texto = new Date(`${fecha}T12:00:00`).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}
const horaAR = iso => new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' })

const tarjeta = { background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)', boxShadow: 'var(--shadow)', padding: '14px 16px' }
const titulo = { fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.5px', margin: '0 0 12px' }
const boton = activo => ({ padding: '7px 14px', border: `1px solid ${activo ? 'var(--brand)' : 'var(--border)'}`, borderRadius: 8, background: activo ? 'var(--brand)' : 'var(--bg-card)', color: activo ? 'var(--on-brand)' : 'var(--text-secondary)', fontSize: 13, fontWeight: activo ? 500 : 400, cursor: 'pointer' })

function Comparacion({ actual, anterior }) {
  if (!anterior) return <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Sin ventas el mismo día de la semana pasada</span>
  const pct = Math.round(((actual - anterior) / anterior) * 100)
  const sube = pct >= 0
  return (
    <span style={{ fontSize: 11, fontWeight: 600, color: sube ? 'var(--green)' : 'var(--red)' }}>
      {sube ? '▲' : '▼'} {Math.abs(pct)}% <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>vs. semana pasada ({fmt(anterior)})</span>
    </span>
  )
}

// Ventas por hora con barras simples; muestra el rango de horas con actividad
function VentasPorHora({ porHora }) {
  const conVentas = porHora.filter(h => h.cantidad > 0)
  if (conVentas.length === 0) return <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>Sin ventas este día</p>
  const desde = Math.min(7, conVentas[0].hora)
  const hasta = Math.max(18, conVentas[conVentas.length - 1].hora)
  const horas = porHora.filter(h => h.hora >= desde && h.hora <= hasta)
  const max = Math.max(...horas.map(h => h.total))
  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 140, minWidth: horas.length * 28 }}>
        {horas.map(h => (
          <div key={h.hora} title={`${h.hora}:00 — ${fmt(h.total)} (${h.cantidad} ventas)`} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%', gap: 4 }}>
            {h.total > 0 && <span style={{ fontSize: 9, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{h.cantidad}</span>}
            <div style={{ width: '100%', maxWidth: 26, height: `${max ? Math.max((h.total / max) * 100, h.total ? 4 : 0) : 0}%`, background: h.total ? 'var(--brand)' : 'var(--border-light)', borderRadius: '4px 4px 0 0', minHeight: 2 }} />
            <span style={{ fontSize: 10, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{h.hora}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Resumen() {
  const { sesion } = useAuth()
  const { locales } = useLocales()
  const zonaFija = sesion?.local || null
  const [fecha, setFecha] = useState(hoyAR())
  const [local, setLocal] = useState('')
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState(null)
  const [cargada, setCargada] = useState(null) // combinación fecha/zona ya traída
  const [verAnuladas, setVerAnuladas] = useState(false)

  const clave = `${fecha}|${local}`
  const cargando = cargada !== clave

  useEffect(() => {
    let vigente = true
    api.get('/transacciones/resumen-dia', { params: { fecha, ...(local ? { local } : {}) } })
      .then(res => { if (vigente) { setDatos(res.data); setError(null) } })
      .catch(err => { if (vigente) setError(err.response?.data?.error || 'No se pudo cargar el resumen') })
      .finally(() => { if (vigente) setCargada(`${fecha}|${local}`) })
    return () => { vigente = false }
  }, [fecha, local])

  const hoy = hoyAR()
  const r = datos?.resumen
  const ventasVisibles = (datos?.ventas || []).filter(v => verAnuladas || !v.anulada)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: '0 0 4px', color: 'var(--text)' }}>Resumen del día</h1>
          <p style={{ color: 'var(--text)', fontSize: 13, margin: 0 }}>
            {fechaLarga(fecha)} · {zonaFija || local || 'Todas las zonas'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => setFecha(f => sumarDias(f, -1))} style={boton(false)} aria-label="Día anterior">‹</button>
          <input type="date" value={fecha} max={hoy} onChange={e => e.target.value && setFecha(e.target.value)} style={{ width: 'auto' }} />
          <button onClick={() => setFecha(f => sumarDias(f, 1))} disabled={fecha >= hoy} style={{ ...boton(false), opacity: fecha >= hoy ? 0.4 : 1 }} aria-label="Día siguiente">›</button>
          <button onClick={() => setFecha(hoy)} style={boton(fecha === hoy)}>Hoy</button>
          <button onClick={() => setFecha(sumarDias(hoy, -1))} style={boton(fecha === sumarDias(hoy, -1))}>Ayer</button>
        </div>
      </div>

      {!zonaFija && locales.length > 1 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
          {['', ...locales].map(l => (
            <button key={l || 'todas'} onClick={() => setLocal(l)} style={boton(local === l)}>{l || 'Todas las zonas'}</button>
          ))}
        </div>
      )}

      {error && <div style={{ padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16, background: 'var(--red-bg)', color: 'var(--red)' }}>{error}</div>}

      {cargando && !datos ? <SkeletonCards count={4} /> : datos && (
        <div style={{ display: 'grid', gap: 14, opacity: cargando ? 0.6 : 1, transition: 'opacity .15s' }}>
          {/* totales */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
            <div style={{ ...tarjeta, gridColumn: 'span 2', minWidth: 0 }}>
              <p style={{ margin: '0 0 2px', fontSize: 12, color: 'var(--text-secondary)' }}>Vendido</p>
              <p style={{ margin: '0 0 4px', fontSize: 28, fontWeight: 700, color: 'var(--green)', fontVariantNumeric: 'tabular-nums' }}>{fmt(r.total)}</p>
              <Comparacion actual={r.total} anterior={datos.semana_pasada.total} />
            </div>
            {[
              ['Ventas', r.cantidad],
              ['Ticket promedio', fmt(r.ticket_promedio)],
              ['Alumnos atendidos', r.alumnos],
              ['Anuladas', r.anuladas ? `${r.anuladas} (${fmt(r.monto_anulado)})` : '0'],
            ].map(([label, valor]) => (
              <div key={label} style={tarjeta}>
                <p style={{ margin: '0 0 2px', fontSize: 12, color: 'var(--text-secondary)' }}>{label}</p>
                <p style={{ margin: 0, fontSize: 20, fontWeight: 700, color: label === 'Anuladas' && r.anuladas ? 'var(--red)' : 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{valor}</p>
              </div>
            ))}
          </div>

          {/* por hora */}
          <div style={tarjeta}>
            <p style={titulo}>Ventas por hora</p>
            <VentasPorHora porHora={datos.por_hora} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14, alignItems: 'start' }}>
            {/* productos */}
            <div style={tarjeta}>
              <p style={titulo}>Más vendidos</p>
              {datos.productos.length === 0 ? <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>Sin ventas</p> : (
                <div style={{ display: 'grid', gap: 8 }}>
                  {datos.productos.map(p => (
                    <div key={p.nombre} style={{ display: 'grid', gap: 3 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                        <span style={{ color: 'var(--text)' }}>{p.nombre}</span>
                        <span style={{ color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{p.cantidad} u.</span>
                      </div>
                      <div style={{ height: 5, borderRadius: 3, background: 'var(--border-light)' }}>
                        <div style={{ height: '100%', width: `${(p.cantidad / datos.productos[0].cantidad) * 100}%`, borderRadius: 3, background: 'var(--accent)' }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* cajas y empleados / zonas */}
            <div style={{ display: 'grid', gap: 14 }}>
              <div style={tarjeta}>
                <p style={titulo}>Cajas del día</p>
                {datos.cajas.length === 0 ? <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>No se abrieron cajas</p> : datos.cajas.map(c => (
                  <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '8px 0', borderTop: '1px solid var(--border-light)', fontSize: 13 }}>
                    <div>
                      <p style={{ margin: 0, fontWeight: 500, color: 'var(--text)' }}>{c.empleado_nombre} · {c.local}</p>
                      <p style={{ margin: 0, fontSize: 11, color: 'var(--text-secondary)' }}>
                        {horaAR(c.apertura)} – {c.abierta ? 'abierta' : c.cierre ? horaAR(c.cierre) : '—'} · fondo {fmt(c.fondo)} · {c.tx_count} ventas
                      </p>
                    </div>
                    <span style={{ fontWeight: 600, color: 'var(--green)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{fmt(c.ventas)}</span>
                  </div>
                ))}
              </div>

              {(datos.por_empleado.length > 1 || (!datos.local && datos.por_zona.length > 1)) && (
                <div style={tarjeta}>
                  <p style={titulo}>{!datos.local && datos.por_zona.length > 1 ? 'Por zona' : 'Por empleado'}</p>
                  {(!datos.local && datos.por_zona.length > 1 ? datos.por_zona.map(z => ({ nombre: z.local, ...z })) : datos.por_empleado).map(x => (
                    <div key={x.nombre} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: '1px solid var(--border-light)', fontSize: 13 }}>
                      <span style={{ color: 'var(--text)' }}>{x.nombre} <span style={{ color: 'var(--text-secondary)' }}>· {x.cantidad} ventas</span></span>
                      <span style={{ fontWeight: 600, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{fmt(x.total)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ventas */}
          <div style={{ ...tarjeta, padding: 0, overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px 10px', gap: 8, flexWrap: 'wrap' }}>
              <p style={{ ...titulo, margin: 0 }}>Ventas del día ({r.cantidad})</p>
              {r.anuladas > 0 && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={verAnuladas} onChange={e => setVerAnuladas(e.target.checked)} style={{ width: 'auto' }} />
                  Mostrar anuladas
                </label>
              )}
            </div>
            {ventasVisibles.length === 0 ? <p style={{ padding: '0 16px 16px', fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>Sin ventas</p> : ventasVisibles.map(v => (
              <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '10px 16px', borderTop: '1px solid var(--border-light)', opacity: v.anulada ? 0.6 : 1 }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>
                    {v.alumno_nombre}{v.alumno_curso ? <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}> · {v.alumno_curso}</span> : null}
                    {v.anulada && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 5, background: 'var(--red-bg)', color: 'var(--red)' }}>Anulada</span>}
                  </p>
                  <p style={{ margin: 0, fontSize: 11, color: 'var(--text-secondary)', overflowWrap: 'anywhere' }}>
                    {horaAR(v.fecha)} · {v.descripcion.replace(/^\[ANULADA\] /, '')}{!zonaFija && !local ? ` · ${v.lugar}` : ''}{datos.por_empleado.length > 1 ? ` · ${v.empleado_nombre}` : ''}
                  </p>
                </div>
                <span style={{ fontSize: 14, fontWeight: 600, color: v.anulada ? 'var(--text-secondary)' : 'var(--text)', textDecoration: v.anulada ? 'line-through' : 'none', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{fmt(v.monto)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
