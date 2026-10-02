import { useEffect, useState } from 'react'
import superadminApi from '../api/axiosSuperadmin'

// Métricas de la plataforma (superadmin): uso, dinero y velocidad de atención
// de todos los colegios o de uno, en un período
const fmt = n => `$${Math.round(Number(n) || 0).toLocaleString('es-AR')}`
const pct = v => (v == null ? '—' : `${Math.round(v * 100)}%`)
const seg = ms => (ms == null ? '—' : `${(ms / 1000).toLocaleString('es-AR', { maximumFractionDigits: ms < 10000 ? 1 : 0 })} s`)
const dec = (v, d = 1) => (v == null ? '—' : v.toLocaleString('es-AR', { maximumFractionDigits: d }))
const hoyAR = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
const haceDias = n => { const d = new Date(hoyAR() + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - (n - 1)); return d.toISOString().slice(0, 10) }

const caja = { background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)', padding: '14px 16px' }
const titulo = { margin: '0 0 12px', fontSize: 14, fontWeight: 600, color: 'var(--text)' }
const th = { padding: '8px 10px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.5px', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)' }
const td = { padding: '9px 10px', fontSize: 13, color: 'var(--text)', borderBottom: '1px solid var(--border-light)', whiteSpace: 'nowrap' }

function Tarjeta({ etiqueta, valor, detalle, color }) {
  return (
    <div style={caja}>
      <p style={{ margin: '0 0 4px', fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.5px' }}>{etiqueta}</p>
      <p style={{ margin: 0, fontSize: 22, fontWeight: 700, color: color || 'var(--text)' }}>{valor}</p>
      {detalle && <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>{detalle}</p>}
    </div>
  )
}

// Barras verticales simples (sin librería): una por valor
function Barras({ datos, etiqueta, valor, formato = v => v, alto = 120 }) {
  const max = Math.max(1, ...datos.map(valor))
  const cada = Math.ceil(datos.length / 10) // con muchas barras, una etiqueta cada tanto para que no se pisen
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: alto + 18 }}>
      {datos.map((d, i) => (
        <div key={i} title={`${etiqueta(d)}: ${formato(valor(d))}`} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
          <div style={{ width: '100%', height: Math.max(valor(d) ? 3 : 0, (valor(d) / max) * alto), background: 'var(--brand)', borderRadius: '3px 3px 0 0', opacity: valor(d) ? 1 : 0.2 }} />
          <span style={{ fontSize: 9, color: 'var(--text-tertiary)', marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden' }}>{i % cada === 0 ? etiqueta(d) : ' '}</span>
        </div>
      ))}
    </div>
  )
}

export default function SuperMetricas({ colegios }) {
  const [dias, setDias] = useState(30)
  const [colegioId, setColegioId] = useState('')
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let vigente = true
    superadminApi.get('/superadmin/metricas', { params: { desde: haceDias(dias), hasta: hoyAR(), colegio_id: colegioId || undefined } })
      .then(r => { if (vigente) { setDatos(r.data); setError(null) } })
      .catch(err => { if (vigente) setError(err.response?.data?.error || 'No se pudieron cargar las métricas') })
    return () => { vigente = false }
  }, [dias, colegioId])

  const t = datos?.total
  const diasSerie = datos ? datos.serie.slice(-31) : []
  const horasConVentas = datos ? datos.por_hora.filter(h => h.ventas > 0) : []
  const horasVisibles = horasConVentas.length ? datos.por_hora.slice(Math.min(...horasConVentas.map(h => h.hora)), Math.max(...horasConVentas.map(h => h.hora)) + 1) : []
  const horaPico = horasConVentas.reduce((m, h) => (!m || h.ventas > m.ventas ? h : m), null)

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 16 }}>
        {[[7, '7 días'], [30, '30 días'], [90, '90 días'], [365, '1 año']].map(([n, label]) => (
          <button key={n} onClick={() => setDias(n)} aria-pressed={dias === n} style={{ padding: '7px 14px', borderRadius: 8, fontSize: 13, cursor: 'pointer', border: `1px solid ${dias === n ? 'var(--brand)' : 'var(--border)'}`, background: dias === n ? 'var(--brand)' : 'transparent', color: dias === n ? 'var(--on-brand)' : 'var(--text-secondary)', fontWeight: dias === n ? 600 : 400 }}>{label}</button>
        ))}
        <select value={colegioId} onChange={e => setColegioId(e.target.value)} style={{ marginLeft: 'auto', padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text)', fontSize: 13, minWidth: 180 }}>
          <option value="">Todos los colegios</option>
          {colegios.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
      </div>

      {error && <p style={{ color: 'var(--red)', fontSize: 14 }}>{error}</p>}
      {!datos && !error && <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Cargando…</p>}

      {t && (
        <>
          <h3 style={{ ...titulo, marginTop: 4 }}>Uso</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12, marginBottom: 20 }}>
            <Tarjeta etiqueta="Alumnos activos" valor={t.alumnos_activos.toLocaleString('es-AR')} detalle={`${t.alumnos_con_familia} con familia vinculada`} />
            <Tarjeta etiqueta="Adopción" valor={pct(t.adopcion)} detalle="alumnos con su familia en la app" />
            <Tarjeta etiqueta="Compraron en el período" valor={pct(t.uso)} detalle={`${t.alumnos_compraron} alumnos`} />
            <Tarjeta etiqueta="Ventas" valor={t.ventas.toLocaleString('es-AR')} detalle={t.ventas_por_dia == null ? 'sin ventas' : `${dec(t.ventas_por_dia, 0)} por día con ventas${t.ventas_offline ? ` · ${t.ventas_offline} sin conexión` : ''}`} />
          </div>

          <h3 style={titulo}>Dinero</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12, marginBottom: 20 }}>
            <Tarjeta etiqueta="Recargado (volumen procesado)" valor={fmt(t.recargado)} detalle={`${t.recargas.toLocaleString('es-AR')} recargas · promedio ${t.recarga_promedio == null ? '—' : fmt(t.recarga_promedio)}`} />
            <Tarjeta etiqueta="Vendido" valor={fmt(t.vendido)} detalle={`ticket promedio ${t.ticket_promedio == null ? '—' : fmt(t.ticket_promedio)}`} />
            <Tarjeta etiqueta="Comisión cobrada" valor={fmt(t.comision)} color="var(--green)" detalle="en el período" />
            <Tarjeta etiqueta="Saldo en cuentas" valor={fmt(t.saldo_total)} detalle={`promedio ${t.saldo_promedio == null ? '—' : fmt(t.saldo_promedio)} por alumno · hoy`} />
            <Tarjeta etiqueta="Frecuencia de recarga" valor={t.recargas_por_alumno == null ? '—' : `${dec(t.recargas_por_alumno)} por alumno`} detalle={t.recargas_por_alumno ? `cada ~${Math.max(1, Math.round(dias / t.recargas_por_alumno))} días` : 'sin recargas'} />
          </div>

          <h3 style={titulo}>Velocidad de atención</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12, marginBottom: 12 }}>
            <Tarjeta etiqueta="Tiempo por venta" valor={seg(t.duracion_mediana)} color="var(--brand)" detalle={t.ventas_medidas ? `mitad de las ventas en menos de eso · ${t.ventas_medidas.toLocaleString('es-AR')} medidas` : 'se mide desde ahora en cada venta'} />
            <Tarjeta etiqueta="Las más lentas" valor={seg(t.duracion_p90)} detalle="9 de cada 10 ventas tardan menos" />
            <Tarjeta etiqueta="Pico" valor={t.pico_minuto ? `${t.pico_minuto} por minuto` : '—'} detalle={horaPico ? `hora con más ventas: ${horaPico.hora}:00` : 'ventas en un mismo minuto'} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12, marginBottom: 20 }}>
            <div style={caja}>
              <p style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--text-secondary)' }}>Cuánto tarda cada venta</p>
              {t.ventas_medidas ? <Barras datos={datos.duraciones} etiqueta={d => d.rango} valor={d => d.ventas} formato={v => `${v} ventas`} alto={90} /> : <p style={{ margin: 0, fontSize: 13, color: 'var(--text-tertiary)' }}>Todavía no hay ventas medidas.</p>}
            </div>
            <div style={caja}>
              <p style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--text-secondary)' }}>Ventas por hora del día</p>
              {horasVisibles.length ? <Barras datos={horasVisibles} etiqueta={d => `${d.hora}h`} valor={d => d.ventas} formato={v => `${v} ventas`} alto={90} /> : <p style={{ margin: 0, fontSize: 13, color: 'var(--text-tertiary)' }}>Sin ventas en el período.</p>}
            </div>
          </div>

          {diasSerie.length > 0 && (
            <div style={{ ...caja, marginBottom: 20 }}>
              <p style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--text-secondary)' }}>Vendido por día{datos.serie.length > 31 ? ' (últimos 31 días con movimiento)' : ''}</p>
              <Barras datos={diasSerie} etiqueta={d => d.dia.slice(8, 10) + '/' + d.dia.slice(5, 7)} valor={d => d.vendido} formato={fmt} />
            </div>
          )}

          {!colegioId && datos.por_colegio.length > 1 && (
            <div style={{ ...caja, padding: 0, overflow: 'hidden' }}>
              <h3 style={{ ...titulo, margin: 0, padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>Por colegio</h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr>{['Colegio', 'Alumnos', 'Adopción', 'Compraron', 'Ventas', 'Vendido', 'Ticket', 'Recargado', 'Comisión', 'Saldo', 'Tiempo/venta'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {[...datos.por_colegio].sort((a, b) => b.recargado - a.recargado).map(c => (
                      <tr key={c.id} style={{ opacity: c.activo ? 1 : 0.55 }}>
                        <td style={{ ...td, fontWeight: 600 }}>{c.nombre}{!c.activo && <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}> · suspendido</span>}</td>
                        <td style={td}>{c.alumnos_activos}</td>
                        <td style={td}>{pct(c.adopcion)}</td>
                        <td style={td}>{pct(c.uso)}</td>
                        <td style={td}>{c.ventas.toLocaleString('es-AR')}</td>
                        <td style={td}>{fmt(c.vendido)}</td>
                        <td style={td}>{c.ticket_promedio == null ? '—' : fmt(c.ticket_promedio)}</td>
                        <td style={td}>{fmt(c.recargado)}</td>
                        <td style={{ ...td, color: 'var(--green)' }}>{fmt(c.comision)}</td>
                        <td style={td}>{fmt(c.saldo_total)}</td>
                        <td style={td}>{seg(c.duracion_mediana)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
