import { useState, useEffect } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'
import { SkeletonCards, SkeletonTable } from '../components/Skeleton'
import api from '../api/axios'
import { fechaDeDia } from '../utils/fechas'

const fmt = n => `$${Number(n).toLocaleString('es-AR')}`

function StatCard({ label, value, sub, color, icon }) {
  return (
    <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: '1.25rem', border: '1.5px solid var(--border)', boxShadow: 'var(--shadow)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p style={{ margin: '0 0 6px', fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px' }}>{label}</p>
          <p style={{ margin: 0, fontSize: 26, fontWeight: 700, color: color || 'var(--text)' }}>{value}</p>
          {sub && <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>{sub}</p>}
        </div>
        {icon && (
          <div style={{ width: 40, height: 40, borderRadius: 'var(--radius)', background: 'var(--bg-subtle)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
            {icon}
          </div>
        )}
      </div>
    </div>
  )
}

function SectionTitle({ children }) {
  return <h2 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 14px', color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '.5px' }}>{children}</h2>
}

const tooltipStyle = { borderRadius: 8, border: '1px solid var(--border)', fontSize: 12, background: 'var(--bg-card)', color: 'var(--text)' }

const ACTUALIZACION_INTERVALO = 15000 // 15s

// Movimientos que suman saldo (el resto, compras, lo restan)
const SUMAN_SALDO = ['recarga', 'ajuste', 'anulacion']
const TABLERO_VACIO = { hoy: { ventas: 0, cantidad: 0, recargas: 0 }, ultimos7: [], por_local: [], top_productos: [], ultimas: [] }

