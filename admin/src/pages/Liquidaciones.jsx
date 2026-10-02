import { useState, useEffect, useCallback } from 'react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import api from '../api/axios'
import { SkeletonTable } from '../components/Skeleton'

// Liquidaciones por zona: la plata de las recargas entra a la cuenta del colegio
// y, por cada zona que opera un concesionario o un empleado encargado, el colegio
// le paga lo que vendió en su zona menos el canon o la comisión (opcional)
const fmt = n => `${Number(n) < 0 ? '−' : ''}$${Math.abs(Math.round(Number(n) || 0)).toLocaleString('es-AR')}`
const dia = d => (d ? new Date(d + 'T12:00:00Z').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—')
// Cómo se llama lo que se queda el colegio según quién opera la zona
const nombreCanon = tipo => (tipo === 'encargado' ? 'Comisión' : 'Canon')
const MODOS = [['colegio', 'El colegio'], ['encargado', 'Un encargado'], ['concesionario', 'Un concesionario']]

const DIAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']
// "Se liquida sola cada lunes" / "A mano"
const textoFrecuencia = z => ({
  semanal: `Se liquida sola cada ${DIAS[(z.dia_semana || 1) - 1]}`,
  quincenal: 'Se liquida sola los días 1 y 16',
  mensual: 'Se liquida sola el día 1 de cada mes',
}[z.frecuencia] || 'Se liquida a mano')

const hoyAR = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })

const tarjeta = { background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)' }
const th = { padding: '9px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.5px', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)' }
const td = { padding: '10px 12px', fontSize: 13, color: 'var(--text)', borderBottom: '1px solid var(--border-light)', whiteSpace: 'nowrap' }
const etiqueta = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }
const boton = (principal) => ({ padding: '8px 14px', borderRadius: 'var(--radius)', fontSize: 13, fontWeight: principal ? 600 : 500, cursor: 'pointer', border: principal ? 'none' : '1px solid var(--border)', background: principal ? 'var(--brand)' : 'var(--bg-card)', color: principal ? 'var(--on-brand)' : 'var(--text)' })

function Modal({ titulo, onCerrar, children, ancho = 480 }) {
  return (
    <div role="dialog" aria-modal="true" aria-label={titulo} onClick={onCerrar} style={{ position: 'fixed', inset: 0, background: 'var(--overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ ...tarjeta, padding: '1.5rem', width: '100%', maxWidth: ancho, maxHeight: '92vh', overflowY: 'auto', boxShadow: 'var(--shadow-md)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: 'var(--text)' }}>{titulo}</h2>
          <button onClick={onCerrar} aria-label="Cerrar" style={{ background: 'none', border: 'none', fontSize: 22, lineHeight: 1, color: 'var(--text-secondary)', cursor: 'pointer' }}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

// Las cuentas de la liquidación, iguales en la vista previa y en el detalle
function Cuentas({ l }) {
  const fila = (texto, valor, fuerte) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '6px 0', fontSize: fuerte ? 16 : 14, fontWeight: fuerte ? 700 : 400, color: 'var(--text)', borderTop: fuerte ? '1px solid var(--border)' : 'none', marginTop: fuerte ? 6 : 0, paddingTop: fuerte ? 10 : 6 }}>
      <span style={{ color: fuerte ? 'var(--text)' : 'var(--text-secondary)' }}>{texto}</span><span>{valor}</span>
    </div>
  )
  return (
    <div>
      {fila(`Ventas (${l.cantidad_ventas})`, fmt(l.ventas))}
      {Number(l.anulaciones) > 0 && fila(`Anulaciones (${l.cantidad_anulaciones})`, '− ' + fmt(l.anulaciones))}
      {Number(l.canon_pct) > 0 && fila(`${nombreCanon(l.tipo_operador)} del colegio (${Number(l.canon_pct)}%)`, '− ' + fmt(l.canon))}
      {Number(l.ajuste) !== 0 && fila(`Ajuste${l.ajuste_motivo ? `: ${l.ajuste_motivo}` : ''}`, (Number(l.ajuste) < 0 ? '− ' : '+ ') + fmt(Math.abs(l.ajuste)))}
      {fila(l.tipo_operador === 'encargado' ? 'Total a pagar al encargado' : 'Total a pagar al concesionario', fmt(l.total), true)}
    </div>
  )
}

