import { useState, useEffect } from 'react'
import api from '../api/axios'
import { SkeletonTable } from '../components/Skeleton'

const LIMIT = 50

const fmt = n => `$${Number(n || 0).toLocaleString('es-AR')}`

const ESTADOS = {
  acreditado: { label: 'Acreditada', filtro: 'Acreditadas', color: 'var(--green)', bg: 'var(--green-bg)' },
  pendiente:  { label: 'Pendiente',  filtro: 'Pendientes',  color: 'var(--amber)', bg: 'var(--amber-bg)' },
  rechazado:  { label: 'Rechazada',  filtro: 'Rechazadas',  color: 'var(--red)',   bg: 'var(--red-bg)' },
  vencido:    { label: 'Vencida',    filtro: 'Vencidas',    color: 'var(--text-tertiary)', bg: 'var(--bg)' },
}

const btnPagina = (deshabilitado) => ({
  padding: '6px 12px', border: '1.5px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--bg-card)', fontSize: 12,
  cursor: deshabilitado ? 'not-allowed' : 'pointer', color: deshabilitado ? 'var(--text-tertiary)' : 'var(--text-secondary)',
})

// Excel guarda las fechas sin zona horaria: se corre la fecha para que la
// celda muestre la hora local (Argentina) y no la UTC
const fechaExcel = iso => { const d = new Date(iso); return new Date(d.getTime() - d.getTimezoneOffset() * 60000) }

const descargar = (buffer, nombre) => {
  const url = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  a.click()
  URL.revokeObjectURL(url)
}

