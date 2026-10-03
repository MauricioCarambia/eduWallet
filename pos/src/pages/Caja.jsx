import { useState, useEffect } from 'react'
import { SkeletonTable } from '../components/Skeleton'
import { useAuth } from '../context/AuthContext'
import { useCaja } from '../context/CajaContext'
import api from '../api/axios'
import { diaAR, hoyAR } from '../utils/fechas'
import { useLocales } from '../hooks/useLocales'

const fmt = n => `$${Number(n).toLocaleString('es-AR')}`

// Cierre de caja: el fondo inicial más lo vendido en el turno
const totalesCaja = c => {
  const fondo = parseFloat(c?.fondo || 0), ventas = parseFloat(c?.ventas || 0)
  return { fondo, ventas, total: fondo + ventas }
}
const lineasCierre = c => { const t = totalesCaja(c); return [`Fondo inicial: ${fmt(t.fondo)}`, `Vendido en el turno: ${fmt(t.ventas)}`, `Total: ${fmt(t.total)}`] }

export default function Caja() {
  const { sesion } = useAuth()
  const { caja, abrirCaja, cerrarCaja } = useCaja()
  const { locales } = useLocales()
  const [txs, setTxs] = useState([])
  const [misCajas, setMisCajas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [msg, setMsg] = useState(null)
  const [fondoCaja, setFondoCaja] = useState('0')
  const [local, setLocal] = useState('')

  const showMsg = (tipo, texto) => { setMsg({ tipo, texto }); setTimeout(() => setMsg(null), 3000) }

  const zonaFija = sesion?.local || null

  useEffect(() => { cargar() }, [caja?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!local) setLocal(zonaFija || (locales.length > 0 ? locales[0] : '')) }, [locales, zonaFija])

  // Total del día de la zona (todas las cajas): el mismo número que muestra Resumen
  const [dia, setDia] = useState(null)

  // Detalle de un turno anterior: sus ventas (las de su zona entre la apertura
  // y el cierre, de este cajero), con las anuladas tachadas
  const [turno, setTurno] = useState(null) // { caja, ventas: null | [] }
  const abrirTurno = async c => {
    setTurno({ caja: c, ventas: null })
    try {
      const r = await api.get('/transacciones', { params: { lugar: c.local, desde: diaAR(c.apertura), hasta: c.cierre ? diaAR(c.cierre) : hoyAR(), tipo: 'compra', limit: 2000 } })
      const inicio = new Date(c.apertura), fin = c.cierre ? new Date(c.cierre) : new Date()
      const ventas = (r.data.data ?? r.data).filter(t => { const f = new Date(t.fecha); return f >= inicio && f <= fin && (!t.empleado_id || t.empleado_id === sesion.id) })
      setTurno(x => x && x.caja.id === c.id ? { ...x, ventas } : x)
    } catch (err) {
      setTurno(x => x && x.caja.id === c.id ? { ...x, ventas: [], error: err.response?.data?.error || 'No se pudieron cargar las ventas del turno' } : x)
    }
  }

  const cargar = async () => {
    api.get('/transacciones/resumen-dia', { params: { fecha: hoyAR(), ...(caja?.local || zonaFija ? { local: caja?.local || zonaFija } : {}) } })
      .then(r => setDia(r.data)).catch(() => setDia(null))
    try {
      // Las ventas del turno: las de su zona desde el día que abrió (antes, las últimas 500 del colegio)
      const params = caja ? { lugar: caja.local, desde: diaAR(caja.apertura), hasta: hoyAR(), tipo: 'compra', limit: 2000 } : { limit: 50 }
      const [tRes, cRes] = await Promise.all([api.get('/transacciones', { params }), api.get('/cajas')])
      setTxs(tRes.data.data ?? tRes.data)
      setMisCajas(cRes.data.filter(c => c.empleado_id === sesion.id))
    } catch (err) { console.error(err) } finally { setCargando(false) }
  }

  const handleAbrirCaja = async () => {
    try { await abrirCaja(local, fondoCaja); showMsg('ok', `Caja abierta en ${local}`); cargar() }
    catch (err) { showMsg('error', err.response?.data?.error || err.message || 'Error al abrir caja') }
  }

  const handleCerrarCaja = async () => {
    const resumen = lineasCierre(caja)
    if (!confirm(['¿Cerrar caja?', '', ...resumen].join('\n'))) return
    try { await cerrarCaja(); showMsg('ok', `Caja cerrada. ${resumen.join(' · ')}`); cargar() }
    catch (err) { showMsg('error', err.response?.data?.error || err.message || 'Error al cerrar caja') }
  }

  const txsCaja = caja ? txs.filter(t => {
    const inicio = new Date(caja.apertura)
    const fin = caja.cierre ? new Date(caja.cierre) : new Date()
    const fecha = new Date(t.fecha)
    return t.lugar === caja.local && fecha >= inicio && fecha <= fin && (!t.empleado_id || t.empleado_id === sesion.id)
  }) : []

  const totalEfectivo = totalesCaja(caja).total
  const turnosConVentas = (dia?.cajas || []).filter(c => Number(c.tx_count) > 0).length

  if (cargando) return <SkeletonTable rows={6} cols={3} />

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, margin: '0 0 4px', color: 'var(--text)' }}>Caja</h1>
        <p style={{ color: 'var(--text)', fontSize: 13, margin: 0 }}>Control de turno y arqueo</p>
        {dia && (
          <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
            Hoy{dia.local ? ` en ${dia.local}` : ''}: <b style={{ color: 'var(--text)' }}>{dia.resumen.cantidad} venta{dia.resumen.cantidad === 1 ? '' : 's'} por {fmt(dia.resumen.total)}</b>
            {turnosConVentas > 0 && ` en ${turnosConVentas} turno${turnosConVentas === 1 ? '' : 's'}`}
            {turnosConVentas > 1 && caja && ' (abajo, solo el turno abierto)'}
          </p>
        )}
      </div>

      {msg && <div style={{ padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16, background: msg.tipo === 'ok' ? 'var(--green-bg)' : 'var(--red-bg)', color: msg.tipo === 'ok' ? 'var(--green)' : 'var(--red)', borderLeft: `3px solid ${msg.tipo === 'ok' ? 'var(--green)' : 'var(--red)'}` }}>{msg.texto}</div>}

      {caja ? (
        <div style={{ marginBottom: 24 }}>
          <div style={{ background: 'var(--green-bg)', borderRadius: 16, padding: '1.5rem', border: '1px solid var(--green)', marginBottom: 16, opacity: 0.95 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--green)' }} />
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--green)' }}>Caja abierta — {caja.local}</span>
                </div>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--green)' }}>Apertura: {new Date(caja.apertura).toLocaleString('es-AR')}</p>
              </div>
              <button onClick={handleCerrarCaja} style={{ padding: '8px 18px', border: 'none', borderRadius: 10, background: 'var(--red)', color: 'var(--on-brand)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cerrar caja</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
              {[
                { label: 'Fondo inicial', value: fmt(caja.fondo) },
                { label: 'Ventas del turno', value: fmt(caja.ventas || 0), color: 'var(--green)' },
                { label: 'Transacciones', value: caja.tx_count || 0 },
                { label: 'Total en caja', value: fmt(totalEfectivo) },
              ].map(s => (
                <div key={s.label} style={{ background: 'var(--bg-card)', borderRadius: 10, padding: '10px 12px', border: '1px solid var(--border)' }}>
                  <p style={{ margin: '0 0 2px', fontSize: 11, color: 'var(--text-secondary)' }}>{s.label}</p>
                  <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: s.color || 'var(--text)' }}>{s.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
              <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Últimas ventas del turno</h2>
            </div>
            {txsCaja.length === 0
              ? <p style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>Sin ventas aún</p>
              : txsCaja.slice(0, 8).map(t => (
                <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 16px', borderBottom: '1px solid var(--border-light)' }}>
                  <div>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{t.alumno_nombre}</p>
                    <p style={{ margin: 0, fontSize: 11, color: 'var(--text-secondary)' }}>{t.descripcion} · {new Date(t.fecha).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{fmt(t.monto)}</span>
                </div>
              ))}
          </div>
        </div>
      ) : (
        <div style={{ background: 'var(--bg-card)', borderRadius: 16, padding: '1.5rem', border: '1px solid var(--border)', marginBottom: 24, boxShadow: 'var(--shadow)' }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 6px', color: 'var(--text)' }}>Sin caja abierta</h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 16px' }}>Abrí una caja para empezar a cobrar.</p>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.5px' }}>Local</label>
            {zonaFija ? (
              <div style={{ padding: '10px', border: '1.5px solid var(--brand)', borderRadius: 10, background: 'var(--brand)', color: 'var(--on-brand)', fontSize: 14, fontWeight: 600, textAlign: 'center' }}>{zonaFija}</div>
            ) : (
              <div style={{ display: 'flex', gap: 8 }}>
                {locales.map(l => (
                  <button key={l} onClick={() => setLocal(l)} style={{ flex: 1, padding: '10px', border: `1.5px solid ${local === l ? 'var(--brand)' : 'var(--border)'}`, borderRadius: 10, background: local === l ? 'var(--brand)' : 'var(--bg-card)', color: local === l ? 'var(--on-brand)' : 'var(--text-secondary)', fontSize: 14, fontWeight: local === l ? 600 : 400, cursor: 'pointer' }}>{l}</button>
                ))}
              </div>
            )}
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.5px' }}>Fondo inicial</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              {[0, 500, 1000, 2000].map(n => (
                <button key={n} onClick={() => setFondoCaja(String(n))} style={{ flex: 1, padding: '9px', border: `1.5px solid ${fondoCaja == n ? 'var(--brand)' : 'var(--border)'}`, borderRadius: 9, background: fondoCaja == n ? 'var(--brand)' : 'var(--bg-card)', color: fondoCaja == n ? 'var(--on-brand)' : 'var(--text-secondary)', fontSize: 13, cursor: 'pointer' }}>{fmt(n)}</button>
              ))}
            </div>
            <input type="number" value={fondoCaja} onChange={e => setFondoCaja(e.target.value)} placeholder="Otro monto" />
          </div>
          <button onClick={handleAbrirCaja} style={{ width: '100%', padding: '14px', border: 'none', borderRadius: 12, background: 'var(--green)', color: 'var(--on-brand)', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>Abrir caja</button>
        </div>
      )}

      <div style={{ background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Mis turnos anteriores</h2>
        </div>
        {misCajas.filter(c => !c.abierta).length === 0
          ? <p style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>Sin turnos anteriores</p>
          : misCajas.filter(c => !c.abierta).map(c => (
            <button key={c.id} onClick={() => abrirTurno(c)} title="Ver el detalle del turno" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', border: 'none', borderBottom: '1px solid var(--border-light)', flexWrap: 'wrap', gap: 8, width: '100%', background: 'none', textAlign: 'left', cursor: 'pointer', font: 'inherit', color: 'inherit' }}>
              <div>
                <p style={{ margin: '0 0 2px', fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{c.local}</p>
                <p style={{ margin: 0, fontSize: 11, color: 'var(--text-secondary)' }}>
                  {new Date(c.apertura).toLocaleString('es-AR')}{c.cierre && ` → ${new Date(c.cierre).toLocaleString('es-AR')}`}
                </p>
                <p style={{ margin: 0, fontSize: 11, color: 'var(--text-secondary)' }}>Fondo: {fmt(c.fondo)} · {c.tx_count} transacciones</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{fmt(c.ventas)}</p>
                <p style={{ margin: 0, fontSize: 11, color: 'var(--text-secondary)' }}>Total vendido ›</p>
              </div>
            </button>
          ))}
      </div>

      {turno && <DetalleTurno turno={turno} onCerrar={() => setTurno(null)} />}
    </div>
  )
}

// Ventana con el detalle de un turno ya cerrado
function DetalleTurno({ turno, onCerrar }) {
  const { caja: c, ventas, error } = turno
  const anulada = t => t.descripcion?.startsWith('[ANULADA]')
  const validas = (ventas || []).filter(t => !anulada(t))
  const anuladas = (ventas || []).filter(anulada)
  const t = totalesCaja(c)
  // Más vendidos del turno, a partir de la descripción ("Agua ×2, Alfajor")
  const productos = {}
  for (const v of validas) for (const item of (v.descripcion || '').split(', ')) {
    const m = item.match(/^(.*?)(?: ×(\d+))?$/)
    if (m?.[1]) productos[m[1]] = (productos[m[1]] || 0) + Number(m[2] || 1)
  }
  const top = Object.entries(productos).sort((a, b) => b[1] - a[1]).slice(0, 5)
  const hora = f => new Date(f).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
  const fecha = f => new Date(f).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  const celda = { background: 'var(--bg-subtle)', borderRadius: 10, padding: '8px 10px' }

  return (
    <div role="dialog" aria-modal="true" aria-label={`Turno de ${c.local}`} onClick={onCerrar} style={{ position: 'fixed', inset: 0, background: 'var(--overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-card)', borderRadius: 16, border: '1px solid var(--border)', boxShadow: 'var(--shadow-md)', width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', padding: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: 'var(--text)' }}>Turno · {c.local}</h2>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>{fecha(c.apertura)}{c.cierre ? ` → ${fecha(c.cierre)}` : ''}</p>
          </div>
          <button onClick={onCerrar} aria-label="Cerrar" style={{ background: 'none', border: 'none', fontSize: 22, lineHeight: 1, color: 'var(--text-secondary)', cursor: 'pointer' }}>×</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 8, marginBottom: 14 }}>
          {[['Fondo inicial', fmt(t.fondo)], ['Vendido', fmt(t.ventas)], ['Total', fmt(t.total)], ['Ventas', ventas ? validas.length : c.tx_count]].map(([k, v]) => (
            <div key={k} style={celda}>
              <p style={{ margin: 0, fontSize: 11, color: 'var(--text-secondary)' }}>{k}</p>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{v}</p>
            </div>
          ))}
        </div>

        {!ventas ? <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Cargando ventas…</p> : <>
          {error && <p role="alert" style={{ fontSize: 13, color: 'var(--red)' }}>{error}</p>}
          {anuladas.length > 0 && <p style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--text-secondary)' }}>{anuladas.length} anulada{anuladas.length > 1 ? 's' : ''} (no suman)</p>}
          {top.length > 0 && <>
            <h3 style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Más vendidos</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
              {top.map(([nombre, n]) => <span key={nombre} style={{ fontSize: 12, padding: '3px 8px', borderRadius: 6, background: 'var(--bg-subtle)', color: 'var(--text)' }}>{nombre} · {n}</span>)}
            </div>
          </>}
          <h3 style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Ventas</h3>
          {ventas.length === 0
            ? <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>{error ? '' : 'No hubo ventas en este turno.'}</p>
            : <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
              {ventas.map(v => (
                <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '9px 12px', borderBottom: '1px solid var(--border-light)', opacity: anulada(v) ? 0.55 : 1 }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{v.alumno_nombre || 'Alumno'}{v.offline && <span style={{ fontSize: 11, color: 'var(--amber)' }}> · sin conexión</span>}</p>
                    <p style={{ margin: 0, fontSize: 11, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{hora(v.fecha)} · {(v.descripcion || '').replace(/^\[ANULADA\] /, '')}</p>
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', textDecoration: anulada(v) ? 'line-through' : 'none', whiteSpace: 'nowrap' }}>{fmt(v.monto)}</span>
                </div>
              ))}
            </div>}
        </>}
      </div>
    </div>
  )
}