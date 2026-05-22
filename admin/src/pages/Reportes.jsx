import { useState, useEffect } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts'
import api from '../api/axios'

const fmt = n => `$${Number(n).toLocaleString('es-AR')}`
const tooltipStyle = { borderRadius: 8, border: '1px solid var(--border)', fontSize: 12, background: 'var(--bg-card)', color: 'var(--text)' }

export default function Reportes() {
  const [txs, setTxs] = useState([])
  const [alumnos, setAlumnos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [periodo, setPeriodo] = useState('semana')
  const [filtroCurso, setFiltroCurso] = useState('Todos')
  const [montoRecarga, setMontoRecarga] = useState('')
  const [msg, setMsg] = useState(null)

  const showMsg = (tipo, texto) => { setMsg({ tipo, texto }); setTimeout(() => setMsg(null), 3000) }

  useEffect(() => { cargar() }, [])

  const cargar = async () => {
    try {
      const [tRes, aRes] = await Promise.all([api.get('/transacciones'), api.get('/alumnos')])
      setTxs(tRes.data); setAlumnos(aRes.data)
    } catch (err) { console.error(err) }
    finally { setCargando(false) }
  }

  const cursos = ['Todos', ...new Set(alumnos.map(a => a.curso))]

  const getDias = () => {
    const n = periodo === 'semana' ? 7 : periodo === 'mes' ? 30 : 90
    return Array.from({ length: n }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (n - 1 - i))
      const fecha = d.toISOString().slice(0, 10)
      const ventas = txs.filter(t => t.fecha?.slice(0, 10) === fecha && t.tipo === 'compra').reduce((s, t) => s + parseFloat(t.monto), 0)
      const recargas = txs.filter(t => t.fecha?.slice(0, 10) === fecha && t.tipo === 'recarga').reduce((s, t) => s + parseFloat(t.monto), 0)
      return { label: periodo === 'semana' ? d.toLocaleDateString('es-AR', { weekday: 'short' }) : d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }), ventas, recargas }
    })
  }

  const dias = getDias()
  const totalVentas = dias.reduce((s, d) => s + d.ventas, 0)
  const totalRecargas = dias.reduce((s, d) => s + d.recargas, 0)
  const txCompras = txs.filter(t => t.tipo === 'compra')
  const ticketPromedio = txCompras.length > 0 ? totalVentas / txCompras.length : 0

  const porLocal = {}
  txCompras.forEach(t => porLocal[t.lugar] = (porLocal[t.lugar] || 0) + parseFloat(t.monto))

  const porAlumno = {}
  txCompras.forEach(t => porAlumno[t.alumno_nombre] = (porAlumno[t.alumno_nombre] || 0) + parseFloat(t.monto))
  const topAlumnos = Object.entries(porAlumno).sort((a, b) => b[1] - a[1]).slice(0, 5)

  const exportCSV = () => {
    const rows = [['ID', 'Alumno', 'Monto', 'Lugar', 'Descripción', 'Fecha', 'Tipo'], ...txs.map(t => [t.id, t.alumno_nombre, t.monto, t.lugar, t.descripcion, new Date(t.fecha).toLocaleString('es-AR'), t.tipo])]
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `eduwallet_${periodo}.csv`; a.click()
  }

  const recargaMasiva = async () => {
    const m = parseInt(montoRecarga); if (!m || m <= 0) return
    const targets = filtroCurso === 'Todos' ? alumnos : alumnos.filter(a => a.curso === filtroCurso)
    try {
      for (const a of targets) await api.post(`/alumnos/${a.id}/recargar`, { monto: m, empleado_id: 1, descripcion: `Recarga masiva (${filtroCurso})` })
      const aRes = await api.get('/alumnos'); setAlumnos(aRes.data)
      showMsg('ok', `Recarga de ${fmt(m)} aplicada a ${targets.length} alumnos`)
      setMontoRecarga('')
    } catch { showMsg('error', 'Error en recarga masiva') }
  }

  if (cargando) return <div style={{ color: 'var(--text-tertiary)' }}>Cargando...</div>

  const periodoBtn = (val, label) => (
    <button onClick={() => setPeriodo(val)} style={{ padding: '7px 16px', border: `1.5px solid ${periodo === val ? '#1E3A5F' : 'var(--border)'}`, borderRadius: 'var(--radius)', background: periodo === val ? '#1E3A5F' : 'var(--bg-card)', color: periodo === val ? 'white' : 'var(--text-secondary)', fontSize: 13, fontWeight: periodo === val ? 600 : 400, cursor: 'pointer' }}>{label}</button>
  )

  const cardStyle = { background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: '1.25rem', border: '1.5px solid var(--border)', boxShadow: 'var(--shadow)' }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 4px', color: 'var(--text)' }}>Reportes</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: 0 }}>Análisis de ventas y movimientos</p>
        </div>
        <button onClick={exportCSV} style={{ padding: '8px 16px', border: '1.5px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--bg-card)', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)', fontWeight: 500 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Exportar CSV
        </button>
      </div>

      {msg && <div style={{ padding: '10px 14px', borderRadius: 'var(--radius)', fontSize: 13, marginBottom: 16, background: msg.tipo === 'ok' ? 'var(--green-bg)' : 'var(--red-bg)', color: msg.tipo === 'ok' ? 'var(--green)' : 'var(--red)', borderLeft: `3px solid ${msg.tipo === 'ok' ? 'var(--green)' : 'var(--red)'}` }}>{msg.texto}</div>}

      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {periodoBtn('semana', '7 días')}
        {periodoBtn('mes', '30 días')}
        {periodoBtn('trimestre', '90 días')}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: `Ventas (${periodo})`, value: fmt(totalVentas) },
          { label: `Recargas (${periodo})`, value: fmt(totalRecargas), color: 'var(--green)' },
          { label: 'Ticket promedio', value: fmt(Math.round(ticketPromedio)) },
          { label: 'Transacciones', value: txCompras.length },
        ].map(s => (
          <div key={s.label} style={cardStyle}>
            <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.5px' }}>{s.label}</p>
            <p style={{ margin: 0, fontSize: 24, fontWeight: 700, color: s.color || 'var(--text)' }}>{s.value}</p>
          </div>
        ))}
      </div>

      <div style={{ ...cardStyle, marginBottom: 16 }}>
        <h2 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 16px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.5px' }}>Ventas vs Recargas</h2>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={dias}>
            <defs>
              <linearGradient id="gV" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#1E3A5F" stopOpacity={0.15}/><stop offset="95%" stopColor="#1E3A5F" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="gR" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#059669" stopOpacity={0.15}/><stop offset="95%" stopColor="#059669" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)"/>
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false}/>
            <YAxis tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`}/>
            <Tooltip formatter={v => fmt(v)} contentStyle={tooltipStyle}/>
            <Legend wrapperStyle={{ fontSize: 12 }}/>
            <Area type="monotone" dataKey="ventas" name="Ventas" stroke="#1E3A5F" strokeWidth={2} fill="url(#gV)"/>
            <Area type="monotone" dataKey="recargas" name="Recargas" stroke="#059669" strokeWidth={2} fill="url(#gR)"/>
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div style={cardStyle}>
          <h2 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 16px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.5px' }}>Por local</h2>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={Object.entries(porLocal).map(([local, total]) => ({ local, total }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)"/>
              <XAxis dataKey="local" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false}/>
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`}/>
              <Tooltip formatter={v => fmt(v)} contentStyle={tooltipStyle}/>
              <Bar dataKey="total" fill="#1E3A5F" radius={[6, 6, 0, 0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={cardStyle}>
          <h2 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 14px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.5px' }}>Top alumnos</h2>
          {topAlumnos.map(([nombre, total], i) => (
            <div key={nombre} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: i < topAlumnos.length - 1 ? '1px solid var(--border-light)' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 22, height: 22, borderRadius: 6, background: 'var(--bg)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)' }}>{i + 1}</span>
                <span style={{ fontSize: 13, color: 'var(--text)' }}>{nombre}</span>
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{fmt(total)}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={cardStyle}>
        <h2 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 6px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.5px' }}>Recarga masiva</h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 14px' }}>Cargá saldo a todos los alumnos de un curso de una sola vez.</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.5px' }}>Curso</label>
            <select value={filtroCurso} onChange={e => setFiltroCurso(e.target.value)} style={{ minWidth: 160 }}>
              {cursos.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.5px' }}>Monto por alumno</label>
            <input type="number" placeholder="Ej: 500" value={montoRecarga} onChange={e => setMontoRecarga(e.target.value)} style={{ width: 140 }} />
          </div>
          <div>
            <p style={{ margin: '0 0 5px', fontSize: 12, color: 'var(--text-tertiary)' }}>
              {filtroCurso === 'Todos' ? alumnos.length : alumnos.filter(a => a.curso === filtroCurso).length} alumnos · Total: {fmt((parseInt(montoRecarga) || 0) * (filtroCurso === 'Todos' ? alumnos.length : alumnos.filter(a => a.curso === filtroCurso).length))}
            </p>
            <button onClick={recargaMasiva} style={{ padding: '9px 20px', border: 'none', borderRadius: 'var(--radius)', background: '#1E3A5F', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Aplicar recarga</button>
          </div>
        </div>
      </div>
    </div>
  )
}