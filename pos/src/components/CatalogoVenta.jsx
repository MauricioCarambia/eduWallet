import { Fragment, useEffect, useMemo, useState } from 'react'
import Icono from './Icono'
import { nombresAlergenos } from '../utils/alergenos'

// Catálogo de la pantalla Venta, pensado para zonas con cientos de productos:
// - arranca en "Más vendidos" (lo que se vende en el recreo) y tiene botones por categoría
// - el buscador filtra mientras se escribe; Enter agrega el primero y las flechas recorren
// - se puede escribir sin hacer clic en el buscador
// - variedades del mismo grupo (ej. Alfajores) en una sola tarjeta que abre las variedades
// - vista de tarjetas o de lista (cada caja recuerda la suya); sin stock, al final

const fmt = n => `$${Number(n).toLocaleString('es-AR')}`
const ICONO_CATEGORIA = { comida: 'comida', bebida: 'bebida', golosina: 'golosina', 'útil': 'util', otro: 'otro' }
const CATEGORIAS = [['bebida', 'Bebidas'], ['golosina', 'Golosinas'], ['comida', 'Comida'], ['útil', 'Útiles'], ['otro', 'Otros']]
const CLAVE_VISTA = 'pos_vista_productos'

const sinAcentos = t => String(t ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
const porNombre = (a, b) => a.nombre.localeCompare(b.nombre, 'es')
// Con stock primero; dentro de cada parte, el orden que se pida
const sinStockAlFinal = orden => (a, b) => (a.stock > 0 ? 0 : 1) - (b.stock > 0 ? 0 : 1) || orden(a, b)

const leerVista = () => { try { return localStorage.getItem(CLAVE_VISTA) === 'lista' ? 'lista' : 'tarjetas' } catch { return 'tarjetas' } }

// Junta las variedades de un mismo grupo en un ítem; el resto queda suelto
const agrupar = lista => {
  const grupos = new Map()
  const items = []
  for (const p of lista) {
    if (!p.grupo) { items.push({ tipo: 'producto', p, nombre: p.nombre, stock: p.stock }); continue }
    const clave = sinAcentos(p.grupo)
    if (!grupos.has(clave)) {
      const g = { tipo: 'grupo', nombre: p.grupo, variantes: [], stock: 0 }
      grupos.set(clave, g); items.push(g)
    }
    const g = grupos.get(clave)
    g.variantes.push(p); g.stock += Math.max(0, p.stock)
  }
  // un grupo con una sola variedad se muestra como producto suelto
  return items.map(i => i.tipo === 'grupo' && i.variantes.length === 1 ? { tipo: 'producto', p: i.variantes[0], nombre: i.variantes[0].nombre, stock: i.variantes[0].stock } : i)
}

export default function CatalogoVenta({ encabezado, productos, carrito, estado, umbral, busq, setBusq, busqRef, onAgregar, onQuitar, productoPorCodigo, masVendidos }) {
  const [categoria, setCategoria] = useState('auto') // auto: Más vendidos si ya hay ventas, si no Todos
  const [vista, setVista] = useState(leerVista)
  const [grupoAbierto, setGrupoAbierto] = useState(null) // nombre del grupo
  const [abiertosLista, setAbiertosLista] = useState([]) // grupos desplegados en la vista de lista
  // resultado marcado del buscador; vuelve al primero cuando cambia lo escrito
  const [marca, setMarca] = useState({ texto: '', i: 0 })

  const cambiarVista = v => { setVista(v); try { localStorage.setItem(CLAVE_VISTA, v) } catch { /* sin almacenamiento */ } }
  const enCarrito = id => carrito.find(i => i.id === id)?.qty || 0

  const top = useMemo(() => {
    const porId = new Map(productos.map(p => [p.id, p]))
    return masVendidos.map(id => porId.get(id)).filter(Boolean)
  }, [productos, masVendidos])
  const MIN_MAS_VENDIDOS = 4
  const cat = categoria === 'auto' ? (top.length >= MIN_MAS_VENDIDOS ? 'top' : 'todos')
    : categoria === 'top' && top.length === 0 ? 'todos' : categoria

  const texto = sinAcentos(busq.trim())
  const buscando = texto.length > 0

  // Resultados de búsqueda: sueltos (sin agrupar), primero los que empiezan con lo escrito
  const resultados = useMemo(() => {
    if (!buscando) return []
    return productos
      .filter(p => sinAcentos(p.nombre).includes(texto) || sinAcentos(p.grupo).includes(texto) || (p.codigo_barras || '').includes(busq.trim()))
      .sort(sinStockAlFinal((a, b) => (sinAcentos(a.nombre).startsWith(texto) ? 0 : 1) - (sinAcentos(b.nombre).startsWith(texto) ? 0 : 1) || porNombre(a, b)))
  }, [productos, texto, buscando, busq])

  const items = useMemo(() => {
    if (buscando) return resultados.map(p => ({ tipo: 'producto', p, nombre: p.nombre, stock: p.stock }))
    if (cat === 'top') return [...top].sort(sinStockAlFinal(() => 0)).map(p => ({ tipo: 'producto', p, nombre: p.nombre, stock: p.stock }))
    const base = cat === 'todos' ? productos : productos.filter(p => p.categoria === cat)
    return agrupar([...base].sort(porNombre)).sort(sinStockAlFinal(porNombre))
  }, [buscando, resultados, cat, top, productos])

  const conteo = useMemo(() => {
    const c = {}
    for (const p of productos) c[p.categoria] = (c[p.categoria] || 0) + 1
    return c
  }, [productos])

  const resaltado = marca.texto === texto ? marca.i : 0
  const setResaltado = cambio => setMarca({ texto, i: cambio(resaltado) })

  // Escribir sin hacer clic: una letra con el cursor fuera de un campo va al buscador
  useEffect(() => {
    const alTeclear = e => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1 || grupoAbierto) return
      const el = document.activeElement
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return
      busqRef.current?.focus()
    }
    document.addEventListener('keydown', alTeclear)
    return () => document.removeEventListener('keydown', alTeclear)
  }, [busqRef, grupoAbierto])

  const alTeclearBuscador = e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setResaltado(i => Math.min(i + 1, Math.max(resultados.length - 1, 0))) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setResaltado(i => Math.max(i - 1, 0)) }
    else if (e.key === 'Escape') setBusq('')
    else if (e.key === 'Enter') {
      const p = productoPorCodigo(busq) || resultados[resaltado]
      if (p) { onAgregar(p); setBusq('') }
    }
  }

  // ─── piezas ────────────────────────────────────────────────────────────────
  const badgeStock = stock => stock === 0 ? { texto: 'Sin stock', color: 'var(--red)', fondo: 'var(--red-bg)' }
    : stock <= umbral ? { texto: `Quedan ${stock}`, color: 'var(--amber)', fondo: 'var(--amber-bg)' }
    : { texto: `${stock} u.`, color: 'var(--text-secondary)', fondo: 'var(--bg-subtle)' }
  const pill = s => <span style={{ fontSize: 11, fontWeight: 500, padding: '3px 8px', borderRadius: 6, background: s.fondo, color: s.color, whiteSpace: 'nowrap' }}>{s.texto}</span>
  const cantidad = n => n > 0 && <span style={{ minWidth: 26, height: 26, padding: '0 8px', borderRadius: 999, background: 'var(--brand)', color: 'var(--on-brand)', fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box' }}>×{n}</span>
  const iconoCat = (c, { chico, sobreTinte } = {}) => (
    <span style={{ width: chico ? 28 : 34, height: chico ? 28 : 34, borderRadius: chico ? 8 : 10, flexShrink: 0, background: sobreTinte ? 'var(--bg-card)' : 'var(--brand-light)', color: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Icono nombre={ICONO_CATEGORIA[c] || 'otro'} tamaño={chico ? 15 : 18} style={{ marginRight: 0 }} />
    </span>
  )
  const avisos = e => <>
    {e.alergias.length > 0 && <span style={{ alignSelf: 'flex-start', fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 6, background: 'var(--red-bg)', color: 'var(--red)' }}><Icono nombre="alerta" tamaño={12} />{nombresAlergenos(e.alergias)}</span>}
    {e.bloqueo && <span style={{ alignSelf: 'flex-start', fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 6, background: 'var(--red-bg)', color: 'var(--red)' }}><Icono nombre="prohibido" tamaño={12} />No permitido</span>}
  </>
  const rangoPrecio = vs => {
    const ps = vs.map(v => Number(v.precio)); const min = Math.min(...ps), max = Math.max(...ps)
    return min === max ? fmt(min) : <><span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)' }}>desde </span>{fmt(min)}</>
  }

  // Clic derecho: resta uno del carrito (si estaba cargado). En un grupo
  // (ej.: alfajores), la última variedad que se cargó. Sin menú del navegador.
  const quitarUno = (ev, ids) => {
    ev.preventDefault()
    const ultimo = [...carrito].reverse().find(i => ids.includes(i.id))
    if (ultimo && onQuitar) onQuitar(ultimo.id)
  }
  const ayuda = (e, n) => [e.bloqueo || (e.alergias.length ? `Alergia: ${nombresAlergenos(e.alergias)}` : null), n ? 'Clic derecho: quitar uno' : null].filter(Boolean).join(' · ') || undefined

  const tarjetaProducto = (p, { marcado } = {}) => {
    const e = estado(p); const n = enCarrito(p.id)
    return (
      <button key={p.id} className="prod-card" onClick={() => onAgregar(p)} onContextMenu={ev => quitarUno(ev, [p.id])} disabled={p.stock === 0} title={ayuda(e, n)}
        style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 150, padding: 12, border: `1.5px solid ${e.alergias.length ? 'var(--red)' : n ? 'var(--brand)' : 'var(--border)'}`, borderRadius: 16, background: n ? 'var(--brand-light)' : 'var(--bg-card)', boxShadow: 'var(--shadow)', textAlign: 'left', opacity: e.apagado ? 0.55 : 1, cursor: p.stock === 0 ? 'not-allowed' : 'pointer', outline: marcado ? 'var(--focus-ring)' : 'none', outlineOffset: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          {iconoCat(p.categoria, { sobreTinte: n > 0 })}
          {cantidad(n)}
        </div>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--text)', lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.nombre}</p>
        {avisos(e)}
        <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, width: '100%' }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{fmt(p.precio)}</span>
          {pill(badgeStock(p.stock))}
        </div>
      </button>
    )
  }

  const tarjetaGrupo = g => {
    const n = g.variantes.reduce((s, v) => s + enCarrito(v.id), 0)
    return (
      <button key={'g-' + g.nombre} className="prod-card" onClick={() => setGrupoAbierto(g.nombre)} onContextMenu={ev => quitarUno(ev, g.variantes.map(v => v.id))} disabled={g.stock === 0} title={n ? 'Clic derecho: quitar uno' : undefined}
        style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 8, minHeight: 150, padding: 12, border: `1.5px solid ${n ? 'var(--brand)' : 'var(--border)'}`, borderRadius: 16, background: n ? 'var(--brand-light)' : 'var(--bg-card)', boxShadow: '4px 4px 0 -1px var(--bg-card), 4px 4px 0 0 var(--border), var(--shadow)', textAlign: 'left', opacity: g.stock === 0 ? 0.55 : 1, cursor: g.stock === 0 ? 'not-allowed' : 'pointer' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          {iconoCat(g.variantes[0].categoria, { sobreTinte: n > 0 })}
          {cantidad(n)}
        </div>
        <div>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--text)', lineHeight: 1.3 }}>{g.nombre}</p>
          <p style={{ margin: '2px 0 0', fontSize: 12, fontWeight: 500, color: 'var(--brand)' }}>{g.variantes.length} variedades ›</p>
        </div>
        <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, width: '100%' }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap' }}>{rangoPrecio(g.variantes)}</span>
          {pill(badgeStock(g.stock))}
        </div>
      </button>
    )
  }

  const filaProducto = (p, { marcado, sangria } = {}) => {
    const e = estado(p); const n = enCarrito(p.id)
    return (
      <button key={p.id} className="prod-fila" onClick={() => onAgregar(p)} onContextMenu={ev => quitarUno(ev, [p.id])} disabled={p.stock === 0} title={ayuda(e, n)}
        style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: `8px 12px 8px ${sangria ? 36 : 12}px`, border: 'none', borderBottom: '1px solid var(--border-light)', borderLeft: `3px solid ${e.alergias.length ? 'var(--red)' : n ? 'var(--brand)' : 'transparent'}`, background: n ? 'var(--brand-light)' : 'var(--bg-card)', textAlign: 'left', opacity: e.apagado ? 0.55 : 1, cursor: p.stock === 0 ? 'not-allowed' : 'pointer', outline: marcado ? 'var(--focus-ring)' : 'none', outlineOffset: -3 }}>
        {iconoCat(p.categoria, { chico: true, sobreTinte: n > 0 })}
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 14, fontWeight: 500, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.nombre}</span>
          {(e.alergias.length > 0 || e.bloqueo) && <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--red)' }}>{e.bloqueo ? <><Icono nombre="prohibido" tamaño={12} />No permitido</> : <><Icono nombre="alerta" tamaño={12} />{nombresAlergenos(e.alergias)}</>}</span>}
        </span>
        {cantidad(n)}
        {pill(badgeStock(p.stock))}
        <span style={{ width: 80, textAlign: 'right', fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{fmt(p.precio)}</span>
      </button>
    )
  }

  const filaGrupo = g => {
    const abierto = abiertosLista.includes(g.nombre)
    const n = g.variantes.reduce((s, v) => s + enCarrito(v.id), 0)
    return <Fragment key={'g-' + g.nombre}>
      <button className="prod-fila" onClick={() => setAbiertosLista(a => abierto ? a.filter(x => x !== g.nombre) : [...a, g.nombre])} onContextMenu={ev => quitarUno(ev, g.variantes.map(v => v.id))} aria-expanded={abierto}
        style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 12px', border: 'none', borderBottom: '1px solid var(--border-light)', borderLeft: `3px solid ${n ? 'var(--brand)' : 'transparent'}`, background: 'var(--bg-subtle)', textAlign: 'left' }}>
        {iconoCat(g.variantes[0].categoria, { chico: true })}
        <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
          {g.nombre} <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--brand)' }}>· {g.variantes.length} variedades</span>
        </span>
        {cantidad(n)}
        {pill(badgeStock(g.stock))}
        <span style={{ width: 80, textAlign: 'right', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>{abierto ? '▲' : '▼'}</span>
      </button>
      {abierto && [...g.variantes].sort(sinStockAlFinal(porNombre)).map(v => filaProducto(v, { sangria: true }))}
    </Fragment>
  }

  const chip = (id, etiqueta, cantidad, icono) => {
    const activo = !buscando && cat === id
    return (
      <button key={id} onClick={() => { setCategoria(id); setBusq('') }} aria-pressed={activo}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 20, border: `1.5px solid ${activo ? 'var(--brand)' : 'var(--border)'}`, background: activo ? 'var(--brand)' : 'var(--bg-card)', color: activo ? 'var(--on-brand)' : 'var(--text-secondary)', fontSize: 13, fontWeight: activo ? 600 : 500, whiteSpace: 'nowrap', flexShrink: 0 }}>
        {icono && <Icono nombre={icono} tamaño={14} style={{ marginRight: 2 }} />}{etiqueta}
        {cantidad !== undefined && <span style={{ fontSize: 11, opacity: 0.8 }}>{cantidad}</span>}
      </button>
    )
  }

  const grupo = grupoAbierto && agrupar([...productos].sort(porNombre)).find(i => i.tipo === 'grupo' && i.nombre === grupoAbierto)

  return <>
    <div style={{ padding: '12px 16px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border)' }}>
      {encabezado}
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', display: 'flex' }}><Icono nombre="buscar" style={{ marginRight: 0 }} /></span>
          <input ref={busqRef} placeholder={window.matchMedia?.('(pointer: coarse)').matches ? 'Buscar producto o código…' : 'Buscar producto o código… (escribí directo)'} value={busq} onChange={e => setBusq(e.target.value)} onKeyDown={alTeclearBuscador} style={{ paddingLeft: 36 }} />
        </div>
        <div role="group" aria-label="Vista" style={{ display: 'flex', border: '1.5px solid var(--border)', borderRadius: 10, overflow: 'hidden', flexShrink: 0 }}>
          {[['tarjetas', 'Tarjetas', <svg key="t" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>],
            ['lista', 'Lista', <svg key="l" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg>]]
            .map(([v, etiqueta, svg]) => (
              <button key={v} onClick={() => cambiarVista(v)} title={etiqueta} aria-label={etiqueta} aria-pressed={vista === v}
                style={{ padding: '0 12px', border: 'none', background: vista === v ? 'var(--brand)' : 'var(--bg-card)', color: vista === v ? 'var(--on-brand)' : 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>{svg}</button>
            ))}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 10, overflowX: 'auto', paddingBottom: 2 }}>
        {top.length > 0 && chip('top', 'Más vendidos', undefined, null)}
        {chip('todos', 'Todos', productos.length)}
        {CATEGORIAS.filter(([c]) => conteo[c]).map(([c, etiqueta]) => chip(c, etiqueta, conteo[c], ICONO_CATEGORIA[c]))}
      </div>
    </div>

    <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
      {buscando && <p style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--text-secondary)' }}>{resultados.length === 0 ? `Nada con "${busq.trim()}"` : `${resultados.length} resultado${resultados.length > 1 ? 's' : ''} · Enter agrega el marcado, ↑ ↓ para elegir`}</p>}
      {!buscando && cat === 'top' && <p style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--text-secondary)' }}>Los más vendidos de los últimos 30 días</p>}
      {!buscando && productos.length === 0 && <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>Esta zona no tiene productos. Cargalos en Productos.</p>}
      {vista === 'tarjetas' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
          {items.map((it, i) => it.tipo === 'grupo'
            ? tarjetaGrupo(it)
            : tarjetaProducto(it.p, { marcado: buscando && i === resaltado }))}
        </div>
      ) : (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          {items.map((it, i) => it.tipo === 'grupo'
            ? filaGrupo(it)
            : filaProducto(it.p, { marcado: buscando && i === resaltado }))}
        </div>
      )}
    </div>

    {grupo && (
      <div onClick={() => setGrupoAbierto(null)} style={{ position: 'fixed', inset: 0, background: 'var(--overlay)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div role="dialog" aria-modal="true" aria-label={grupo.nombre} onClick={e => e.stopPropagation()} onKeyDown={e => { if (e.key === 'Escape') setGrupoAbierto(null) }}
          style={{ width: '100%', maxWidth: 760, maxHeight: '85vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-card)', borderRadius: 16, boxShadow: 'var(--shadow-md)', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
            {iconoCat(grupo.variantes[0].categoria)}
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>{grupo.nombre}</p>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>{grupo.variantes.length} variedades · tocá las que lleva</p>
            </div>
            <button autoFocus onClick={() => setGrupoAbierto(null)} style={{ padding: '10px 20px', border: 'none', borderRadius: 10, background: 'var(--brand)', color: 'var(--on-brand)', fontSize: 14, fontWeight: 600 }}>Listo</button>
          </div>
          <div style={{ overflowY: 'auto', padding: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
            {[...grupo.variantes].sort(sinStockAlFinal(porNombre)).map(v => tarjetaProducto(v))}
          </div>
        </div>
      </div>
    )}
  </>
}
