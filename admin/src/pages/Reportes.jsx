import { useState, useEffect, useMemo } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Legend, PieChart, Pie, Cell
} from 'recharts'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import api from '../api/axios'

const fmt = n => `$${Number(n).toLocaleString('es-AR')}`
const tooltipStyle = {
  borderRadius: 8, border: '1px solid var(--border)',
  fontSize: 12, background: 'var(--bg-card)', color: 'var(--text)'
}
const cardStyle = {
  background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)',
  padding: '1.25rem', border: '1.5px solid var(--border)', boxShadow: 'var(--shadow)'
}

const COLORES = ['#1E3A5F', '#059669', '#D97706', '#7C3AED', '#DC2626', '#0891B2', '#65A30D', '#DB2777']

// helpers de fecha
const toISO = d => d.toISOString().slice(0, 10)
const hoy = () => toISO(new Date())
const haceN = n => { const d = new Date(); d.setDate(d.getDate() - n); return toISO(d) }

export default function Reportes() {
  const [txs, setTxs] = useState([])
  const [alumnos, setAlumnos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [tab, setTab] = useState('general')
  const [branding, setBranding] = useState({ nombre_colegio: 'EduWallet', logo: null })
  const [generandoPDF, setGenerandoPDF] = useState(false)

  // filtros
  const [modo, setModo] = useState('rapido') // 'rapido' | 'rango'
  const [periodoRapido, setPeriodoRapido] = useState('semana')
  const [fechaDesde, setFechaDesde] = useState(haceN(7))
  const [fechaHasta, setFechaHasta] = useState(hoy())
  const [filtroLocal, setFiltroLocal] = useState('Todos')
  const [filtroCurso, setFiltroCurso] = useState('Todos')

  // recarga masiva
  const [montoRecarga, setMontoRecarga] = useState('')
  const [cursoRecarga, setCursoRecarga] = useState('Todos')
  const [msg, setMsg] = useState(null)

  const showMsg = (tipo, texto) => { setMsg({ tipo, texto }); setTimeout(() => setMsg(null), 4000) }

  // cuando cambia periodo rápido, actualizar fechas
  useEffect(() => {
    if (modo !== 'rapido') return
    const n = periodoRapido === 'semana' ? 7 : periodoRapido === 'mes' ? 30 : periodoRapido === 'trimestre' ? 90 : 365
    setFechaDesde(haceN(n - 1))
    setFechaHasta(hoy())
  }, [periodoRapido, modo])

  // recargar del backend cuando cambian fechas o local
  useEffect(() => { cargar() }, [fechaDesde, fechaHasta, filtroLocal])

  useEffect(() => {
    api.get('/configuracion/branding').then(r => setBranding(r.data)).catch(() => {})
  }, [])

  const cargar = async () => {
    setCargando(true)
    try {
      const params = new URLSearchParams({ desde: fechaDesde, hasta: fechaHasta, limit: 2000 })
      if (filtroLocal !== 'Todos') params.set('lugar', filtroLocal)
      const [tRes, aRes] = await Promise.all([
        api.get(`/transacciones?${params}`),
        api.get('/alumnos')
      ])
      setTxs(tRes.data.data ?? tRes.data)
      setAlumnos(aRes.data)
    } catch (err) { console.error(err) }
    finally { setCargando(false) }
  }

  // filtrar txs por curso (local y fechas ya vienen filtrados del backend)
  const txsFiltradas = useMemo(() => {
    return txs.filter(t => {
      if (filtroLocal !== 'Todos' && t.lugar !== filtroLocal) return false
      return true
    })
  }, [txs, filtroLocal])

  const compras = txsFiltradas.filter(t => t.tipo === 'compra')
  const recargas = txsFiltradas.filter(t => t.tipo === 'recarga')
  const totalVentas = compras.reduce((s, t) => s + parseFloat(t.monto), 0)
  const totalRecargas = recargas.reduce((s, t) => s + parseFloat(t.monto), 0)
  const ticketPromedio = compras.length > 0 ? totalVentas / compras.length : 0

  const cursos = ['Todos', ...new Set(alumnos.map(a => a.curso))]
  const locales = ['Todos', ...new Set(txs.map(t => t.lugar).filter(Boolean))]

  // datos por día para gráfico de área
  const diasEnRango = useMemo(() => {
    const desde = new Date(fechaDesde + 'T00:00:00')
    const hasta = new Date(fechaHasta + 'T00:00:00')
    const dias = []
    for (let d = new Date(desde); d <= hasta; d.setDate(d.getDate() + 1)) {
      const fecha = toISO(d)
      const ventas = compras.filter(t => t.fecha?.slice(0, 10) === fecha).reduce((s, t) => s + parseFloat(t.monto), 0)
      const recargasD = recargas.filter(t => t.fecha?.slice(0, 10) === fecha).reduce((s, t) => s + parseFloat(t.monto), 0)
      const diffDias = Math.round((hasta - desde) / (1000 * 60 * 60 * 24))
      const label = diffDias > 30
        ? d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })
        : diffDias > 7
          ? d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })
          : d.toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit' })
      dias.push({ label, fecha, ventas, recargas: recargasD })
    }
    return dias
  }, [compras, recargas, fechaDesde, fechaHasta])

  // por local
  const porLocal = useMemo(() => {
    const map = {}
    compras.forEach(t => map[t.lugar] = (map[t.lugar] || 0) + parseFloat(t.monto))
    return Object.entries(map).map(([local, total]) => ({ local, total }))
  }, [compras])

  // por producto
  const porProducto = useMemo(() => {
    const map = {}
    compras.forEach(t => {
      const items = t.descripcion?.split(',') || [t.descripcion]
      items.forEach(item => {
        const nombre = item.trim()
        if (nombre) map[nombre] = (map[nombre] || 0) + 1
      })
    })
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([nombre, cantidad]) => ({ nombre, cantidad }))
  }, [compras])

  // por curso
  const porCurso = useMemo(() => {
    const map = {}
    compras.forEach(t => {
      const alumno = alumnos.find(a => a.nombre === t.alumno_nombre)
      const curso = alumno?.curso || 'Sin curso'
      map[curso] = (map[curso] || 0) + parseFloat(t.monto)
    })
    return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([curso, total]) => ({ curso, total }))
  }, [compras, alumnos])

  // top alumnos
  const topAlumnos = useMemo(() => {
    const map = {}
    compras.forEach(t => map[t.alumno_nombre] = (map[t.alumno_nombre] || 0) + parseFloat(t.monto))
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 8)
  }, [compras])

  // tabla de transacciones filtrada por curso además
  const txsTabla = useMemo(() => {
    return compras.filter(t => {
      if (filtroCurso === 'Todos') return true
      const alumno = alumnos.find(a => a.nombre === t.alumno_nombre)
      return alumno?.curso === filtroCurso
    })
  }, [compras, filtroCurso, alumnos])

  // exportar CSV
  const exportCSV = () => {
    const rows = [
      ['ID', 'Alumno', 'Monto', 'Lugar', 'Descripción', 'Fecha', 'Tipo'],
      ...txsFiltradas.map(t => [
        t.id,
        t.alumno_nombre,
        t.monto,
        t.lugar,
        `"${t.descripcion || ''}"`,
        new Date(t.fecha).toLocaleString('es-AR'),
        t.tipo
      ])
    ]
    const csv = '\uFEFF' + rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `eduwallet_${fechaDesde}_${fechaHasta}.csv`
    a.click()
    URL.revokeObjectURL(url)
    showMsg('ok', `CSV exportado: ${txsFiltradas.length} transacciones`)
  }

  // exportar PDF
  const exportPDF = () => {
    setGenerandoPDF(true)
    try {
      const doc = new jsPDF()
      const pageWidth = doc.internal.pageSize.getWidth()
      let y = 18

      // encabezado con logo
      if (branding.logo) {
        try { doc.addImage(branding.logo, 'PNG', 14, 10, 16, 16) } catch {}
      }
      doc.setFontSize(16)
      doc.setFont(undefined, 'bold')
      doc.text(branding.nombre_colegio || 'EduWallet', branding.logo ? 34 : 14, 18)
      doc.setFontSize(10)
      doc.setFont(undefined, 'normal')
      doc.setTextColor(120)
      doc.text('Reporte de actividad', branding.logo ? 34 : 14, 24)
      doc.setTextColor(0)

      y = 34
      doc.setFontSize(11)
      doc.setFont(undefined, 'bold')
      doc.text(`Período: ${labelRango}`, 14, y)
      doc.setFont(undefined, 'normal')
      doc.text(`Generado: ${new Date().toLocaleString('es-AR')}`, pageWidth - 14, y, { align: 'right' })
      y += 8

      // resumen
      autoTable(doc, {
        startY: y,
        head: [['Ventas', 'Recargas', 'Ticket promedio', 'Promedio diario', 'Transacciones']],
        body: [[
          fmt(totalVentas),
          fmt(totalRecargas),
          fmt(Math.round(ticketPromedio)),
          fmt(Math.round(totalVentas / Math.max(diasTotal, 1))),
          String(compras.length)
        ]],
        theme: 'striped',
        headStyles: { fillColor: [30, 58, 95] },
        styles: { fontSize: 9, halign: 'center' },
      })
      y = doc.lastAutoTable.finalY + 10

      // tabla según el tab activo
      if (tab === 'productos' && porProducto.length > 0) {
        doc.setFontSize(12); doc.setFont(undefined, 'bold')
        doc.text('Productos más vendidos', 14, y); y += 4
        autoTable(doc, {
          startY: y,
          head: [['#', 'Producto', 'Unidades']],
          body: porProducto.map((p, i) => [i + 1, p.nombre, p.cantidad]),
          theme: 'grid', headStyles: { fillColor: [30, 58, 95] }, styles: { fontSize: 9 },
        })
        y = doc.lastAutoTable.finalY + 10
      } else if (tab === 'locales' && porLocal.length > 0) {
        doc.setFontSize(12); doc.setFont(undefined, 'bold')
        doc.text('Ventas por local', 14, y); y += 4
        autoTable(doc, {
          startY: y,
          head: [['Local', 'Total']],
          body: porLocal.map(l => [l.local, fmt(l.total)]),
          theme: 'grid', headStyles: { fillColor: [30, 58, 95] }, styles: { fontSize: 9 },
        })
        y = doc.lastAutoTable.finalY + 10
      } else if (tab === 'cursos' && porCurso.length > 0) {
        doc.setFontSize(12); doc.setFont(undefined, 'bold')
        doc.text('Consumo por curso', 14, y); y += 4
        autoTable(doc, {
          startY: y,
          head: [['Curso', 'Total consumido']],
          body: porCurso.map(c => [c.curso, fmt(c.total)]),
          theme: 'grid', headStyles: { fillColor: [30, 58, 95] }, styles: { fontSize: 9 },
        })
        y = doc.lastAutoTable.finalY + 10
      }

      // tabla de transacciones (siempre, hasta 200)
      if (txsFiltradas.length > 0) {
        if (y > 250) { doc.addPage(); y = 18 }
        doc.setFontSize(12); doc.setFont(undefined, 'bold')
        doc.text('Detalle de transacciones', 14, y); y += 4
        autoTable(doc, {
          startY: y,
          head: [['Alumno', 'Descripción', 'Local', 'Tipo', 'Monto', 'Fecha']],
          body: txsFiltradas.slice(0, 200).map(t => [
            t.alumno_nombre,
            (t.descripcion || '').slice(0, 40),
            t.lugar || '',
            t.tipo,
            fmt(t.monto),
            new Date(t.fecha).toLocaleString('es-AR')
          ]),
          theme: 'striped', headStyles: { fillColor: [30, 58, 95] }, styles: { fontSize: 8 },
          margin: { bottom: 14 },
        })
        if (txsFiltradas.length > 200) {
          const finalY = doc.lastAutoTable.finalY + 6
          doc.setFontSize(9); doc.setTextColor(150)
          doc.text(`Mostrando 200 de ${txsFiltradas.length} transacciones. Exportá el CSV para ver todas.`, 14, finalY)
          doc.setTextColor(0)
        }
      }

      // pie de página
      const pageCount = doc.internal.getNumberOfPages()
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        doc.setFontSize(8); doc.setTextColor(150)
        doc.text(`Página ${i} de ${pageCount} — Generado por EduWallet`, pageWidth / 2, doc.internal.pageSize.getHeight() - 8, { align: 'center' })
      }

      doc.save(`eduwallet_reporte_${fechaDesde}_${fechaHasta}.pdf`)
      showMsg('ok', 'PDF generado correctamente')
    } catch (err) {
      console.error(err)
      showMsg('error', 'Error al generar el PDF')
    } finally {
      setGenerandoPDF(false)
    }
  }

  // recarga masiva
  const recargaMasiva = async () => {
    const m = parseInt(montoRecarga); if (!m || m <= 0) return
    const targets = cursoRecarga === 'Todos' ? alumnos : alumnos.filter(a => a.curso === cursoRecarga)
    if (!confirm(`¿Recargar ${fmt(m)} a ${targets.length} alumnos?`)) return
    try {
      for (const a of targets)
        await api.post(`/alumnos/${a.id}/recargar`, { monto: m, empleado_id: 1, descripcion: `Recarga masiva (${cursoRecarga})` })
      const aRes = await api.get('/alumnos'); setAlumnos(aRes.data)
      showMsg('ok', `Recarga de ${fmt(m)} aplicada a ${targets.length} alumnos`)
      setMontoRecarga('')
    } catch { showMsg('error', 'Error en recarga masiva') }
  }

  if (cargando) return <div style={{ color: 'var(--text-tertiary)' }}>Cargando...</div>

  const diasTotal = Math.round((new Date(fechaHasta) - new Date(fechaDesde)) / (1000 * 60 * 60 * 24)) + 1
  const labelRango = modo === 'rapido'
    ? { semana: 'Últimos 7 días', mes: 'Últimos 30 días', trimestre: 'Últimos 90 días', anio: 'Último año' }[periodoRapido]
    : `${new Date(fechaDesde + 'T00:00:00').toLocaleDateString('es-AR')} → ${new Date(fechaHasta + 'T00:00:00').toLocaleDateString('es-AR')}`

  return (
    <div>
      {/* encabezado */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 4px', color: 'var(--text)' }}>Reportes</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: 0 }}>{labelRango} · {txsFiltradas.length} transacciones</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={exportPDF} disabled={generandoPDF} style={{ padding: '8px 16px', border: '1.5px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--bg-card)', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)', fontWeight: 500, opacity: generandoPDF ? 0.7 : 1 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="15" x2="15" y2="15"/><line x1="9" y1="11" x2="13" y2="11"/></svg>
            {generandoPDF ? 'Generando...' : 'Exportar PDF'}
          </button>
          <button onClick={exportCSV} style={{ padding: '8px 16px', border: '1.5px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--bg-card)', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)', fontWeight: 500 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Exportar CSV
          </button>
        </div>
      </div>

      {msg && <div style={{ padding: '10px 14px', borderRadius: 'var(--radius)', fontSize: 13, marginBottom: 16, background: msg.tipo === 'ok' ? 'var(--green-bg)' : 'var(--red-bg)', color: msg.tipo === 'ok' ? 'var(--green)' : 'var(--red)', borderLeft: `3px solid ${msg.tipo === 'ok' ? 'var(--green)' : 'var(--red)'}` }}>{msg.texto}</div>}

      {/* panel de filtros */}
      <div style={{ ...cardStyle, marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.5px', marginRight: 4 }}>Período</span>
          {/* toggle rápido / rango */}
          <button onClick={() => setModo('rapido')} style={{ padding: '5px 12px', border: `1.5px solid ${modo === 'rapido' ? 'var(--brand)' : 'var(--border)'}`, borderRadius: 'var(--radius)', background: modo === 'rapido' ? 'var(--brand)' : 'var(--bg-card)', color: modo === 'rapido' ? 'white' : 'var(--text-secondary)', fontSize: 12, cursor: 'pointer' }}>Rápido</button>
          <button onClick={() => setModo('rango')} style={{ padding: '5px 12px', border: `1.5px solid ${modo === 'rango' ? 'var(--brand)' : 'var(--border)'}`, borderRadius: 'var(--radius)', background: modo === 'rango' ? 'var(--brand)' : 'var(--bg-card)', color: modo === 'rango' ? 'white' : 'var(--text-secondary)', fontSize: 12, cursor: 'pointer' }}>Rango</button>
        </div>

        {modo === 'rapido' ? (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[['semana', '7 días'], ['mes', '30 días'], ['trimestre', '90 días'], ['anio', '1 año']].map(([val, label]) => (
              <button key={val} onClick={() => setPeriodoRapido(val)}
                style={{ padding: '7px 16px', border: `1.5px solid ${periodoRapido === val ? 'var(--brand)' : 'var(--border)'}`, borderRadius: 'var(--radius)', background: periodoRapido === val ? 'var(--brand)' : 'var(--bg-card)', color: periodoRapido === val ? 'white' : 'var(--text-secondary)', fontSize: 13, fontWeight: periodoRapido === val ? 600 : 400, cursor: 'pointer' }}>
                {label}
              </button>
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.5px' }}>Desde</label>
              <input type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} max={fechaHasta} style={{ width: 150 }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.5px' }}>Hasta</label>
              <input type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} min={fechaDesde} max={hoy()} style={{ width: 150 }} />
            </div>
            <div style={{ padding: '7px 14px', background: 'var(--bg)', borderRadius: 8, fontSize: 13, color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
              {diasTotal} día{diasTotal !== 1 ? 's' : ''}
            </div>
          </div>
        )}

        {/* filtros secundarios */}
        <div style={{ display: 'flex', gap: 12, marginTop: 14, flexWrap: 'wrap' }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.5px' }}>Local</label>
            <select value={filtroLocal} onChange={e => setFiltroLocal(e.target.value)} style={{ minWidth: 130 }}>
              {locales.map(l => <option key={l}>{l}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.5px' }}>Curso</label>
            <select value={filtroCurso} onChange={e => setFiltroCurso(e.target.value)} style={{ minWidth: 130 }}>
              {cursos.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button onClick={() => { setModo('rapido'); setPeriodoRapido('semana'); setFiltroLocal('Todos'); setFiltroCurso('Todos'); setFechaDesde(haceN(6)); setFechaHasta(hoy()) }}
              style={{ padding: '7px 14px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--bg-card)', fontSize: 12, color: 'var(--text-tertiary)', cursor: 'pointer' }}>
              Limpiar filtros
            </button>
          </div>
        </div>
      </div>

      {/* métricas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Ventas', value: fmt(totalVentas), color: 'var(--text)', sub: `${compras.length} transacciones` },
          { label: 'Recargas', value: fmt(totalRecargas), color: 'var(--green)', sub: `${recargas.length} recargas` },
          { label: 'Ticket promedio', value: fmt(Math.round(ticketPromedio)), color: 'var(--text)', sub: labelRango },
          { label: 'Promedio diario', value: fmt(Math.round(totalVentas / Math.max(diasTotal, 1))), color: 'var(--text)', sub: `${diasTotal} días` },
        ].map(s => (
          <div key={s.label} style={cardStyle}>
            <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.5px' }}>{s.label}</p>
            <p style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 700, color: s.color }}>{s.value}</p>
            <p style={{ margin: 0, fontSize: 11, color: 'var(--text-tertiary)' }}>{s.sub}</p>
          </div>
        ))}
      </div>

      {/* tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {[['general', 'General'], ['productos', 'Por producto'], ['locales', 'Por local'], ['cursos', 'Por curso'], ['transacciones', 'Transacciones']].map(([val, label]) => (
          <button key={val} onClick={() => setTab(val)}
            style={{ padding: '8px 16px', border: 'none', borderBottom: `2px solid ${tab === val ? 'var(--brand)' : 'transparent'}`, background: 'transparent', fontSize: 13, fontWeight: tab === val ? 600 : 400, color: tab === val ? 'var(--brand)' : 'var(--text-secondary)', cursor: 'pointer', marginBottom: -1 }}>
            {label}
          </button>
        ))}
      </div>

      {/* TAB: GENERAL */}
      {tab === 'general' && (
        <div style={{ display: 'grid', gap: 16 }}>
          {/* gráfico área */}
          <div style={cardStyle}>
            <h2 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 16px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.5px' }}>Ventas vs Recargas — {labelRango}</h2>
            {diasEnRango.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={diasEnRango}>
                  <defs>
                    <linearGradient id="gV" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1E3A5F" stopOpacity={0.15}/><stop offset="95%" stopColor="#1E3A5F" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="gR" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#059669" stopOpacity={0.15}/><stop offset="95%" stopColor="#059669" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)"/>
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false} interval={diasTotal > 30 ? Math.floor(diasTotal / 10) : 0}/>
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`}/>
                  <Tooltip formatter={v => fmt(v)} contentStyle={tooltipStyle}/>
                  <Legend wrapperStyle={{ fontSize: 12 }}/>
                  <Area type="monotone" dataKey="ventas" name="Ventas" stroke="#1E3A5F" strokeWidth={2} fill="url(#gV)"/>
                  <Area type="monotone" dataKey="recargas" name="Recargas" stroke="#059669" strokeWidth={2} fill="url(#gR)"/>
                </AreaChart>
              </ResponsiveContainer>
            ) : <p style={{ color: 'var(--text-tertiary)', fontSize: 13, textAlign: 'center', padding: '2rem 0' }}>Sin datos para este rango</p>}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* por local mini */}
            <div style={cardStyle}>
              <h2 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 14px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.5px' }}>Por local</h2>
              {porLocal.length > 0 ? (
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={porLocal}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)"/>
                    <XAxis dataKey="local" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false}/>
                    <YAxis tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`}/>
                    <Tooltip formatter={v => fmt(v)} contentStyle={tooltipStyle}/>
                    <Bar dataKey="total" fill="#1E3A5F" radius={[6, 6, 0, 0]}/>
                  </BarChart>
                </ResponsiveContainer>
              ) : <p style={{ color: 'var(--text-tertiary)', fontSize: 13, textAlign: 'center', padding: '2rem 0' }}>Sin datos</p>}
            </div>

            {/* top alumnos */}
            <div style={cardStyle}>
              <h2 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 14px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.5px' }}>Top alumnos</h2>
              {topAlumnos.length === 0
                ? <p style={{ color: 'var(--text-tertiary)', fontSize: 13, textAlign: 'center', padding: '1rem 0' }}>Sin datos</p>
                : topAlumnos.map(([nombre, total], i) => (
                  <div key={nombre} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: i < topAlumnos.length - 1 ? '1px solid var(--border-light)' : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 20, height: 20, borderRadius: 6, background: 'var(--bg)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', flexShrink: 0 }}>{i + 1}</span>
                      <span style={{ fontSize: 13, color: 'var(--text)' }}>{nombre}</span>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{fmt(total)}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB: PRODUCTOS */}
      {tab === 'productos' && (
        <div style={{ display: 'grid', gap: 16 }}>
          <div style={cardStyle}>
            <h2 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 16px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.5px' }}>Productos más vendidos</h2>
            {porProducto.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={porProducto} layout="vertical" margin={{ left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" horizontal={false}/>
                  <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false}/>
                  <YAxis type="category" dataKey="nombre" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false} width={100}/>
                  <Tooltip contentStyle={tooltipStyle} formatter={v => [v, 'Unidades']}/>
                  <Bar dataKey="cantidad" fill="#1E3A5F" radius={[0, 6, 6, 0]}>
                    {porProducto.map((_, i) => <Cell key={i} fill={COLORES[i % COLORES.length]}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <p style={{ color: 'var(--text-tertiary)', fontSize: 13, textAlign: 'center', padding: '2rem 0' }}>Sin datos para este rango</p>}
          </div>
          <div style={cardStyle}>
            <h2 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 14px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.5px' }}>Detalle</h2>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['#', 'Producto', 'Unidades', 'Participación'].map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '.5px' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {porProducto.map((p, i) => {
                    const totalUnid = porProducto.reduce((s, x) => s + x.cantidad, 0)
                    return (
                      <tr key={p.nombre} style={{ borderBottom: '1px solid var(--border-light)' }}>
                        <td style={{ padding: '10px 12px', color: 'var(--text-tertiary)', fontWeight: 700 }}>{i + 1}</td>
                        <td style={{ padding: '10px 12px', color: 'var(--text)', fontWeight: 500 }}>{p.nombre}</td>
                        <td style={{ padding: '10px 12px', color: 'var(--text)', fontWeight: 600 }}>{p.cantidad}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ flex: 1, height: 6, background: 'var(--bg)', borderRadius: 3, overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${Math.round(p.cantidad / totalUnid * 100)}%`, background: COLORES[i % COLORES.length], borderRadius: 3 }}/>
                            </div>
                            <span style={{ fontSize: 12, color: 'var(--text-secondary)', minWidth: 34, textAlign: 'right' }}>{Math.round(p.cantidad / totalUnid * 100)}%</span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB: LOCALES */}
      {tab === 'locales' && (
        <div style={{ display: 'grid', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={cardStyle}>
              <h2 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 16px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.5px' }}>Ventas por local</h2>
              {porLocal.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={porLocal}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)"/>
                    <XAxis dataKey="local" tick={{ fontSize: 12, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false}/>
                    <YAxis tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`}/>
                    <Tooltip formatter={v => fmt(v)} contentStyle={tooltipStyle}/>
                    <Bar dataKey="total" radius={[8, 8, 0, 0]}>
                      {porLocal.map((_, i) => <Cell key={i} fill={COLORES[i % COLORES.length]}/>)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : <p style={{ color: 'var(--text-tertiary)', fontSize: 13, textAlign: 'center', padding: '2rem 0' }}>Sin datos</p>}
            </div>

            <div style={cardStyle}>
              <h2 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 16px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.5px' }}>Distribución</h2>
              {porLocal.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie data={porLocal} dataKey="total" nameKey="local" cx="50%" cy="50%" outerRadius={70} label={({ local, percent }) => `${local} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                        {porLocal.map((_, i) => <Cell key={i} fill={COLORES[i % COLORES.length]}/>)}
                      </Pie>
                      <Tooltip formatter={v => fmt(v)} contentStyle={tooltipStyle}/>
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ marginTop: 12 }}>
                    {porLocal.map((l, i) => (
                      <div key={l.local} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: i < porLocal.length - 1 ? '1px solid var(--border-light)' : 'none', fontSize: 13 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 10, height: 10, borderRadius: 3, background: COLORES[i % COLORES.length], flexShrink: 0 }}/>
                          <span style={{ color: 'var(--text)' }}>{l.local}</span>
                        </div>
                        <span style={{ fontWeight: 600, color: 'var(--text)' }}>{fmt(l.total)}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : <p style={{ color: 'var(--text-tertiary)', fontSize: 13, textAlign: 'center', padding: '2rem 0' }}>Sin datos</p>}
            </div>
          </div>

          {/* evolución por local */}
          <div style={cardStyle}>
            <h2 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 16px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.5px' }}>Evolución por local</h2>
            {diasEnRango.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={diasEnRango.map(d => {
                  const obj = { label: d.label }
                  locales.filter(l => l !== 'Todos').forEach(l => {
                    obj[l] = compras.filter(t => t.fecha?.slice(0, 10) === d.fecha && t.lugar === l).reduce((s, t) => s + parseFloat(t.monto), 0)
                  })
                  return obj
                })}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)"/>
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false} interval={diasTotal > 14 ? Math.floor(diasTotal / 8) : 0}/>
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`}/>
                  <Tooltip formatter={v => fmt(v)} contentStyle={tooltipStyle}/>
                  <Legend wrapperStyle={{ fontSize: 12 }}/>
                  {locales.filter(l => l !== 'Todos').map((l, i) => (
                    <Bar key={l} dataKey={l} stackId="a" fill={COLORES[i % COLORES.length]} radius={i === locales.length - 2 ? [4, 4, 0, 0] : [0, 0, 0, 0]}/>
                  ))}
                </BarChart>
              </ResponsiveContainer>
            ) : <p style={{ color: 'var(--text-tertiary)', fontSize: 13, textAlign: 'center', padding: '2rem 0' }}>Sin datos</p>}
          </div>
        </div>
      )}

      {/* TAB: CURSOS */}
      {tab === 'cursos' && (
        <div style={{ display: 'grid', gap: 16 }}>
          <div style={cardStyle}>
            <h2 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 16px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.5px' }}>Consumo por curso</h2>
            {porCurso.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={porCurso} layout="vertical" margin={{ left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" horizontal={false}/>
                  <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`}/>
                  <YAxis type="category" dataKey="curso" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false} width={80}/>
                  <Tooltip formatter={v => fmt(v)} contentStyle={tooltipStyle}/>
                  <Bar dataKey="total" radius={[0, 6, 6, 0]}>
                    {porCurso.map((_, i) => <Cell key={i} fill={COLORES[i % COLORES.length]}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <p style={{ color: 'var(--text-tertiary)', fontSize: 13, textAlign: 'center', padding: '2rem 0' }}>Sin datos</p>}
          </div>

          <div style={cardStyle}>
            <h2 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 14px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.5px' }}>Detalle por curso</h2>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Curso', 'Total consumido', 'Transacciones', 'Ticket promedio'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '.5px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {porCurso.map((c, i) => {
                  const txsCurso = compras.filter(t => {
                    const alumno = alumnos.find(a => a.nombre === t.alumno_nombre)
                    return alumno?.curso === c.curso
                  })
                  return (
                    <tr key={c.curso} style={{ borderBottom: '1px solid var(--border-light)' }}>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 10, height: 10, borderRadius: 3, background: COLORES[i % COLORES.length], flexShrink: 0 }}/>
                          <span style={{ color: 'var(--text)', fontWeight: 500 }}>{c.curso}</span>
                        </div>
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--text)' }}>{fmt(c.total)}</td>
                      <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>{txsCurso.length}</td>
                      <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>{txsCurso.length > 0 ? fmt(Math.round(c.total / txsCurso.length)) : '-'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* recarga masiva */}
          <div style={cardStyle}>
            <h2 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 6px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.5px' }}>Recarga masiva</h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 14px' }}>Cargá saldo a todos los alumnos de un curso de una sola vez.</p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.5px' }}>Curso</label>
                <select value={cursoRecarga} onChange={e => setCursoRecarga(e.target.value)} style={{ minWidth: 160 }}>
                  {cursos.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.5px' }}>Monto por alumno</label>
                <input type="number" placeholder="Ej: 500" value={montoRecarga} onChange={e => setMontoRecarga(e.target.value)} style={{ width: 140 }}/>
              </div>
              <div>
                <p style={{ margin: '0 0 5px', fontSize: 12, color: 'var(--text-tertiary)' }}>
                  {cursoRecarga === 'Todos' ? alumnos.length : alumnos.filter(a => a.curso === cursoRecarga).length} alumnos · Total: {fmt((parseInt(montoRecarga) || 0) * (cursoRecarga === 'Todos' ? alumnos.length : alumnos.filter(a => a.curso === cursoRecarga).length))}
                </p>
                <button onClick={recargaMasiva} style={{ padding: '9px 20px', border: 'none', borderRadius: 'var(--radius)', background: 'var(--brand)', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Aplicar recarga</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB: TRANSACCIONES */}
      {tab === 'transacciones' && (
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
            <h2 style={{ fontSize: 13, fontWeight: 700, margin: 0, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.5px' }}>
              {txsTabla.length} transacciones
            </h2>
            <button onClick={exportCSV} style={{ padding: '6px 14px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--bg-card)', fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Exportar CSV
            </button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Alumno', 'Descripción', 'Local', 'Monto', 'Fecha'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '.5px', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {txsTabla.slice(0, 100).map((t, i) => (
                  <tr key={t.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 500, color: 'var(--text)', whiteSpace: 'nowrap' }}>{t.alumno_nombre}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-secondary)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.descripcion}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{t.lugar}</td>
                    <td style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap' }}>{fmt(t.monto)}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-tertiary)', whiteSpace: 'nowrap', fontSize: 12 }}>{new Date(t.fecha).toLocaleString('es-AR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {txsTabla.length > 100 && (
              <p style={{ padding: '12px 16px', color: 'var(--text-tertiary)', fontSize: 12, textAlign: 'center', borderTop: '1px solid var(--border-light)' }}>
                Mostrando 100 de {txsTabla.length}. Exportá el CSV para ver todos.
              </p>
            )}
            {txsTabla.length === 0 && (
              <p style={{ padding: '2rem', color: 'var(--text-tertiary)', fontSize: 13, textAlign: 'center' }}>Sin transacciones para este filtro</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}