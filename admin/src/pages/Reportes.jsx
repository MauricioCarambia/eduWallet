import { useState, useEffect } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts'
import api from '../api/axios'

const fmt = n => `$${Number(n).toLocaleString('es-AR')}`

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
      setTxs(tRes.data)
      setAlumnos(aRes.data)
    } catch (err) {
      console.error(err)
    } finally {
      setCargando(false)
    }
  }

  const cursos = ['Todos', ...new Set(alumnos.map(a => a.curso))]

  // datos por período
  const getDias = () => {
    const n = periodo === 'semana' ? 7 : periodo === 'mes' ? 30 : 90
    return Array.from({ length: n }, (_, i) => {
      const d = new Date()
      d.setDate(d.getDate() - (n - 1 - i))
      const fecha = d.toISOString().slice(0, 10)
      const ventas = txs.filter(t => t.fecha?.slice(0, 10) === fecha && t.tipo === 'compra').reduce((s, t) => s + parseFloat(t.monto), 0)
      const recargas = txs.filter(t => t.fecha?.slice(0, 10) === fecha && t.tipo === 'recarga').reduce((s, t) => s + parseFloat(t.monto), 0)
      const label = periodo === 'semana'
        ? d.toLocaleDateString('es-AR', { weekday: 'short' })
        : d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })
      return { label, ventas, recargas, fecha }
    })
  }

  const dias = getDias()
  const totalVentas = dias.reduce((s, d) => s + d.ventas, 0)
  const totalRecargas = dias.reduce((s, d) => s + d.recargas, 0)
  const ticketPromedio = txs.filter(t => t.tipo === 'compra').length > 0
    ? totalVentas / txs.filter(t => t.tipo === 'compra').length : 0

  // ventas por local
  const porLocal = {}
  txs.filter(t => t.tipo === 'compra').forEach(t => {
    porLocal[t.lugar] = (porLocal[t.lugar] || 0) + parseFloat(t.monto)
  })

  // ranking alumnos
  const porAlumno = {}
  txs.filter(t => t.tipo === 'compra').forEach(t => {
    porAlumno[t.alumno_nombre] = (porAlumno[t.alumno_nombre] || 0) + parseFloat(t.monto)
  })
  const topAlumnos = Object.entries(porAlumno).sort((a, b) => b[1] - a[1]).slice(0, 5)

  // exportar CSV
  const exportCSV = () => {
    const rows = [
      ['ID', 'Alumno', 'Monto', 'Lugar', 'Descripción', 'Fecha', 'Tipo'],
      ...txs.map(t => [t.id, t.alumno_nombre, t.monto, t.lugar, t.descripcion, new Date(t.fecha).toLocaleString('es-AR'), t.tipo])
    ]
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `eduwallet_${periodo}.csv`; a.click()
  }

  // recarga masiva
  const recargaMasiva = async () => {
    const m = parseInt(montoRecarga)
    if (!m || m <= 0) return
    const targets = filtroCurso === 'Todos' ? alumnos : alumnos.filter(a => a.curso === filtroCurso)
    try {
      for (const a of targets) {
        await api.post(`/alumnos/${a.id}/recargar`, { monto: m, empleado_id: 1, descripcion: `Recarga masiva (${filtroCurso})` })
      }
      const aRes = await api.get('/alumnos')
      setAlumnos(aRes.data)
      showMsg('ok', `Recarga de ${fmt(m)} aplicada a ${targets.length} alumnos`)
      setMontoRecarga('')
    } catch (err) { showMsg('error', 'Error en recarga masiva') }
  }

  if (cargando) return <div style={{ color: '#999' }}>Cargando...</div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: '0 0 4px' }}>Reportes</h1>
          <p style={{ color: '#999', fontSize: 13, margin: 0 }}>Análisis de ventas y movimientos</p>
        </div>
        <button onClick={exportCSV} style={{ padding: '8px 16px', border: '1px solid #F0F0F0', borderRadius: 8, background: 'white', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: '#666' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Exportar CSV
        </button>
      </div>

      {msg && <div style={{ padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16, background: msg.tipo === 'ok' ? '#F0FDF4' : '#FEF2F2', color: msg.tipo === 'ok' ? '#16A34A' : '#DC2626' }}>{msg.texto}</div>}

      {/* selector período */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {[['semana', '7 días'], ['mes', '30 días'], ['trimestre', '90 días']].map(([val, label]) => (
          <button key={val} onClick={() => setPeriodo(val)} style={{ padding: '6px 14px', border: `1px solid ${periodo === val ? '#111' : '#F0F0F0'}`, borderRadius: 8, background: periodo === val ? '#111' : 'white', color: periodo === val ? 'white' : '#666', fontSize: 13, cursor: 'pointer', fontWeight: periodo === val ? 500 : 400 }}>{label}</button>
        ))}
      </div>

      {/* stats del período */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: `Ventas (${periodo})`, value: fmt(totalVentas) },
          { label: `Recargas (${periodo})`, value: fmt(totalRecargas), color: '#16A34A' },
          { label: 'Ticket promedio', value: fmt(Math.round(ticketPromedio)) },
          { label: 'Transacciones', value: txs.filter(t => t.tipo === 'compra').length },
        ].map(s => (
          <div key={s.label} style={{ background: 'white', borderRadius: 12, padding: '1rem', border: '1px solid #F0F0F0' }}>
            <p style={{ margin: '0 0 4px', fontSize: 11, color: '#999', fontWeight: 500 }}>{s.label}</p>
            <p style={{ margin: 0, fontSize: 22, fontWeight: 600, color: s.color || '#111' }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* gráfico ventas vs recargas */}
      <div style={{ background: 'white', borderRadius: 12, padding: '1.25rem', border: '1px solid #F0F0F0', marginBottom: 16 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 16px' }}>Ventas vs Recargas</h2>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={dias}>
            <defs>
              <linearGradient id="gVentas" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#111" stopOpacity={0.08}/>
                <stop offset="95%" stopColor="#111" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="gRecargas" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#16A34A" stopOpacity={0.08}/>
                <stop offset="95%" stopColor="#16A34A" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0"/>
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#999' }} axisLine={false} tickLine={false}/>
            <YAxis tick={{ fontSize: 11, fill: '#999' }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`}/>
            <Tooltip formatter={v => fmt(v)} contentStyle={{ borderRadius: 8, border: '1px solid #F0F0F0', fontSize: 12 }}/>
            <Legend wrapperStyle={{ fontSize: 12 }}/>
            <Area type="monotone" dataKey="ventas" name="Ventas" stroke="#111" strokeWidth={2} fill="url(#gVentas)"/>
            <Area type="monotone" dataKey="recargas" name="Recargas" stroke="#16A34A" strokeWidth={2} fill="url(#gRecargas)"/>
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* ventas por local */}
        <div style={{ background: 'white', borderRadius: 12, padding: '1.25rem', border: '1px solid #F0F0F0' }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 16px' }}>Distribución por local</h2>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={Object.entries(porLocal).map(([local, total]) => ({ local, total }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0"/>
              <XAxis dataKey="local" tick={{ fontSize: 11, fill: '#999' }} axisLine={false} tickLine={false}/>
              <YAxis tick={{ fontSize: 11, fill: '#999' }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`}/>
              <Tooltip formatter={v => fmt(v)} contentStyle={{ borderRadius: 8, border: '1px solid #F0F0F0', fontSize: 12 }}/>
              <Bar dataKey="total" name="Ventas" fill="#111" radius={[4, 4, 0, 0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* top alumnos */}
        <div style={{ background: 'white', borderRadius: 12, padding: '1.25rem', border: '1px solid #F0F0F0' }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 14px' }}>Top alumnos por gasto</h2>
          {topAlumnos.map(([nombre, total], i) => (
            <div key={nombre} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: i < topAlumnos.length - 1 ? '1px solid #F8F9FA' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 20, height: 20, borderRadius: 6, background: '#F8F9FA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600, color: '#999' }}>{i + 1}</span>
                <span style={{ fontSize: 13 }}>{nombre}</span>
              </div>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{fmt(total)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* recarga masiva */}
      <div style={{ background: 'white', borderRadius: 12, padding: '1.25rem', border: '1px solid #F0F0F0' }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 6px' }}>Recarga masiva</h2>
        <p style={{ fontSize: 13, color: '#999', margin: '0 0 14px' }}>Cargá saldo a todos los alumnos de un curso o a toda la escuela de una sola vez.</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#555', marginBottom: 5 }}>Curso</label>
            <select value={filtroCurso} onChange={e => setFiltroCurso(e.target.value)} style={{ minWidth: 160 }}>
              {cursos.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#555', marginBottom: 5 }}>Monto por alumno</label>
            <input type="number" placeholder="Ej: 500" value={montoRecarga} onChange={e => setMontoRecarga(e.target.value)} style={{ width: 140 }} />
          </div>
          <div>
            <p style={{ margin: '0 0 5px', fontSize: 12, color: '#999' }}>
              {filtroCurso === 'Todos' ? alumnos.length : alumnos.filter(a => a.curso === filtroCurso).length} alumnos · Total: {fmt((parseInt(montoRecarga) || 0) * (filtroCurso === 'Todos' ? alumnos.length : alumnos.filter(a => a.curso === filtroCurso).length))}
            </p>
            <button onClick={recargaMasiva} style={{ padding: '8px 20px', border: 'none', borderRadius: 8, background: '#111', color: 'white', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>Aplicar recarga</button>
          </div>
        </div>
      </div>
    </div>
  )
}