export default function Recargas() {
  const [recargas, setRecargas] = useState([])
  const [resumen, setResumen]   = useState(null)
  const [total, setTotal]       = useState(0)
  const [pages, setPages]       = useState(1)
  const [page, setPage]         = useState(1)
  const [estado, setEstado]     = useState('')
  const [busq, setBusq]         = useState('')
  const [busqAplicada, setBusqAplicada] = useState('')
  const [desde, setDesde]       = useState('')
  const [hasta, setHasta]       = useState('')
  const [cargando, setCargando] = useState(true)
  const [exportando, setExportando] = useState(false)
  const [errorExport, setErrorExport] = useState(null)

  // La búsqueda se aplica medio segundo después de dejar de escribir
  useEffect(() => {
    const t = setTimeout(() => { setBusqAplicada(busq.trim()); setPage(1) }, 500)
    return () => clearTimeout(t)
  }, [busq])

  useEffect(() => {
    let vigente = true
    const cargar = async () => {
      setCargando(true)
      try {
        const params = { page, limit: LIMIT }
        if (estado) params.estado = estado
        if (busqAplicada) params.q = busqAplicada
        if (desde) params.desde = desde
        if (hasta) params.hasta = hasta
        const res = await api.get('/pagos/colegio', { params })
        if (!vigente) return
        setRecargas(res.data.data)
        setResumen(res.data.resumen)
        setTotal(res.data.total)
        setPages(res.data.pages)
      } catch (err) { console.error(err) }
      finally { if (vigente) setCargando(false) }
    }
    cargar()
    return () => { vigente = false }
  }, [page, estado, busqAplicada, desde, hasta])

  const cambiarFiltro = (setter) => (valor) => { setter(valor); setPage(1) }

  // Exporta TODAS las recargas que cumplen los filtros actuales (no sólo la página)
  const exportarExcel = async () => {
    setExportando(true)
    setErrorExport(null)
    try {
      const params = { limit: 200 }
      if (estado) params.estado = estado
      if (busqAplicada) params.q = busqAplicada
      if (desde) params.desde = desde
      if (hasta) params.hasta = hasta

      let filas = [], pagina = 1, paginas = 1, resumenExport = null
      do {
        const res = await api.get('/pagos/colegio', { params: { ...params, page: pagina } })
        filas = filas.concat(res.data.data)
        paginas = res.data.pages
        resumenExport = res.data.resumen
        pagina++
      } while (pagina <= paginas)

      const { default: ExcelJS } = await import('exceljs')
      const libro = new ExcelJS.Workbook()
      libro.creator = 'EduWallet'
      const moneda = '"$"#,##0.00'

      const hoja = libro.addWorksheet('Recargas', { views: [{ state: 'frozen', ySplit: 1 }] })
      hoja.columns = [
        { header: 'Fecha', key: 'fecha', width: 18, style: { numFmt: 'dd/mm/yyyy hh:mm' } },
        { header: 'Alumno', key: 'alumno', width: 24 },
        { header: 'Padre', key: 'padre', width: 24 },
        { header: 'Email', key: 'email', width: 30 },
        { header: 'Saldo cargado', key: 'monto', width: 15, style: { numFmt: moneda } },
        { header: 'Cargo por servicio', key: 'comision', width: 18, style: { numFmt: moneda } },
        { header: 'Total', key: 'total', width: 15, style: { numFmt: moneda } },
        { header: 'Estado', key: 'estado', width: 13 },
        { header: 'Detalle', key: 'detalle', width: 26 },
        { header: 'ID pago Mercado Pago', key: 'mp', width: 22 },
      ]
      filas.forEach(r => hoja.addRow({
        fecha: fechaExcel(r.creado_en),
        alumno: r.alumno_nombre,
        padre: r.padre_nombre,
        email: r.padre_email,
        monto: Number(r.monto),
        comision: Number(r.comision),
        total: Number(r.monto_total),
        estado: ESTADOS[r.estado]?.label || r.estado,
        detalle: r.detalle || '',
        mp: r.mp_payment_id || '',
      }))
      hoja.getRow(1).font = { bold: true }
      hoja.autoFilter = { from: 'A1', to: `J${filas.length + 1}` }

      const res = libro.addWorksheet('Resumen')
      res.columns = [
        { header: 'Estado', key: 'estado', width: 16 },
        { header: 'Cantidad', key: 'cantidad', width: 10 },
        { header: 'Saldo cargado', key: 'monto', width: 16, style: { numFmt: moneda } },
        { header: 'Cargo por servicio', key: 'comision', width: 18, style: { numFmt: moneda } },
        { header: 'Total', key: 'total', width: 16, style: { numFmt: moneda } },
      ]
      Object.entries(ESTADOS)
        .filter(([k]) => !estado || k === estado)
        .forEach(([k, e]) => {
          const r = resumenExport[k]
          res.addRow({ estado: e.filtro, cantidad: r.cantidad, monto: Number(r.monto), comision: Number(r.comision), total: Number(r.monto_total) })
        })
      res.getRow(1).font = { bold: true }
      res.addRow([])
      const filtrosTexto = [
        estado && `Estado: ${ESTADOS[estado].filtro}`,
        busqAplicada && `Búsqueda: "${busqAplicada}"`,
        desde && `Desde: ${desde}`,
        hasta && `Hasta: ${hasta}`,
      ].filter(Boolean).join(' · ') || 'Sin filtros'
      res.addRow([`Filtros: ${filtrosTexto}`])
      res.addRow([`Exportado: ${new Date().toLocaleString('es-AR')}`])

      const rango = desde || hasta ? `_${desde || 'inicio'}_a_${hasta || 'hoy'}` : ''
      descargar(await libro.xlsx.writeBuffer(), `recargas${estado ? '_' + estado : ''}${rango}.xlsx`)
    } catch (err) {
      console.error(err)
      setErrorExport('No se pudo generar el Excel. Probá de nuevo.')
    } finally {
      setExportando(false)
    }
  }
  const totalResumen = resumen ? Object.values(resumen).reduce((s, r) => s + r.cantidad, 0) : 0

  const tarjetas = [
    { label: 'Recaudado (acreditado)', value: fmt(resumen?.acreditado.monto), sub: `${resumen?.acreditado.cantidad || 0} recargas` },
    { label: 'Pagado por los padres', value: fmt(resumen?.acreditado.monto_total), sub: `Incluye ${fmt(resumen?.acreditado.comision)} de cargo por servicio` },
    { label: 'Pendientes', value: resumen?.pendiente.cantidad || 0, sub: fmt(resumen?.pendiente.monto) },
    { label: 'Rechazadas / vencidas', value: (resumen?.rechazado.cantidad || 0) + (resumen?.vencido.cantidad || 0), sub: 'Sin cobrar' },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 4px', color: 'var(--text)' }}>Recargas</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: 0 }}>Recargas de saldo que hicieron los padres con Mercado Pago</p>
        </div>
        <button onClick={exportarExcel} disabled={exportando || total === 0} title="Exporta todas las recargas que cumplen los filtros actuales" style={{ padding: '8px 16px', border: '1.5px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--bg-card)', fontSize: 13, cursor: exportando || total === 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)', fontWeight: 500, opacity: exportando || total === 0 ? 0.6 : 1 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          {exportando ? 'Generando...' : `Exportar a Excel${total ? ` (${total})` : ''}`}
        </button>
      </div>

      {errorExport && (
        <div style={{ padding: '10px 14px', borderRadius: 'var(--radius)', fontSize: 13, marginBottom: 16, background: 'var(--red-bg)', color: 'var(--red)', borderLeft: '3px solid var(--red)' }}>{errorExport}</div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
        {tarjetas.map(s => (
          <div key={s.label} style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: '1rem', border: '1.5px solid var(--border)', boxShadow: 'var(--shadow)' }}>
            <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.5px' }}>{s.label}</p>
            <p style={{ margin: '0 0 2px', fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>{s.value}</p>
            <p style={{ margin: 0, fontSize: 11, color: 'var(--text-tertiary)' }}>{s.sub}</p>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        {[['', 'Todas', totalResumen], ...Object.entries(ESTADOS).map(([k, e]) => [k, e.filtro, resumen?.[k].cantidad || 0])].map(([valor, label, cantidad]) => (
          <button key={valor} onClick={() => cambiarFiltro(setEstado)(valor)} style={{ padding: '6px 14px', border: `1.5px solid ${estado === valor ? 'var(--brand)' : 'var(--border)'}`, borderRadius: 20, background: estado === valor ? 'var(--brand)' : 'var(--bg-card)', color: estado === valor ? 'white' : 'var(--text-secondary)', fontSize: 12, fontWeight: estado === valor ? 600 : 400, cursor: 'pointer' }}>
            {label} <span style={{ opacity: 0.75 }}>({cantidad})</span>
          </button>
        ))}
      </div>

      <input placeholder="Buscar por alumno, padre o email..." value={busq} onChange={e => setBusq(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', marginBottom: 10 }} />

      <div style={{ display: 'flex', gap: 16, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
          Desde
          <input type="date" value={desde} max={hasta || undefined} onChange={e => cambiarFiltro(setDesde)(e.target.value)} />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
          Hasta
          <input type="date" value={hasta} min={desde || undefined} onChange={e => cambiarFiltro(setHasta)(e.target.value)} />
        </label>
        {(desde || hasta || busq || estado) && (
          <button onClick={() => { setDesde(''); setHasta(''); setBusq(''); setEstado(''); setPage(1) }} style={{ ...btnPagina(false), padding: '8px 12px' }}>Limpiar filtros</button>
        )}
      </div>

      <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1.5px solid var(--border)', overflowX: 'auto', boxShadow: 'var(--shadow)' }}>
        {cargando ? (
          <SkeletonTable rows={8} cols={6} />
        ) : recargas.length === 0 ? (
          <p style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>No hay recargas con estos filtros</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 720 }}>
            <thead>
              <tr style={{ borderBottom: '1.5px solid var(--border)' }}>
                {['Fecha', 'Alumno', 'Padre', 'Saldo cargado', 'Cargo', 'Total pagado', 'Estado'].map(h => (
                  <th key={h} style={{ textAlign: ['Saldo cargado', 'Cargo', 'Total pagado'].includes(h) ? 'right' : 'left', padding: '10px 14px', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.4px', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recargas.map((r, i) => {
                const e = ESTADOS[r.estado] || ESTADOS.pendiente
                return (
                  <tr key={r.id} style={{ borderBottom: i < recargas.length - 1 ? '1px solid var(--border-light)' : 'none' }}>
                    <td style={{ padding: '10px 14px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{new Date(r.creado_en).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                    <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text)' }}>{r.alumno_nombre}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ color: 'var(--text)' }}>{r.padre_nombre}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{r.padre_email}</div>
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: 'var(--text)' }}>{fmt(r.monto)}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--text-secondary)' }}>{fmt(r.comision)}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--text-secondary)' }}>{r.estado === 'acreditado' ? fmt(r.monto_total) : '—'}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span title={[r.detalle, r.mp_payment_id && `Pago MP ${r.mp_payment_id}`].filter(Boolean).join(' · ')} style={{ padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 600, color: e.color, background: e.bg, whiteSpace: 'nowrap' }}>{e.label}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {pages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 20 }}>
          <button onClick={() => setPage(p => p - 1)} disabled={page === 1} style={btnPagina(page === 1)}>‹ Anterior</button>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Página {page} de {pages} · {total} recargas</span>
          <button onClick={() => setPage(p => p + 1)} disabled={page === pages} style={btnPagina(page === pages)}>Siguiente ›</button>
        </div>
      )}
    </div>
  )
}