export default function Dashboard() {
  // Totales calculados en el servidor (días en hora argentina, sin anuladas)
  const [tablero, setTablero] = useState(TABLERO_VACIO)
  const [alumnos, setAlumnos] = useState([])
  const [cajas, setCajas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [ultimaActualizacion, setUltimaActualizacion] = useState(null)
  const [autoActualizar, setAutoActualizar] = useState(true)

  useEffect(() => {
    let activo = true
    const cargar = async (mostrarSkeleton) => {
      if (mostrarSkeleton) setCargando(true)
      try {
        const [txRes, alumRes, cajaRes] = await Promise.all([
          api.get('/transacciones/tablero'),
          api.get('/alumnos'),
          api.get('/cajas'),
        ])
        if (!activo) return
        setTablero(txRes.data)
        setAlumnos(alumRes.data)
        setCajas(cajaRes.data)
        setUltimaActualizacion(new Date())
      } catch (err) {
        console.error(err)
      } finally {
        if (activo) setCargando(false)
      }
    }
    cargar(true)
    let id
    if (autoActualizar) {
      id = setInterval(() => cargar(false), ACTUALIZACION_INTERVALO)
    }
    return () => { activo = false; if (id) clearInterval(id) }
  }, [autoActualizar])

  const ventasHoy = tablero.hoy.ventas
  const recargasHoy = tablero.hoy.recargas
  const totalSaldo = alumnos.reduce((s, a) => s + parseFloat(a.saldo), 0)
  const bajaSaldo = alumnos.filter(a => parseFloat(a.saldo) < 200 && a.activo)
  const cajasAbiertas = cajas.filter(c => c.abierta)

  const ultimos7 = tablero.ultimos7.map(d => ({ dia: fechaDeDia(d.dia).toLocaleDateString('es-AR', { weekday: 'short', timeZone: 'UTC' }), ventas: d.ventas, recargas: d.recargas }))
  const dataLocal = tablero.por_local
  const topProds = tablero.top_productos.map(p => [p.nombre, p.unidades])

  if (cargando) return <div><SkeletonCards count={4} /><SkeletonTable rows={6} cols={4} /></div>

  return (
    <div>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 4px', color: 'var(--text)' }}>Dashboard</h1>
          <p style={{ color: 'var(--text)', fontSize: 13, margin: 0 }}>{new Date().toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {ultimaActualizacion && (
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
              {autoActualizar && (
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green)', display: 'inline-block', animation: 'pulse-dot 1.4s ease-in-out infinite' }} />
              )}
              Actualizado {ultimaActualizacion.toLocaleTimeString('es-AR')}
            </span>
          )}
          <button onClick={() => setAutoActualizar(v => !v)} style={{ fontSize: 12, padding: '6px 12px', border: '1.5px solid var(--border)', borderRadius: 8, background: autoActualizar ? 'var(--brand-light)' : 'var(--bg-card)', color: autoActualizar ? 'var(--brand)' : 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer' }}>
            {autoActualizar ? 'En vivo' : 'Pausado'}
          </button>
        </div>
      </div>

      {/* stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 24 }}>
        <StatCard label="Ventas hoy" value={fmt(ventasHoy)} sub={`${tablero.hoy.cantidad} ventas`} color="var(--text)"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>} />
        <StatCard label="Recargas hoy" value={fmt(recargasHoy)} color="var(--green)"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>} />
        <StatCard label="Saldo en sistema" value={fmt(totalSaldo)} sub={`${alumnos.length} alumnos`}
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>} />
        <StatCard label="Cajas abiertas" value={cajasAbiertas.length} sub={cajasAbiertas.map(c => c.local).join(', ') || 'Ninguna'} color={cajasAbiertas.length > 0 ? 'var(--green)' : 'var(--text)'}
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/></svg>} />
      </div>

      {/* gráficos */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: '1.25rem', border: '1.5px solid var(--border)', boxShadow: 'var(--shadow)' }}>
          <SectionTitle>Ventas últimos 7 días</SectionTitle>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={ultimos7}>
              <defs>
                <linearGradient id="gVentas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--brand)" stopOpacity={0.15}/>
                  <stop offset="95%" stopColor="var(--brand)" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)"/>
              <XAxis dataKey="dia" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false}/>
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`}/>
              <Tooltip formatter={v => fmt(v)} contentStyle={tooltipStyle}/>
              <Area type="monotone" dataKey="ventas" stroke="var(--brand)" strokeWidth={2} fill="url(#gVentas)"/>
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: '1.25rem', border: '1.5px solid var(--border)', boxShadow: 'var(--shadow)' }}>
          <SectionTitle>Ventas por local · 7 días</SectionTitle>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={dataLocal}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)"/>
              <XAxis dataKey="local" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false}/>
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`}/>
              <Tooltip formatter={v => fmt(v)} contentStyle={tooltipStyle}/>
              <Bar dataKey="total" fill="var(--brand)" radius={[6, 6, 0, 0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 24 }}>
        {/* top productos */}
        <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: '1.25rem', border: '1.5px solid var(--border)', boxShadow: 'var(--shadow)' }}>
          <SectionTitle>Más vendidos · 7 días</SectionTitle>
          {topProds.length === 0 ? <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Sin datos</p> : topProds.map(([nombre, cnt], i) => (
            <div key={nombre} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: i < topProds.length - 1 ? '1px solid var(--border-light)' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 22, height: 22, borderRadius: 6, background: 'var(--bg-subtle)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)' }}>{i + 1}</span>
                <span style={{ fontSize: 13, color: 'var(--text)' }}>{nombre}</span>
              </div>
              <span style={{ fontSize: 12, fontWeight: 600, background: 'var(--brand-light)', color: 'var(--brand)', padding: '2px 8px', borderRadius: 6 }}>{cnt} u.</span>
            </div>
          ))}
        </div>

        {/* alertas */}
        <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: '1.25rem', border: '1.5px solid var(--border)', boxShadow: 'var(--shadow)' }}>
          <SectionTitle>Alertas — Saldo bajo</SectionTitle>
          {bajaSaldo.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--green)', fontSize: 13 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
              Sin alertas
            </div>
          ) : bajaSaldo.map(a => (
            <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border-light)' }}>
              <div>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{a.nombre}</p>
                <p style={{ margin: 0, fontSize: 11, color: 'var(--text-secondary)' }}>{[[a.tutor, a.tutor_tel].filter(Boolean).join(' '), [a.contacto2, a.contacto2_tel].filter(Boolean).join(' ')].filter(Boolean).join(' · ')}</p>
              </div>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--red)' }}>{fmt(a.saldo)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* últimas transacciones */}
      <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: '1.25rem', border: '1.5px solid var(--border)', boxShadow: 'var(--shadow)' }}>
        <SectionTitle>Últimas transacciones</SectionTitle>
        {tablero.ultimas.map((t, i) => (
          <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: i < 7 ? '1px solid var(--border-light)' : 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: SUMAN_SALDO.includes(t.tipo) ? 'var(--green-bg)' : 'var(--bg-subtle)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {SUMAN_SALDO.includes(t.tipo)
                  ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>
                  : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>}
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{t.alumno_nombre}</p>
                <p style={{ margin: 0, fontSize: 11, color: 'var(--text-secondary)' }}>{t.tipo === 'recarga' && /^MP:/.test(t.descripcion || '') ? 'Recarga por Mercado Pago' : t.descripcion} · {t.lugar} · {new Date(t.fecha).toLocaleString('es-AR')}</p>
              </div>
            </div>
            <span style={{ fontSize: 14, fontWeight: 700, color: SUMAN_SALDO.includes(t.tipo) ? 'var(--green)' : 'var(--text)' }}>
              {SUMAN_SALDO.includes(t.tipo) ? '+' : '-'}{fmt(t.monto)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}