export default function Liquidaciones() {
  const [zonas, setZonas] = useState([])
  const [lista, setLista] = useState([])
  const [cargando, setCargando] = useState(true)
  const [msg, setMsg] = useState(null)
  const [zonaEditada, setZonaEditada] = useState(null)   // { local, operador, ... }
  const [liquidar, setLiquidar] = useState(null)         // { local, hasta, ajuste, ajuste_motivo, vista, guardando }
  const [detalle, setDetalle] = useState(null)           // liquidación con por_dia y por_producto
  const [referencia, setReferencia] = useState('')
  const [empleados, setEmpleados] = useState([])

  const showMsg = (tipo, texto) => { setMsg({ tipo, texto }); setTimeout(() => setMsg(m => (m?.texto === texto ? null : m)), 5000) }

  const cargar = useCallback(async () => {
    try {
      const [z, l] = await Promise.all([api.get('/liquidaciones/zonas'), api.get('/liquidaciones')])
      setZonas(z.data); setLista(l.data)
    } catch (err) { showMsg('error', err.response?.data?.error || 'No se pudieron cargar las liquidaciones') }
    finally { setCargando(false) }
  }, [])
  useEffect(() => { cargar() }, [cargar])

  // Vista previa: se recalcula al cambiar la fecha de corte o el ajuste
  const localLiq = liquidar?.local
  const hastaLiq = liquidar?.hasta
  const ajusteLiq = liquidar?.ajuste
  useEffect(() => {
    if (!localLiq) return
    let vigente = true
    const t = setTimeout(() => {
      api.get('/liquidaciones/vista-previa', { params: { local: localLiq, hasta: hastaLiq, ajuste: Number(ajusteLiq) || 0 } })
        .then(r => { if (vigente) setLiquidar(x => x && { ...x, vista: r.data, error: null }) })
        .catch(err => { if (vigente) setLiquidar(x => x && { ...x, vista: null, error: err.response?.data?.error || 'No se pudo calcular' }) })
    }, 300)
    return () => { vigente = false; clearTimeout(t) }
  }, [localLiq, hastaLiq, ajusteLiq])

  const editarZona = z => {
    setZonaEditada({
      local: z.local, modo: z.operador ? (z.tipo || 'concesionario') : 'colegio',
      operador: z.tipo === 'encargado' ? '' : (z.operador || ''), empleado_id: z.empleado_id ? String(z.empleado_id) : '',
      contacto: z.contacto || '', email: z.email || '', telefono: z.telefono || '', cuenta_pago: z.cuenta_pago || '', canon_pct: z.canon_pct ?? 0,
      frecuencia: z.frecuencia || 'manual', dia_semana: z.dia_semana || 1,
    })
    if (!empleados.length) api.get('/empleados').then(r => setEmpleados(r.data.filter(e => e.activo))).catch(() => {})
  }

  const zonaLista = z => z.modo === 'colegio' || (z.modo === 'encargado' ? !!z.empleado_id : !!z.operador.trim())

  const guardarZona = async () => {
    const z = zonaEditada
    const nombre = z.modo === 'encargado' ? empleados.find(e => String(e.id) === z.empleado_id)?.nombre : z.operador
    try {
      await api.put(`/liquidaciones/zonas/${encodeURIComponent(z.local)}`, z.modo === 'colegio' ? { operador: '' } : { ...z, tipo: z.modo, operador: nombre })
      showMsg('ok', z.modo === 'colegio' ? `${z.local} queda a cargo del colegio` : `${z.local}: ${z.modo === 'encargado' ? 'la maneja' : 'la opera'} ${nombre}`)
      setZonaEditada(null); cargar()
    } catch (err) { showMsg('error', err.response?.data?.error || 'No se pudo guardar') }
  }

  const crear = async () => {
    setLiquidar(x => ({ ...x, guardando: true }))
    try {
      const r = await api.post('/liquidaciones', { local: liquidar.local, hasta: liquidar.hasta, ajuste: Number(liquidar.ajuste) || 0, ajuste_motivo: liquidar.ajuste_motivo })
      showMsg('ok', `Liquidación N° ${r.data.id} creada: ${fmt(r.data.total)} para ${r.data.operador}`)
      setLiquidar(null); cargar(); abrirDetalle(r.data.id)
    } catch (err) {
      setLiquidar(x => x && { ...x, guardando: false, error: err.response?.data?.error || 'No se pudo crear la liquidación' })
    }
  }

  const abrirDetalle = async id => {
    try { const r = await api.get(`/liquidaciones/${id}`); setDetalle(r.data); setReferencia('') }
    catch (err) { showMsg('error', err.response?.data?.error || 'No se pudo abrir la liquidación') }
  }

  const pagar = async () => {
    if (!confirm(`¿Marcar como pagada la liquidación N° ${detalle.id} por ${fmt(detalle.total)}?`)) return
    try { await api.post(`/liquidaciones/${detalle.id}/pagar`, { referencia }); showMsg('ok', `Liquidación N° ${detalle.id} pagada`); cargar(); abrirDetalle(detalle.id) }
    catch (err) { showMsg('error', err.response?.data?.error || 'No se pudo marcar como pagada') }
  }

  const deshacer = async () => {
    if (!confirm(`¿Deshacer la liquidación N° ${detalle.id}? Sus ventas vuelven a quedar sin liquidar.`)) return
    try { await api.delete(`/liquidaciones/${detalle.id}`); showMsg('ok', `Liquidación N° ${detalle.id} deshecha`); setDetalle(null); cargar() }
    catch (err) { showMsg('error', err.response?.data?.error || 'No se pudo deshacer') }
  }

  const enviar = async () => {
    try { const r = await api.post(`/liquidaciones/${detalle.id}/enviar`); showMsg('ok', `Liquidación enviada a ${r.data.email}`) }
    catch (err) { showMsg('error', err.response?.data?.error || 'No se pudo enviar') }
  }

  const descargarPDF = () => {
    const l = detalle
    const doc = new jsPDF()
    doc.setFontSize(16); doc.text(`Liquidación N° ${l.id} — ${l.local}`, 14, 18)
    doc.setFontSize(10)
    doc.text(`${l.operador} · del ${dia(l.desde)} al ${dia(l.hasta)}`, 14, 25)
    doc.text(l.estado === 'pagada' ? `Pagada${l.referencia_pago ? ` · ${l.referencia_pago}` : ''}` : 'Pendiente de pago', 14, 31)
    const cuentas = [[`Ventas (${l.cantidad_ventas})`, fmt(l.ventas)]]
    if (Number(l.anulaciones)) cuentas.push([`Anulaciones (${l.cantidad_anulaciones})`, '− ' + fmt(l.anulaciones)])
    if (Number(l.canon_pct)) cuentas.push([`${nombreCanon(l.tipo_operador)} del colegio (${Number(l.canon_pct)}%)`, '− ' + fmt(l.canon)])
    if (Number(l.ajuste)) cuentas.push([`Ajuste${l.ajuste_motivo ? `: ${l.ajuste_motivo}` : ''}`, (Number(l.ajuste) < 0 ? '− ' : '+ ') + fmt(Math.abs(l.ajuste))])
    cuentas.push(['Total a pagar', fmt(l.total)])
    autoTable(doc, { startY: 36, body: cuentas, theme: 'plain', styles: { fontSize: 11 }, columnStyles: { 1: { halign: 'right' } }, didParseCell: d => { if (d.row.index === cuentas.length - 1) d.cell.styles.fontStyle = 'bold' } })
    autoTable(doc, { startY: doc.lastAutoTable.finalY + 6, head: [['Día', 'Ventas', 'Vendido', 'Anulado']], body: l.por_dia.map(d => [dia(d.dia), d.ventas, fmt(d.vendido), d.anulado ? fmt(d.anulado) : '']), styles: { fontSize: 9 } })
    if (l.por_producto.length) autoTable(doc, { startY: doc.lastAutoTable.finalY + 6, head: [['Producto', 'Unidades', 'Importe']], body: l.por_producto.map(p => [p.nombre, p.unidades, fmt(p.importe)]), styles: { fontSize: 9 } })
    doc.save(`liquidacion-${l.id}-${l.local}.pdf`)
  }

  const pendientesDePago = lista.filter(l => l.estado === 'pendiente')
  const totalAPagar = pendientesDePago.reduce((s, l) => s + Number(l.total), 0)

  return (
    <div>
      <div style={{ marginBottom: 20, maxWidth: 720 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, margin: '0 0 4px', color: 'var(--text)' }}>Liquidaciones</h1>
        <p style={{ color: 'var(--text)', fontSize: 13, margin: 0, lineHeight: 1.5 }}>
          Las recargas entran a la cuenta del colegio. Si una zona la maneja un encargado o la opera un concesionario, acá se calcula cuánto pagarle:
          lo que vendió en su zona, menos las anulaciones y, si corresponde, la comisión del colegio. Lo que se sube tarde o se anula después entra en la liquidación siguiente.
        </p>
      </div>

      {msg && <div role="status" style={{ padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16, background: msg.tipo === 'ok' ? 'var(--green-bg)' : 'var(--red-bg)', color: msg.tipo === 'ok' ? 'var(--green)' : 'var(--red)' }}>{msg.texto}</div>}

      {cargando ? <SkeletonTable /> : (
        <>
          <h2 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 10px', color: 'var(--text)' }}>Zonas</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 12, marginBottom: 24 }}>
            {zonas.map(z => (
              <div key={z.local} style={{ ...tarjeta, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{z.local}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
                    {z.operador
                      ? <>{z.tipo === 'encargado' ? 'Encargado' : 'Concesionario'}: <b style={{ color: 'var(--text)' }}>{z.operador}</b> · {z.canon_pct ? `${nombreCanon(z.tipo).toLowerCase()} ${z.canon_pct}%` : 'se le liquida todo'}</>
                      : 'La maneja el colegio: no se liquida'}
                  </p>
                </div>
                {z.operador && (
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    <p style={{ margin: 0 }}>Sin liquidar: <b style={{ color: 'var(--text)', fontSize: 15 }}>{fmt(z.pendiente?.neto)}</b>{z.pendiente?.desde ? ` desde ${dia(z.pendiente.desde)}` : ''}</p>
                    <p style={{ margin: '2px 0 0' }}>{textoFrecuencia(z)}</p>
                    <p style={{ margin: '2px 0 0' }}>{z.ultima_hasta ? `Última liquidación hasta el ${dia(z.ultima_hasta)}` : 'Todavía sin liquidaciones'}{z.por_pagar ? ` · ${z.por_pagar} sin pagar` : ''}</p>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8, marginTop: 'auto', paddingTop: 4 }}>
                  {z.operador && <button disabled={!z.pendiente?.cantidad_ventas && !z.pendiente?.cantidad_anulaciones} onClick={() => setLiquidar({ local: z.local, hasta: hoyAR(), ajuste: '', ajuste_motivo: '' })} style={{ ...boton(true), opacity: z.pendiente?.cantidad_ventas || z.pendiente?.cantidad_anulaciones ? 1 : 0.5 }}>Liquidar</button>}
                  <button onClick={() => editarZona(z)} style={boton(false)}>{z.operador ? 'Editar' : 'Asignar encargado'}</button>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: 'var(--text)' }}>Historial</h2>
            {pendientesDePago.length > 0 && <span style={{ fontSize: 13, color: 'var(--amber)' }}>{pendientesDePago.length} sin pagar · {fmt(totalAPagar)}</span>}
          </div>
          <div style={{ ...tarjeta, overflow: 'hidden' }}>
            {lista.length === 0 ? (
              <p style={{ padding: '1.5rem', margin: 0, textAlign: 'center', fontSize: 14, color: 'var(--text-secondary)' }}>Todavía no hay liquidaciones. Asigná un encargado o un concesionario a una zona y tocá Liquidar.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr>{['N°', 'Zona', 'A quién', 'Período', 'Vendido neto', 'Comisión', 'Total', 'Estado'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {lista.map(l => (
                      <tr key={l.id} onClick={() => abrirDetalle(l.id)} style={{ cursor: 'pointer' }}>
                        <td style={{ ...td, color: 'var(--text-secondary)' }}>{l.id}</td>
                        <td style={{ ...td, fontWeight: 500 }}>{l.local}</td>
                        <td style={td}>{l.operador}</td>
                        <td style={{ ...td, color: 'var(--text-secondary)' }}>{dia(l.desde)} – {dia(l.hasta)}{l.automatica && <span title="La creó el sistema" style={{ marginLeft: 6, fontSize: 11, padding: '2px 6px', borderRadius: 6, background: 'var(--bg-subtle)', color: 'var(--text-secondary)' }}>auto</span>}</td>
                        <td style={td}>{fmt(Number(l.ventas) - Number(l.anulaciones))}</td>
                        <td style={{ ...td, color: 'var(--text-secondary)' }}>{fmt(l.canon)}</td>
                        <td style={{ ...td, fontWeight: 600 }}>{fmt(l.total)}</td>
                        <td style={td}>
                          <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 6, background: l.estado === 'pagada' ? 'var(--green-bg)' : 'var(--amber-bg)', color: l.estado === 'pagada' ? 'var(--green)' : 'var(--amber)' }}>{l.estado === 'pagada' ? 'Pagada' : 'Sin pagar'}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {zonaEditada && (
        <Modal titulo={`Quién opera ${zonaEditada.local}`} onCerrar={() => setZonaEditada(null)}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
            {MODOS.map(([v, texto]) => (
              <button key={v} aria-pressed={zonaEditada.modo === v} onClick={() => setZonaEditada(z => ({ ...z, modo: v }))} style={{ ...boton(zonaEditada.modo === v), flex: '1 1 120px' }}>{texto}</button>
            ))}
          </div>
          {zonaEditada.modo === 'colegio' ? (
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 16px' }}>Lo que se vende en {zonaEditada.local} queda en el colegio: no se liquida a nadie.</p>
          ) : (
            <div style={{ display: 'grid', gap: 12, marginBottom: 16 }}>
              {zonaEditada.modo === 'encargado' ? (
                <div>
                  <label style={etiqueta} htmlFor="z-emp">Empleado a cargo</label>
                  <select id="z-emp" value={zonaEditada.empleado_id} onChange={e => setZonaEditada(z => ({ ...z, empleado_id: e.target.value }))}>
                    <option value="">Elegí un empleado…</option>
                    {empleados.map(e => <option key={e.id} value={e.id}>{e.nombre}{e.local_nombre ? ` · ${e.local_nombre}` : ''}</option>)}
                  </select>
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>Se le liquida lo que vende la zona para que pueda reponer y comprar mercadería.</p>
                </div>
              ) : (
                <div><label style={etiqueta} htmlFor="z-op">Concesionario</label><input id="z-op" value={zonaEditada.operador} onChange={e => setZonaEditada(z => ({ ...z, operador: e.target.value }))} placeholder="Ej.: Cantina Don Pepe" autoFocus /></div>
              )}
              <div>
                <label style={etiqueta} htmlFor="z-canon">{zonaEditada.modo === 'encargado' ? 'Comisión del colegio (%) — opcional' : 'Canon del colegio (%)'}</label>
                <input id="z-canon" type="number" min="0" max="100" step="0.5" value={zonaEditada.canon_pct} onChange={e => setZonaEditada(z => ({ ...z, canon_pct: e.target.value }))} />
                <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>{zonaEditada.modo === 'encargado' ? 'Con 0 se le liquida el total de las ventas. Si el colegio se queda con una parte, poné el porcentaje.' : 'Lo que se queda el colegio de cada venta (si no cobra nada, 0).'}</p>
              </div>
              {zonaEditada.modo === 'concesionario' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                  <div><label style={etiqueta} htmlFor="z-cont">Contacto</label><input id="z-cont" value={zonaEditada.contacto} onChange={e => setZonaEditada(z => ({ ...z, contacto: e.target.value }))} placeholder="Nombre" /></div>
                  <div><label style={etiqueta} htmlFor="z-tel">Teléfono</label><input id="z-tel" value={zonaEditada.telefono} onChange={e => setZonaEditada(z => ({ ...z, telefono: e.target.value }))} /></div>
                </div>
              )}
              <div>
                <label style={etiqueta} htmlFor="z-frec">Cómo se liquida</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <select id="z-frec" value={zonaEditada.frecuencia} onChange={e => setZonaEditada(z => ({ ...z, frecuencia: e.target.value }))} style={{ flex: '1 1 200px' }}>
                    <option value="manual">A mano, cuando el colegio decida</option>
                    <option value="semanal">Semanal</option>
                    <option value="quincenal">Quincenal (días 1 y 16)</option>
                    <option value="mensual">Mensual (día 1)</option>
                  </select>
                  {zonaEditada.frecuencia === 'semanal' && (
                    <select aria-label="Día de la semana" value={zonaEditada.dia_semana} onChange={e => setZonaEditada(z => ({ ...z, dia_semana: Number(e.target.value) }))} style={{ flex: '1 1 140px' }}>
                      {DIAS.slice(0, 5).map((d, i) => <option key={d} value={i + 1}>los {d}</option>)}
                    </select>
                  )}
                </div>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
                  {zonaEditada.frecuencia === 'manual'
                    ? 'El admin toca Liquidar cuando quiere y elige hasta qué día.'
                    : 'El sistema crea la liquidación sola con lo vendido hasta el día anterior y se la manda por mail (a quien la cobra y al email del colegio). Después solo hay que transferir y marcarla pagada.'}
                </p>
              </div>
              <div><label style={etiqueta} htmlFor="z-mail">Email (para mandarle cada liquidación)</label><input id="z-mail" type="email" value={zonaEditada.email} onChange={e => setZonaEditada(z => ({ ...z, email: e.target.value }))} /></div>
              <div><label style={etiqueta} htmlFor="z-cta">CBU o alias donde se le paga</label><input id="z-cta" value={zonaEditada.cuenta_pago} onChange={e => setZonaEditada(z => ({ ...z, cuenta_pago: e.target.value }))} /></div>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button onClick={() => setZonaEditada(null)} style={boton(false)}>Cancelar</button>
            <button onClick={guardarZona} disabled={!zonaLista(zonaEditada)} style={{ ...boton(true), opacity: zonaLista(zonaEditada) ? 1 : 0.5 }}>Guardar</button>
          </div>
        </Modal>
      )}

      {liquidar && (
        <Modal titulo={`Liquidar ${liquidar.local}`} onCerrar={() => setLiquidar(null)}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={etiqueta} htmlFor="l-hasta">Hasta el día (incluido)</label>
              <input id="l-hasta" type="date" max={hoyAR()} value={liquidar.hasta} onChange={e => setLiquidar(x => ({ ...x, hasta: e.target.value }))} />
            </div>
            <div>
              <label style={etiqueta} htmlFor="l-aj">Ajuste (opcional)</label>
              <input id="l-aj" type="number" step="1" value={liquidar.ajuste} onChange={e => setLiquidar(x => ({ ...x, ajuste: e.target.value }))} placeholder="Ej.: −5000" />
            </div>
          </div>
          {Number(liquidar.ajuste) !== 0 && liquidar.ajuste !== '' && (
            <div style={{ marginBottom: 16 }}>
              <label style={etiqueta} htmlFor="l-mot">Motivo del ajuste</label>
              <input id="l-mot" value={liquidar.ajuste_motivo} onChange={e => setLiquidar(x => ({ ...x, ajuste_motivo: e.target.value }))} placeholder="Ej.: alquiler de la heladera" />
              <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>Negativo resta de lo que se le paga; positivo suma.</p>
            </div>
          )}
          <div style={{ background: 'var(--bg-subtle)', borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
            {liquidar.vista ? (
              <>
                <p style={{ margin: '0 0 6px', fontSize: 12, color: 'var(--text-secondary)' }}>{liquidar.vista.operador} · {liquidar.vista.desde ? `del ${dia(liquidar.vista.desde)} al ${dia(liquidar.vista.hasta)}` : 'sin ventas pendientes hasta esa fecha'}</p>
                <Cuentas l={liquidar.vista} />
              </>
            ) : <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>Calculando…</p>}
          </div>
          {liquidar.error && <p role="alert" style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--red)' }}>{liquidar.error}</p>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button onClick={() => setLiquidar(null)} style={boton(false)}>Cancelar</button>
            <button onClick={crear} disabled={liquidar.guardando || !liquidar.vista?.desde} style={{ ...boton(true), opacity: liquidar.guardando || !liquidar.vista?.desde ? 0.5 : 1 }}>{liquidar.guardando ? 'Creando…' : 'Crear liquidación'}</button>
          </div>
        </Modal>
      )}

      {detalle && (
        <Modal titulo={`Liquidación N° ${detalle.id} — ${detalle.local}`} onCerrar={() => setDetalle(null)} ancho={620}>
          <p style={{ margin: '-8px 0 14px', fontSize: 13, color: 'var(--text-secondary)' }}>
            {detalle.operador} · del {dia(detalle.desde)} al {dia(detalle.hasta)}
            {detalle.automatica ? ' · creada automáticamente' : detalle.creado_por_nombre ? ` · creada por ${detalle.creado_por_nombre}` : ''}
            {detalle.cuenta_pago && <> · se le paga a <b style={{ color: 'var(--text)' }}>{detalle.cuenta_pago}</b></>}
          </p>
          <div style={{ background: 'var(--bg-subtle)', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}><Cuentas l={detalle} /></div>

          {detalle.estado === 'pagada' ? (
            <p style={{ margin: '0 0 14px', padding: '10px 14px', borderRadius: 8, fontSize: 13, background: 'var(--green-bg)', color: 'var(--green)' }}>
              ✓ Pagada el {new Date(detalle.pagada_en).toLocaleDateString('es-AR')}{detalle.pagada_por_nombre ? ` por ${detalle.pagada_por_nombre}` : ''}{detalle.referencia_pago ? ` · ${detalle.referencia_pago}` : ''}
            </p>
          ) : (
            <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
              <input aria-label="Referencia del pago" value={referencia} onChange={e => setReferencia(e.target.value)} placeholder="Referencia del pago (ej.: transferencia 0012)" style={{ flex: '1 1 220px' }} />
              <button onClick={pagar} style={boton(true)}>Marcar pagada</button>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            <button onClick={descargarPDF} style={boton(false)}>Descargar PDF</button>
            {detalle.email && <button onClick={enviar} style={boton(false)}>Enviar a {detalle.email}</button>}
            {detalle.estado === 'pendiente' && <button onClick={deshacer} style={{ ...boton(false), color: 'var(--red)', marginLeft: 'auto' }}>Deshacer</button>}
          </div>

          <h3 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 6px', color: 'var(--text)' }}>Por día</h3>
          <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'auto', marginBottom: 16, maxHeight: 220 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>{['Día', 'Ventas', 'Vendido', 'Anulado'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
              <tbody>{detalle.por_dia.map(d => (
                <tr key={d.dia}><td style={td}>{dia(d.dia)}</td><td style={td}>{d.ventas}</td><td style={td}>{fmt(d.vendido)}</td><td style={{ ...td, color: d.anulado ? 'var(--red)' : 'var(--text-tertiary)' }}>{d.anulado ? fmt(d.anulado) : '—'}</td></tr>
              ))}</tbody>
            </table>
          </div>

          {detalle.por_producto.length > 0 && <>
            <h3 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 6px', color: 'var(--text)' }}>Por producto</h3>
            <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'auto', maxHeight: 260 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>{['Producto', 'Unidades', 'Importe'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
                <tbody>{detalle.por_producto.map(p => (
                  <tr key={p.nombre}><td style={td}>{p.nombre}</td><td style={td}>{p.unidades}</td><td style={td}>{fmt(p.importe)}</td></tr>
                ))}</tbody>
              </table>
            </div>
          </>}
        </Modal>
      )}
    </div>
  )
}
