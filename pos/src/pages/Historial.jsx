import { useState, useEffect } from 'react'
import { SkeletonTable } from '../components/Skeleton'
import { useCaja } from '../context/CajaContext'
import api from '../api/axios'
import { offlineHabilitado, esErrorDeRed } from '../offline/estado'
import { leerCola } from '../offline/almacen'
import { anularEnCola } from '../offline/sync'

const fmt = n => `$${Number(n).toLocaleString('es-AR')}`
// Día en Argentina (AAAA-MM-DD): con la fecha UTC, lo vendido después de las 21 h caía en el día siguiente
const diaAR = f => new Date(f).toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })

export default function Historial() {
  const { caja, actualizarVentas } = useCaja()
  const [txs, setTxs] = useState([])
  const [cargando, setCargando] = useState(true)
  const [filtro, setFiltro] = useState('turno')
  const [busq, setBusq] = useState('')
  const [msg, setMsg] = useState(null)

  const showMsg = (tipo, texto) => { setMsg({ tipo, texto }); setTimeout(() => setMsg(m => (m?.texto === texto ? null : m)), 5000) }

  useEffect(() => { cargar() }, [])

  // Las ventas hechas sin internet que todavía no se subieron se muestran
  // primero, marcadas "Por subir" (vienen de la cola del equipo)
  const cargar = async () => {
    let enCola = []
    if (offlineHabilitado()) {
      try {
        enCola = (await leerCola()).reverse().map(v => ({
          id: 'cola-' + v.id_venta, id_venta: v.id_venta, pendiente: true, error: v.error, anulada: !!v.anulada, tipo: 'compra', alumno_nombre: v.alumno_nombre,
          descripcion: v.items.map(i => `${i.nombre}${i.qty > 1 ? ` ×${i.qty}` : ''}`).join(', '), lugar: v.lugar, fecha: v.fecha, monto: v.total,
        }))
      } catch { /* sin cola */ }
    }
    try { const tRes = await api.get('/transacciones'); setTxs([...enCola, ...(tRes.data.data ?? tRes.data)]) }
    catch (err) {
      setTxs(enCola)
      showMsg('error', esErrorDeRed(err) ? 'Sin internet: se muestran solo las ventas de este equipo que faltan subir' : err.response?.data?.error || 'No se pudo cargar el historial')
    } finally { setCargando(false) }
  }

  // Anular una venta hecha sin internet que todavía no se subió: sale de la cola
  const anularPendiente = async t => {
    if (!confirm(`¿Anular la venta de ${fmt(t.monto)} a ${t.alumno_nombre}? Todavía no se subió, así que no le llega a la familia.`)) return
    if (await anularEnCola(t.id_venta)) actualizarVentas(-t.monto)
    cargar()
  }

  const hoy = diaAR(new Date())
  const esAnulada = t => t.anulada || t.descripcion?.startsWith('[ANULADA]')

  const txsFiltradas = txs.filter(t => {
    const matchBusq = busq === '' || t.alumno_nombre?.toLowerCase().includes(busq.toLowerCase()) || t.descripcion?.toLowerCase().includes(busq.toLowerCase())
    if (filtro === 'turno' && caja) {
      const inicio = new Date(caja.apertura)
      const fecha = new Date(t.fecha)
      return t.lugar === caja.local && fecha >= inicio && t.tipo === 'compra' && matchBusq
    }
    if (filtro === 'hoy') return t.fecha && diaAR(t.fecha) === hoy && t.tipo === 'compra' && matchBusq
    return t.tipo === 'compra' && matchBusq
  })

  // las anuladas se ven (tachadas) pero no suman
  const validas = txsFiltradas.filter(t => !esAnulada(t))
  const totalFiltrado = validas.reduce((s, t) => s + parseFloat(t.monto), 0)

  if (cargando) return <SkeletonTable rows={8} cols={4} />

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, margin: '0 0 4px', color: 'var(--text)' }}>Historial de ventas</h1>
        <p style={{ color: 'var(--text)', fontSize: 13, margin: 0 }}>{txsFiltradas.length} transacciones</p>
      </div>

      {msg && <div style={{ padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16, background: msg.tipo === 'ok' ? 'var(--green-bg)' : 'var(--red-bg)', color: msg.tipo === 'ok' ? 'var(--green)' : 'var(--red)', borderLeft: `3px solid ${msg.tipo === 'ok' ? 'var(--green)' : 'var(--red)'}` }}>{msg.texto}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 16 }}>
        {[
          { label: filtro === 'turno' ? 'Total del turno' : filtro === 'hoy' ? 'Total de hoy' : 'Total general', value: fmt(totalFiltrado), color: 'var(--green)' },
          { label: 'Transacciones', value: validas.length, color: 'var(--text)' },
          { label: 'Ticket promedio', value: validas.length > 0 ? fmt(Math.round(totalFiltrado / validas.length)) : '$0', color: 'var(--text)' },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--bg-card)', borderRadius: 12, padding: '1rem', border: '1px solid var(--border)', boxShadow: 'var(--shadow)' }}>
            <p style={{ margin: '0 0 4px', fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.5px' }}>{s.label}</p>
            <p style={{ margin: 0, fontSize: 20, fontWeight: 600, color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {[['turno', 'Mi turno'], ['hoy', 'Hoy'], ['todo', 'Todo']].map(([val, label]) => (
          <button key={val} onClick={() => setFiltro(val)} style={{ padding: '6px 14px', border: `1px solid ${filtro === val ? 'var(--brand)' : 'var(--border)'}`, borderRadius: 8, background: filtro === val ? 'var(--brand)' : 'var(--bg-card)', color: filtro === val ? 'var(--on-brand)' : 'var(--text-secondary)', fontSize: 13, cursor: 'pointer', fontWeight: filtro === val ? 500 : 400 }}>{label}</button>
        ))}
        <input placeholder="Buscar alumno o producto..." value={busq} onChange={e => setBusq(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
      </div>

      <div style={{ background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
        {txsFiltradas.length === 0
          ? <p style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>Sin transacciones</p>
          : txsFiltradas.map((t, i) => (
            <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: i < txsFiltradas.length - 1 ? '1px solid var(--border-light)' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--bg-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', flexShrink: 0 }}>
                  {t.alumno_nombre?.split(' ').slice(0, 2).map(n => n[0]).join('') || '?'}
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{t.alumno_nombre}
                    {(t.anulada || t.descripcion?.startsWith('[ANULADA]')) && <span style={{ display: 'inline-block', marginLeft: 6, fontSize: 11, fontWeight: 500, padding: '1px 7px', borderRadius: 6, background: 'var(--bg-subtle)', color: 'var(--text-secondary)', whiteSpace: 'nowrap', verticalAlign: '1px' }}>Anulada</span>}
                    {t.pendiente ? (t.error ? <span style={{ display: 'inline-block', marginLeft: 6, fontSize: 11, fontWeight: 500, padding: '1px 7px', borderRadius: 6, background: 'var(--red-bg)', color: 'var(--red)', whiteSpace: 'nowrap', verticalAlign: '1px' }}>No se pudo subir</span> : <span style={{ display: 'inline-block', marginLeft: 6, fontSize: 11, fontWeight: 500, padding: '1px 7px', borderRadius: 6, background: 'var(--brand-light)', color: 'var(--brand)', whiteSpace: 'nowrap', verticalAlign: '1px' }}>Por subir</span>)
                      : t.offline && <span style={{ display: 'inline-block', marginLeft: 6, fontSize: 11, fontWeight: 500, padding: '1px 7px', borderRadius: 6, background: 'var(--amber-bg)', color: 'var(--amber)', whiteSpace: 'nowrap', verticalAlign: '1px' }}>Sin conexión</span>}
                  </p>
                  <p style={{ margin: 0, fontSize: 11, color: 'var(--text-secondary)' }}>{t.descripcion?.replace(/^\[ANULADA\]\s*/, '')} · {t.lugar} · {new Date(t.fecha).toLocaleString('es-AR')}</p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {t.pendiente && !t.error && !t.anulada && <button onClick={() => anularPendiente(t)} style={{ padding: '5px 12px', border: 'none', borderRadius: 7, background: 'var(--red-bg)', color: 'var(--red)', fontSize: 12, fontWeight: 600 }}>Anular</button>}
                <span style={{ fontSize: 14, fontWeight: 700, color: esAnulada(t) ? 'var(--text-tertiary)' : 'var(--text)', textDecoration: esAnulada(t) ? 'line-through' : 'none' }}>{fmt(t.monto)}</span>
              </div>
            </div>
          ))}
      </div>
    </div>
  )
}