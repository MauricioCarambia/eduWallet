import { useEffect, useState } from 'react'
import api from '../api/axios'

// Pestaña Rentabilidad de Reportes: ventas, costo (precio de compra que cargó
// cada zona), ganancia y compras a proveedores, con los filtros de Reportes
const fmt = n => `${Number(n) < 0 ? '−' : ''}$${Math.abs(Math.round(Number(n) || 0)).toLocaleString('es-AR')}`
const pct = m => (m == null ? '—' : `${m < 0 ? '−' : ''}${Math.abs(Math.round(m * 100))}%`)
const NOMBRE_CATEGORIA = { comida: 'Comida', bebida: 'Bebidas', golosina: 'Golosinas', 'útil': 'Útiles', otro: 'Otros' }
const MARGEN_BAJO = 0.15

const tarjeta = { background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden', marginBottom: 16 }
const th = { padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.5px', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)' }
const td = { padding: '9px 12px', fontSize: 13, color: 'var(--text)', borderBottom: '1px solid var(--border-light)', whiteSpace: 'nowrap' }
const colorMargen = m => (m == null ? 'var(--text-tertiary)' : m < 0 ? 'var(--red)' : m < MARGEN_BAJO ? 'var(--amber)' : 'var(--green)')

function Tabla({ titulo, filas, nombre = f => f.nombre, extra }) {
  if (!filas.length) return null
  return (
    <div style={tarjeta}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}><h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{titulo}</h3></div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>{['', 'Vendido', 'Costo', 'Ganancia', 'Margen', 'Unidades'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
          <tbody>
            {filas.map((f, i) => (
              <tr key={i}>
                <td style={{ ...td, fontWeight: 500 }}>{nombre(f)}{extra?.(f)}</td>
                <td style={td}>{fmt(f.ventas)}</td>
                <td style={{ ...td, color: 'var(--text-secondary)' }}>{f.ventas_con_costo ? fmt(f.costo) : '—'}</td>
                <td style={{ ...td, fontWeight: 600, color: colorMargen(f.margen) }}>{f.ventas_con_costo ? fmt(f.ganancia) : '—'}</td>
                <td style={{ ...td, color: colorMargen(f.margen) }}>{pct(f.margen)}</td>
                <td style={{ ...td, color: 'var(--text-secondary)' }}>{f.unidades}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function Rentabilidad({ desde, hasta, local }) {
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let vigente = true
    api.get('/rentabilidad', { params: { desde, hasta, lugar: local } })
      .then(r => { if (vigente) { setDatos(r.data); setError(null) } })
      .catch(err => { if (vigente) setError(err.response?.data?.error || 'No se pudo cargar la rentabilidad') })
    return () => { vigente = false }
  }, [desde, hasta, local])

  if (error) return <p style={{ color: 'var(--red)', fontSize: 14 }}>{error}</p>
  if (!datos) return <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Cargando…</p>

  const t = datos.total
  const sinCosto = datos.por_producto.filter(p => p.ventas_sin_costo > 0)
  const bajos = datos.por_producto.filter(p => p.margen != null && p.margen < MARGEN_BAJO)
  const totalCompras = datos.compras.reduce((s, c) => s + c.total, 0)

  const exportarCSV = () => {
    const filas = [['Producto', 'Zona', 'Vendido', 'Costo', 'Ganancia', 'Margen %', 'Unidades', 'Vendido sin precio de compra'],
      ...datos.por_producto.map(p => [`"${p.nombre}"`, p.lugar, Math.round(p.ventas), Math.round(p.costo), Math.round(p.ganancia), p.margen == null ? '' : Math.round(p.margen * 100), p.unidades, Math.round(p.ventas_sin_costo)])]
    const url = URL.createObjectURL(new Blob(['﻿' + filas.map(f => f.join(',')).join('\n')], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a'); a.href = url; a.download = `rentabilidad-${desde}-a-${hasta}.csv`; a.click(); URL.revokeObjectURL(url)
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 16 }}>
        {[
          ['Vendido', fmt(t.ventas), 'var(--text)', `${t.unidades} unidades`],
          ['Costo de lo vendido', t.ventas_con_costo ? fmt(t.costo) : '—', 'var(--text)', 'precio de compra'],
          ['Ganancia', t.ventas_con_costo ? fmt(t.ganancia) : '—', colorMargen(t.margen), t.margen == null ? 'cargá precios de compra' : `${pct(t.margen)} de lo vendido`],
          ['Compras a proveedores', fmt(totalCompras), 'var(--text)', `${datos.compras.reduce((s, c) => s + c.pedidos, 0)} pedidos recibidos`],
        ].map(([titulo, valor, color, sub]) => (
          <div key={titulo} style={{ background: 'var(--bg-card)', borderRadius: 12, padding: '14px 16px', border: '1px solid var(--border)' }}>
            <p style={{ margin: '0 0 4px', fontSize: 12, color: 'var(--text-secondary)' }}>{titulo}</p>
            <p style={{ margin: 0, fontSize: 24, fontWeight: 700, color }}>{valor}</p>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>{sub}</p>
          </div>
        ))}
      </div>

      {t.ventas_sin_costo > 0 && (
        <div role="status" style={{ padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16, background: 'var(--amber-bg)', color: 'var(--amber)', borderLeft: '3px solid var(--amber)' }}>
          {fmt(t.ventas_sin_costo)} de lo vendido es de productos sin precio de compra cargado, así que no entran en la ganancia. Se carga en el POS, en Productos (o en Proveedores al recibir un pedido).
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
        <button onClick={exportarCSV} style={{ padding: '6px 14px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--bg-card)', fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>Exportar CSV</button>
      </div>

      <Tabla titulo="Por zona" filas={datos.por_zona} />
      <Tabla titulo="Por categoría" filas={datos.por_categoria} nombre={f => NOMBRE_CATEGORIA[f.nombre] || f.nombre} />
      {bajos.length > 0 && <Tabla titulo={`Margen bajo o a pérdida (menos de ${Math.round(MARGEN_BAJO * 100)}%)`} filas={bajos} extra={f => <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}> · {f.lugar}</span>} />}
      <Tabla titulo="Por producto" filas={datos.por_producto.filter(p => p.ventas_con_costo > 0)} extra={f => <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}> · {f.lugar}</span>} />

      {sinCosto.length > 0 && (
        <div style={tarjeta}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Vendidos sin precio de compra</h3>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>Cargá su precio de compra en el POS para ver la ganancia.</p>
          </div>
          <div style={{ padding: '10px 16px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {sinCosto.map((p, i) => <span key={i} style={{ fontSize: 12, padding: '3px 8px', borderRadius: 6, background: 'var(--bg-subtle)', color: 'var(--text-secondary)' }}>{p.nombre} · {p.lugar} · {fmt(p.ventas_sin_costo)}</span>)}
          </div>
        </div>
      )}

      {datos.compras.length > 0 && (
        <div style={tarjeta}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}><h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Compras a proveedores</h3></div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['Proveedor', 'Pedidos recibidos', 'Unidades', 'Total'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
            <tbody>{datos.compras.map(c => (
              <tr key={c.nombre}><td style={{ ...td, fontWeight: 500 }}>{c.nombre}</td><td style={td}>{c.pedidos}</td><td style={td}>{c.unidades}</td><td style={{ ...td, fontWeight: 600 }}>{fmt(c.total)}</td></tr>
            ))}</tbody>
          </table>
        </div>
      )}

      {t.ventas === 0 && <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>No hubo ventas en este período.</p>}
    </div>
  )
}
