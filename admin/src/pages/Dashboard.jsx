import { useState, useEffect } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'
import api from '../api/axios'

const fmt = n => `$${Number(n).toLocaleString('es-AR')}`

function StatCard({ label, value, sub, color, icon }) {
  return (
    <div style={{ background: 'white', borderRadius: 12, padding: '1.25rem', border: '1px solid #F0F0F0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p style={{ margin: '0 0 6px', fontSize: 12, color: '#999', fontWeight: 500 }}>{label}</p>
          <p style={{ margin: 0, fontSize: 24, fontWeight: 600, color: color || '#111' }}>{value}</p>
          {sub && <p style={{ margin: '4px 0 0', fontSize: 12, color: '#999' }}>{sub}</p>}
        </div>
        {icon && <div style={{ width: 36, height: 36, borderRadius: 10, background: '#F8F9FA', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}>{icon}</div>}
      </div>
    </div>
  )
}

function SectionTitle({ children }) {
  return <h2 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 14px', color: '#111' }}>{children}</h2>
}

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [transacciones, setTransacciones] = useState([])
  const [alumnos, setAlumnos] = useState([])
  const [cajas, setCajas] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    const cargar = async () => {
      try {
        const [txRes, alumRes, cajaRes] = await Promise.all([
          api.get('/transacciones'),
          api.get('/alumnos'),
          api.get('/cajas'),
        ])
        setTransacciones(txRes.data)
        setAlumnos(alumRes.data)
        setCajas(cajaRes.data)
      } catch (err) {
        console.error(err)
      } finally {
        setCargando(false)
      }
    }
    cargar()
  }, [])

  const hoy = new Date().toISOString().slice(0, 10)
  const txHoy = transacciones.filter(t => t.fecha?.slice(0, 10) === hoy)
  const ventasHoy = txHoy.filter(t => t.tipo === 'compra').reduce((s, t) => s + parseFloat(t.monto), 0)
  const recargasHoy = txHoy.filter(t => t.tipo === 'recarga').reduce((s, t) => s + parseFloat(t.monto), 0)
  const totalSaldo = alumnos.reduce((s, a) => s + parseFloat(a.saldo), 0)
  const bajaSaldo = alumnos.filter(a => parseFloat(a.saldo) < 200 && a.activo)
  const cajasAbiertas = cajas.filter(c => c.abierta)

  // ventas últimos 7 días
  const ultimos7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    const fecha = d.toISOString().slice(0, 10)
    const total = transacciones.filter(t => t.fecha?.slice(0, 10) === fecha && t.tipo === 'compra').reduce((s, t) => s + parseFloat(t.monto), 0)
    return { dia: d.toLocaleDateString('es-AR', { weekday: 'short' }), total }
  })

  // ventas por local
  const porLocal = {}
  transacciones.filter(t => t.tipo === 'compra').forEach(t => {
    porLocal[t.lugar] = (porLocal[t.lugar] || 0) + parseFloat(t.monto)
  })
  const dataLocal = Object.entries(porLocal).map(([local, total]) => ({ local, total }))

  // productos más vendidos
  const rankProds = {}
  transacciones.filter(t => t.tipo === 'compra').forEach(t =>
    t.descripcion?.split(', ').forEach(d => {
      const n = d.replace(/ ×\d+/, '')
      rankProds[n] = (rankProds[n] || 0) + 1
    })
  )
  const topProds = Object.entries(rankProds).sort((a, b) => b[1] - a[1]).slice(0, 5)

  if (cargando) return <div style={{ color: '#999', padding: '2rem' }}>Cargando...</div>

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, margin: '0 0 4px' }}>Dashboard</h1>
        <p style={{ color: '#999', fontSize: 13, margin: 0 }}>{new Date().toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>

      {/* stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 24 }}>
        <StatCard label="Ventas hoy" value={fmt(ventasHoy)} sub={`${txHoy.filter(t => t.tipo === 'compra').length} transacciones`}
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>} />
        <StatCard label="Recargas hoy" value={fmt(recargasHoy)} color="#16A34A"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>} />
        <StatCard label="Saldo en sistema" value={fmt(totalSaldo)} sub={`${alumnos.length} alumnos`}
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>} />
        <StatCard label="Cajas abiertas" value={cajasAbiertas.length} sub={cajasAbiertas.map(c => c.local).join(', ') || 'Ninguna'}
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/></svg>} />
      </div>

      {/* gráficos */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <div style={{ background: 'white', borderRadius: 12, padding: '1.25rem', border: '1px solid #F0F0F0' }}>
          <SectionTitle>Ventas últimos 7 días</SectionTitle>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={ultimos7}>
              <defs>
                <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#111" stopOpacity={0.08}/>
                  <stop offset="95%" stopColor="#111" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0"/>
              <XAxis dataKey="dia" tick={{ fontSize: 11, fill: '#999' }} axisLine={false} tickLine={false}/>
              <YAxis tick={{ fontSize: 11, fill: '#999' }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`}/>
              <Tooltip formatter={v => fmt(v)} contentStyle={{ borderRadius: 8, border: '1px solid #F0F0F0', fontSize: 12 }}/>
              <Area type="monotone" dataKey="total" stroke="#111" strokeWidth={2} fill="url(#grad)"/>
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div style={{ background: 'white', borderRadius: 12, padding: '1.25rem', border: '1px solid #F0F0F0' }}>
          <SectionTitle>Ventas por local</SectionTitle>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={dataLocal}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0"/>
              <XAxis dataKey="local" tick={{ fontSize: 11, fill: '#999' }} axisLine={false} tickLine={false}/>
              <YAxis tick={{ fontSize: 11, fill: '#999' }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`}/>
              <Tooltip formatter={v => fmt(v)} contentStyle={{ borderRadius: 8, border: '1px solid #F0F0F0', fontSize: 12 }}/>
              <Bar dataKey="total" fill="#111" radius={[4, 4, 0, 0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        {/* top productos */}
        <div style={{ background: 'white', borderRadius: 12, padding: '1.25rem', border: '1px solid #F0F0F0' }}>
          <SectionTitle>Productos más vendidos</SectionTitle>
          {topProds.length === 0 ? <p style={{ color: '#999', fontSize: 13 }}>Sin datos</p> : topProds.map(([nombre, cnt], i) => (
            <div key={nombre} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: i < topProds.length - 1 ? '1px solid #F8F9FA' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 20, height: 20, borderRadius: 6, background: '#F8F9FA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600, color: '#999' }}>{i + 1}</span>
                <span style={{ fontSize: 13 }}>{nombre}</span>
              </div>
              <span style={{ fontSize: 12, fontWeight: 500, background: '#F8F9FA', padding: '2px 8px', borderRadius: 6 }}>{cnt} ventas</span>
            </div>
          ))}
        </div>

        {/* alertas */}
        <div style={{ background: 'white', borderRadius: 12, padding: '1.25rem', border: '1px solid #F0F0F0' }}>
          <SectionTitle>Alertas — Saldo bajo</SectionTitle>
          {bajaSaldo.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#16A34A', fontSize: 13 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
              Sin alertas
            </div>
          ) : bajaSaldo.map(a => (
            <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #F8F9FA' }}>
              <div>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 500 }}>{a.nombre}</p>
                <p style={{ margin: 0, fontSize: 11, color: '#999' }}>{a.tutor} · {a.tutor_tel}</p>
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#DC2626' }}>{fmt(a.saldo)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* últimas transacciones */}
      <div style={{ background: 'white', borderRadius: 12, padding: '1.25rem', border: '1px solid #F0F0F0' }}>
        <SectionTitle>Últimas transacciones</SectionTitle>
        {transacciones.slice(0, 8).map(t => (
          <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid #F8F9FA' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: t.tipo === 'recarga' ? '#F0FDF4' : '#F8F9FA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {t.tipo === 'recarga'
                  ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>
                  : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>}
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 500 }}>{t.alumno_nombre}</p>
                <p style={{ margin: 0, fontSize: 11, color: '#999' }}>{t.descripcion} · {t.lugar} · {new Date(t.fecha).toLocaleString('es-AR')}</p>
              </div>
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: t.tipo === 'recarga' ? '#16A34A' : '#111' }}>
              {t.tipo === 'recarga' ? '+' : '-'}{fmt(t.monto)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}