import { useState, useEffect, useMemo, useRef } from 'react'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'
import { useLocales } from '../hooks/useLocales'
import useLectorTarjeta from '../hooks/useLectorTarjeta'
import useUmbralStock from '../hooks/useUmbralStock'
import { leerArchivo } from '../utils/importarProductos'
import Icono from '../components/Icono'

// Proveedores (compartidos entre zonas), su catálogo con precio de compra,
// armar pedidos (y mandarlos por WhatsApp) y recibirlos: se tilda lo que llegó
// completo o se escanea / escribe la cantidad, y al confirmar se suma al stock.

const fmt = n => `$${Math.round(Number(n) || 0).toLocaleString('es-AR')}`
const fecha = f => new Date(f).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
const CATEGORIAS = [['comida', 'Comida'], ['bebida', 'Bebida'], ['golosina', 'Golosina'], ['útil', 'Útil'], ['otro', 'Otro']]
const ESTADOS = {
  pedido: { texto: 'Pedido', color: 'var(--brand)', fondo: 'var(--brand-light)' },
  recibido: { texto: 'Recibido', color: 'var(--green)', fondo: 'var(--green-bg)' },
  incompleto: { texto: 'Recibido incompleto', color: 'var(--amber)', fondo: 'var(--amber-bg)' },
  cancelado: { texto: 'Cancelado', color: 'var(--text-secondary)', fondo: 'var(--bg-subtle)' },
}
const sinAcentos = t => String(t ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
const mismoProducto = (p, item) => (item.codigo_barras && p.codigo_barras === item.codigo_barras) || sinAcentos(p.nombre) === sinAcentos(item.nombre)

const tarjeta = { background: 'var(--bg-card)', borderRadius: 16, border: '1px solid var(--border)', boxShadow: 'var(--shadow)' }
const btn = primario => ({ padding: '9px 16px', borderRadius: 'var(--radius)', fontSize: 13, fontWeight: 600, border: primario ? 'none' : '1.5px solid var(--border)', background: primario ? 'var(--brand)' : 'var(--bg-card)', color: primario ? 'var(--on-brand)' : 'var(--text-secondary)', cursor: 'pointer', whiteSpace: 'nowrap' })
const etiqueta = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.5px' }
const th = { padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.5px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }
const td = { padding: '10px 12px', borderBottom: '1px solid var(--border-light)', fontSize: 14, color: 'var(--text)', verticalAlign: 'middle' }
const badge = e => <span style={{ fontSize: 11, fontWeight: 500, padding: '3px 8px', borderRadius: 6, background: ESTADOS[e].fondo, color: ESTADOS[e].color, whiteSpace: 'nowrap' }}>{ESTADOS[e].texto}</span>

// WhatsApp: número argentino a formato internacional (549 + característica + número)
const linkWhatsapp = (telefono, mensaje) => {
  let n = String(telefono || '').replace(/\D/g, '')
  if (!n) return null
  if (n.startsWith('0')) n = n.slice(1)
  if (!n.startsWith('54')) n = '549' + n
  return `https://wa.me/${n}?text=${encodeURIComponent(mensaje)}`
}
const textoPedido = (pedido, colegio) => [
  `Hola! Pedido de ${colegio || 'el colegio'} (${pedido.local}):`,
  ...pedido.items.map(i => `• ${i.bultos} ${i.unidades_bulto > 1 ? `bulto${i.bultos > 1 ? 's' : ''} x${i.unidades_bulto}` : `u.`} — ${i.nombre}${i.codigo_barras ? ` (${i.codigo_barras})` : ''}`),
  '', 'Gracias!',
].join('\n')

function Modal({ titulo, onClose, children, ancho = 520 }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'var(--overlay)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div role="dialog" aria-modal="true" aria-label={titulo} onClick={e => e.stopPropagation()} style={{ ...tarjeta, width: '100%', maxWidth: ancho, maxHeight: '90vh', overflowY: 'auto', padding: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>{titulo}</h2>
          <button onClick={onClose} aria-label="Cerrar" style={{ background: 'none', border: 'none', fontSize: 22, color: 'var(--text-secondary)', cursor: 'pointer' }}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Campo({ label, children, ayuda }) {
  return (
    <label style={{ display: 'block', marginBottom: 12 }}>
      <span style={etiqueta}>{label}</span>
      {children}
      {ayuda && <span style={{ display: 'block', marginTop: 4, fontSize: 12, color: 'var(--text-secondary)' }}>{ayuda}</span>}
    </label>
  )
}

export default function Proveedores() {
  const { sesion } = useAuth()
  const { locales } = useLocales()
  const umbral = useUmbralStock()
  const zonaFija = sesion?.local || null
  const [local, setLocal] = useState('')
  const [tab, setTab] = useState('pedidos')
  const [proveedores, setProveedores] = useState([])
  const [pedidos, setPedidos] = useState([])
  const [productos, setProductos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [proveedorAbierto, setProveedorAbierto] = useState(null) // { ...proveedor, catalogo }
  const [armando, setArmando] = useState(null) // { proveedor, catalogo, cantidades: { itemId: bultos } }
  const [recibiendo, setRecibiendo] = useState(null) // { pedido, filas: { itemId: { cantidad, precio, venta, tildado } } }
  const [modal, setModal] = useState(null) // { tipo: 'proveedor' | 'item' | 'importar', datos }
  const [msg, setMsg] = useState(null)
  const timerMsg = useRef(null)
  const showMsg = (tipo, texto) => { setMsg({ tipo, texto }); clearTimeout(timerMsg.current); timerMsg.current = setTimeout(() => setMsg(null), 4000) }

  useEffect(() => { if (!local) setLocal(zonaFija || (locales.length > 0 ? locales[0] : '')) }, [locales, zonaFija, local])

  const cargar = async () => {
    try {
      const [p, pe, pr] = await Promise.all([api.get('/proveedores'), api.get('/proveedores/pedidos'), api.get('/productos')])
      setProveedores(p.data); setPedidos(pe.data); setProductos(pr.data)
    } catch (err) { showMsg('error', err.response?.data?.error || 'No se pudieron cargar los proveedores') }
    finally { setCargando(false) }
  }
  useEffect(() => { cargar() }, [])

  const productosZona = useMemo(() => productos.filter(p => p.local === local), [productos, local])
  const pedidosZona = pedidos.filter(p => !local || p.local === local)

  const abrirProveedor = async prov => {
    try { const r = await api.get(`/proveedores/${prov.id}/productos`); setProveedorAbierto({ ...prov, catalogo: r.data }) }
    catch (err) { showMsg('error', err.response?.data?.error || 'No se pudo abrir el proveedor') }
  }

  // ─── Lector de códigos: arma el pedido o cuenta lo que llegó ─────────────
  const alEscanear = leido => {
    const codigo = String(leido).replace(/\s+/g, '')
    if (recibiendo) {
      const it = recibiendo.pedido.items.find(i => i.codigo_barras === codigo)
      if (!it) { showMsg('error', `El código ${codigo} no está en este pedido`); return }
      setRecibiendo(r => {
        const f = r.filas[it.id]
        return { ...r, filas: { ...r.filas, [it.id]: { ...f, cantidad: String((parseInt(f.cantidad) || 0) + 1), tildado: false } } }
      })
      return
    }
    if (armando) {
      const it = armando.catalogo.find(i => i.codigo_barras === codigo)
      if (!it) { showMsg('error', `${codigo}: no está en el catálogo de ${armando.proveedor.nombre}`); return }
      setArmando(a => ({ ...a, cantidades: { ...a.cantidades, [it.id]: (a.cantidades[it.id] || 0) + 1 } }))
      return
    }
    if (modal?.tipo === 'item') setModal(m => ({ ...m, datos: { ...m.datos, codigo_barras: codigo } }))
  }
  useLectorTarjeta(alEscanear, true, { repetidaMs: 0 })

  if (cargando) return <p style={{ color: 'var(--text-secondary)' }}>Cargando…</p>

  // ─── Recibir un pedido ───────────────────────────────────────────────────
  if (recibiendo) return <Recibir recibiendo={recibiendo} setRecibiendo={setRecibiendo} productosZona={productos.filter(p => p.local === recibiendo.pedido.local)}
    msg={msg} showMsg={showMsg} alTerminar={async texto => { setRecibiendo(null); await cargar(); showMsg('ok', texto) }} />

  // ─── Armar un pedido ─────────────────────────────────────────────────────
  if (armando) return <ArmarPedido armando={armando} setArmando={setArmando} productosZona={productosZona} umbral={umbral} local={local}
    msg={msg} showMsg={showMsg} alGuardar={async pedido => { setArmando(null); setTab('pedidos'); await cargar(); showMsg('ok', `Pedido a ${pedido.proveedor_nombre} guardado`) }} />

  const empezarRecepcion = pedido => setRecibiendo({
    pedido,
    filas: Object.fromEntries(pedido.items.map(i => [i.id, { cantidad: '', precio: String(Number(i.precio_compra)), venta: '', tildado: false }])),
  })

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, margin: '0 0 4px', color: 'var(--text)' }}>Proveedores</h1>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>Armá pedidos con el precio de compra de cada producto y, cuando llegan, tildá lo que vino: se suma solo al stock.</p>
        </div>
        {!zonaFija && locales.length > 1 && (
          <select aria-label="Zona" value={local} onChange={e => setLocal(e.target.value)} style={{ width: 'auto' }}>
            {locales.map(l => <option key={l}>{l}</option>)}
          </select>
        )}
      </div>

      {msg && <div role="status" style={{ padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 14, background: msg.tipo === 'ok' ? 'var(--green-bg)' : 'var(--red-bg)', color: msg.tipo === 'ok' ? 'var(--green)' : 'var(--red)', borderLeft: `3px solid ${msg.tipo === 'ok' ? 'var(--green)' : 'var(--red)'}` }}>{msg.texto}</div>}

      <div role="tablist" style={{ display: 'flex', gap: 6, marginBottom: 16, borderBottom: '1px solid var(--border)' }}>
        {[['pedidos', `Pedidos${pedidosZona.filter(p => p.estado === 'pedido').length ? ` (${pedidosZona.filter(p => p.estado === 'pedido').length} por llegar)` : ''}`], ['proveedores', `Proveedores (${proveedores.length})`]].map(([id, t]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => { setTab(id); setProveedorAbierto(null) }}
            style={{ padding: '10px 14px', border: 'none', borderBottom: `2px solid ${tab === id ? 'var(--brand)' : 'transparent'}`, background: 'none', color: tab === id ? 'var(--brand)' : 'var(--text-secondary)', fontSize: 14, fontWeight: tab === id ? 600 : 500, cursor: 'pointer' }}>{t}</button>
        ))}
      </div>

      {tab === 'pedidos' && (
        pedidosZona.length === 0 ? (
          <div style={{ ...tarjeta, padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14 }}>
            Todavía no hay pedidos{local ? ` para ${local}` : ''}. Entrá a <b>Proveedores</b>, elegí uno y tocá <b>Armar pedido</b>.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {pedidosZona.map(p => {
              const unidades = p.items.reduce((s, i) => s + i.bultos * i.unidades_bulto, 0)
              const wa = p.estado === 'pedido' && linkWhatsapp(p.proveedor_telefono, textoPedido(p, sesion?.colegio_nombre))
              return (
                <div key={p.id} style={{ ...tarjeta, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{p.proveedor_nombre} {badge(p.estado)}</p>
                    <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
                      #{p.id} · {p.local} · {fecha(p.creado_en)} · {p.items.length} producto{p.items.length > 1 ? 's' : ''} ({unidades} u.) · {fmt(p.estado === 'pedido' || p.estado === 'cancelado' ? p.total_pedido : p.total_recibido)}
                      {p.recibido_en && ` · recibido ${fecha(p.recibido_en)}${p.recibido_por_nombre ? ` por ${p.recibido_por_nombre}` : ''}`}
                    </p>
                  </div>
                  {p.estado === 'pedido' && <>
                    {wa && <a href={wa} target="_blank" rel="noreferrer" style={{ ...btn(false), textDecoration: 'none' }}>Mandar por WhatsApp</a>}
                    <button onClick={async () => { if (!confirm('¿Cancelar este pedido?')) return; try { await api.post(`/proveedores/pedidos/${p.id}/cancelar`); await cargar(); showMsg('ok', 'Pedido cancelado') } catch (err) { showMsg('error', err.response?.data?.error || 'No se pudo cancelar') } }} style={btn(false)}>Cancelar</button>
                    <button onClick={() => empezarRecepcion(p)} style={btn(true)}>Recibir pedido</button>
                  </>}
                </div>
              )
            })}
          </div>
        )
      )}

      {tab === 'proveedores' && !proveedorAbierto && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <button onClick={() => setModal({ tipo: 'proveedor', datos: { nombre: '', telefono: '', contacto: '', notas: '' } })} style={btn(true)}>+ Nuevo proveedor</button>
          </div>
          {proveedores.length === 0 ? (
            <div style={{ ...tarjeta, padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14 }}>Cargá tu primer proveedor: después le agregás los productos que te vende con su precio de compra.</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
              {proveedores.map(p => (
                <button key={p.id} className="prod-card" onClick={() => abrirProveedor(p)} style={{ ...tarjeta, padding: 16, textAlign: 'left', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>{p.nombre}</span>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{p.telefono || 'Sin teléfono'}{p.contacto ? ` · ${p.contacto}` : ''}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>{p.productos} producto{p.productos === 1 ? '' : 's'}{p.pedidos_abiertos ? ` · ${p.pedidos_abiertos} pedido${p.pedidos_abiertos > 1 ? 's' : ''} por llegar` : ''}</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'proveedores' && proveedorAbierto && (
        <CatalogoProveedor proveedor={proveedorAbierto} productosZona={productosZona}
          volver={() => setProveedorAbierto(null)}
          editarProveedor={() => setModal({ tipo: 'proveedor', datos: { ...proveedorAbierto } })}
          eliminarProveedor={async () => {
            if (!confirm(`¿Eliminar a ${proveedorAbierto.nombre}? Los pedidos anteriores quedan guardados.`)) return
            try { await api.delete(`/proveedores/${proveedorAbierto.id}`); setProveedorAbierto(null); await cargar(); showMsg('ok', 'Proveedor eliminado') }
            catch (err) { showMsg('error', err.response?.data?.error || 'No se pudo eliminar') }
          }}
          nuevoItem={() => setModal({ tipo: 'item', datos: { nombre: '', precio_compra: '', codigo_barras: '', categoria: 'golosina', unidades_bulto: '1' } })}
          editarItem={i => setModal({ tipo: 'item', datos: { ...i, precio_compra: String(Number(i.precio_compra)), unidades_bulto: String(i.unidades_bulto) } })}
          sacarItem={async i => {
            try { await api.delete(`/proveedores/${proveedorAbierto.id}/productos/${i.id}`); await abrirProveedor(proveedorAbierto); showMsg('ok', `${i.nombre} salió del catálogo`) }
            catch (err) { showMsg('error', err.response?.data?.error || 'No se pudo sacar') }
          }}
          importar={() => setModal({ tipo: 'importar', datos: {} })}
          armarPedido={() => setArmando({ proveedor: proveedorAbierto, catalogo: proveedorAbierto.catalogo, cantidades: {} })} />
      )}

      {modal?.tipo === 'proveedor' && (
        <ModalProveedor datos={modal.datos} setDatos={d => setModal(m => ({ ...m, datos: d }))} onClose={() => setModal(null)}
          alGuardar={async guardado => { setModal(null); await cargar(); if (proveedorAbierto) setProveedorAbierto(p => ({ ...p, ...guardado })); showMsg('ok', `Proveedor ${guardado.nombre} guardado`) }} />
      )}
      {modal?.tipo === 'item' && proveedorAbierto && (
        <ModalItem proveedor={proveedorAbierto} datos={modal.datos} setDatos={d => setModal(m => ({ ...m, datos: d }))} onClose={() => setModal(null)}
          alGuardar={async () => { setModal(null); await abrirProveedor(proveedorAbierto); await cargar(); showMsg('ok', 'Producto guardado') }} />
      )}
      {modal?.tipo === 'importar' && proveedorAbierto && (
        <ModalImportar proveedor={proveedorAbierto} onClose={() => setModal(null)}
          alTerminar={async r => { setModal(null); await abrirProveedor(proveedorAbierto); await cargar(); showMsg('ok', `${r.creados} productos nuevos y ${r.actualizados} actualizados${r.errores.length ? ` · ${r.errores.length} con error` : ''}`) }} />
      )}
    </div>
  )
}

// ─── Catálogo de un proveedor ───────────────────────────────────────────────
function CatalogoProveedor({ proveedor, productosZona, volver, editarProveedor, eliminarProveedor, nuevoItem, editarItem, sacarItem, importar, armarPedido }) {
  const [busq, setBusq] = useState('')
  const lista = proveedor.catalogo.filter(i => !busq || sinAcentos(i.nombre).includes(sinAcentos(busq)) || (i.codigo_barras || '').includes(busq.trim()))
  const eliminar = i => { if (confirm(`¿Sacar ${i.nombre} del catálogo de ${proveedor.nombre}?`)) sacarItem(i) }
  return (
    <div>
      <button onClick={volver} style={{ background: 'none', border: 'none', color: 'var(--brand)', fontSize: 14, fontWeight: 600, padding: 0, marginBottom: 10, cursor: 'pointer' }}>‹ Proveedores</button>
      <div style={{ ...tarjeta, padding: 16, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{proveedor.nombre}</p>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>{proveedor.telefono || 'Sin teléfono'}{proveedor.contacto ? ` · ${proveedor.contacto}` : ''}{proveedor.notas ? ` · ${proveedor.notas}` : ''}</p>
        </div>
        <button onClick={editarProveedor} style={btn(false)}>Editar</button>
        <button onClick={eliminarProveedor} style={{ ...btn(false), color: 'var(--red)' }}>Eliminar</button>
        <button onClick={armarPedido} disabled={proveedor.catalogo.length === 0} style={{ ...btn(true), opacity: proveedor.catalogo.length ? 1 : 0.5 }}>Armar pedido</button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <input placeholder="Buscar producto o código…" value={busq} onChange={e => setBusq(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
        <button onClick={importar} style={btn(false)}><Icono nombre="subir" />Importar lista de precios</button>
        <button onClick={nuevoItem} style={btn(true)}>+ Producto</button>
      </div>

      {proveedor.catalogo.length === 0 ? (
        <div style={{ ...tarjeta, padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14 }}>Agregá los productos que te vende {proveedor.nombre}, uno por uno (podés escanear el código) o importando su lista de precios en Excel.</div>
      ) : (
        <div style={{ ...tarjeta, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['Producto', 'Código de barras', 'Categoría', 'Bulto', 'Precio de compra', 'Se vende a', ''].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
            <tbody>
              {lista.map(i => {
                const venta = productosZona.find(p => mismoProducto(p, i))
                const ganancia = venta ? Number(venta.precio) - Number(i.precio_compra) : null
                return (
                  <tr key={i.id}>
                    <td style={{ ...td, fontWeight: 500 }}>{i.nombre}</td>
                    <td style={{ ...td, fontFamily: 'monospace', fontSize: 13, color: i.codigo_barras ? 'var(--text)' : 'var(--text-tertiary)' }}>{i.codigo_barras || '—'}</td>
                    <td style={{ ...td, color: 'var(--text-secondary)' }}>{i.categoria}</td>
                    <td style={{ ...td, color: 'var(--text-secondary)' }}>{i.unidades_bulto > 1 ? `x${i.unidades_bulto}` : 'Unidad'}</td>
                    <td style={{ ...td, fontWeight: 600 }}>{fmt(i.precio_compra)}</td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>
                      {venta ? <>{fmt(venta.precio)} <span style={{ fontSize: 12, color: ganancia > 0 ? 'var(--green)' : 'var(--red)' }}>({ganancia >= 0 ? '+' : '−'}{fmt(Math.abs(ganancia))})</span></> : <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>No se vende acá</span>}
                    </td>
                    <td style={{ ...td, whiteSpace: 'nowrap', textAlign: 'right' }}>
                      <button onClick={() => editarItem(i)} style={{ ...btn(false), padding: '5px 10px', fontSize: 12 }}>Editar</button>{' '}
                      <button onClick={() => eliminar(i)} style={{ ...btn(false), padding: '5px 10px', fontSize: 12, color: 'var(--red)' }}>Sacar</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Armar un pedido ────────────────────────────────────────────────────────
function ArmarPedido({ armando, setArmando, productosZona, umbral, local, msg, showMsg, alGuardar }) {
  const [guardando, setGuardando] = useState(false)
  const [busq, setBusq] = useState('')
  const { proveedor, catalogo, cantidades } = armando
  const cambiar = (id, n) => setArmando(a => ({ ...a, cantidades: { ...a.cantidades, [id]: Math.max(0, n) } }))
  const stockDe = i => productosZona.find(p => mismoProducto(p, i))?.stock
  const elegidos = catalogo.filter(i => cantidades[i.id] > 0)
  const total = elegidos.reduce((s, i) => s + cantidades[i.id] * i.unidades_bulto * Number(i.precio_compra), 0)
  const lista = catalogo.filter(i => !busq || sinAcentos(i.nombre).includes(sinAcentos(busq)) || (i.codigo_barras || '').includes(busq.trim()))

  // Sugerir: un bulto de lo que tiene stock bajo (o no se vende todavía) en la zona
  const sugerir = () => {
    const sugeridos = catalogo.filter(i => { const s = stockDe(i); return s !== undefined && s <= umbral })
    if (!sugeridos.length) { showMsg('ok', 'No hay productos de este proveedor con stock bajo'); return }
    setArmando(a => ({ ...a, cantidades: { ...a.cantidades, ...Object.fromEntries(sugeridos.map(i => [i.id, Math.max(a.cantidades[i.id] || 0, 1)])) } }))
    showMsg('ok', `Sumé ${sugeridos.length} producto${sugeridos.length > 1 ? 's' : ''} con stock bajo`)
  }

  const guardar = async () => {
    setGuardando(true)
    try {
      const r = await api.post('/proveedores/pedidos', { proveedor_id: proveedor.id, local, items: elegidos.map(i => ({ proveedor_producto_id: i.id, bultos: cantidades[i.id] })) })
      alGuardar(r.data)
    } catch (err) { showMsg('error', err.response?.data?.error || 'No se pudo guardar el pedido') }
    finally { setGuardando(false) }
  }

  return (
    <div style={{ paddingBottom: 80 }}>
      <button onClick={() => setArmando(null)} style={{ background: 'none', border: 'none', color: 'var(--brand)', fontSize: 14, fontWeight: 600, padding: 0, marginBottom: 10, cursor: 'pointer' }}>‹ Volver</button>
      <h1 style={{ fontSize: 20, fontWeight: 600, margin: '0 0 4px', color: 'var(--text)' }}>Pedido a {proveedor.nombre}</h1>
      <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--text-secondary)' }}>Para {local}. Elegí cuántos bultos de cada producto (o escanealos con el lector).</p>
      {msg && <div role="status" style={{ padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 12, background: msg.tipo === 'ok' ? 'var(--green-bg)' : 'var(--red-bg)', color: msg.tipo === 'ok' ? 'var(--green)' : 'var(--red)' }}>{msg.texto}</div>}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <input placeholder="Buscar producto o código…" value={busq} onChange={e => setBusq(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
        <button onClick={sugerir} style={btn(false)}>Sumar lo que falta</button>
      </div>
      <div style={{ ...tarjeta, overflow: 'hidden' }}>
        {lista.map(i => {
          const n = cantidades[i.id] || 0
          const stock = stockDe(i)
          return (
            <div key={i.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: '1px solid var(--border-light)', background: n ? 'var(--brand-light)' : 'transparent', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 180 }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>{i.nombre}</p>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>
                  {fmt(i.precio_compra)} c/u{i.unidades_bulto > 1 ? ` · bulto x${i.unidades_bulto}` : ''} · {stock === undefined ? 'no se vende acá' : <span style={{ color: stock <= umbral ? 'var(--amber)' : 'inherit' }}>stock {stock}</span>}
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button aria-label={`Menos ${i.nombre}`} onClick={() => cambiar(i.id, n - 1)} style={{ width: 32, height: 32, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-card)', color: 'var(--text-secondary)', fontSize: 16 }}>−</button>
                <input aria-label={`Bultos de ${i.nombre}`} type="number" min="0" value={n || ''} placeholder="0" onChange={e => cambiar(i.id, parseInt(e.target.value) || 0)} style={{ width: 60, textAlign: 'center', padding: '6px' }} />
                <button aria-label={`Más ${i.nombre}`} onClick={() => cambiar(i.id, n + 1)} style={{ width: 32, height: 32, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-card)', color: 'var(--text-secondary)', fontSize: 16 }}>+</button>
              </div>
              <span style={{ width: 90, textAlign: 'right', fontSize: 13, fontWeight: 600, color: n ? 'var(--text)' : 'var(--text-tertiary)' }}>{n ? fmt(n * i.unidades_bulto * Number(i.precio_compra)) : '—'}</span>
            </div>
          )
        })}
      </div>
      <div style={{ position: 'sticky', bottom: 0, marginTop: 14, ...tarjeta, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ flex: 1, fontSize: 14, color: 'var(--text-secondary)' }}>{elegidos.length} producto{elegidos.length === 1 ? '' : 's'} · <b style={{ color: 'var(--text)', fontSize: 18 }}>{fmt(total)}</b></span>
        <button onClick={guardar} disabled={!elegidos.length || guardando} style={{ ...btn(true), opacity: elegidos.length ? 1 : 0.5 }}>{guardando ? 'Guardando…' : 'Guardar pedido'}</button>
      </div>
    </div>
  )
}

// ─── Recibir un pedido ──────────────────────────────────────────────────────
function Recibir({ recibiendo, setRecibiendo, productosZona, msg, showMsg, alTerminar }) {
  const [guardando, setGuardando] = useState(false)
  const { pedido, filas } = recibiendo
  const cambiar = (id, cambio) => setRecibiendo(r => ({ ...r, filas: { ...r.filas, [id]: { ...r.filas[id], ...cambio } } }))
  const pedidas = i => i.bultos * i.unidades_bulto
  const tildar = (i, si) => cambiar(i.id, si ? { tildado: true, cantidad: String(pedidas(i)) } : { tildado: false, cantidad: '' })
  const tildarTodo = () => setRecibiendo(r => ({ ...r, filas: Object.fromEntries(pedido.items.map(i => [i.id, { ...r.filas[i.id], tildado: true, cantidad: String(pedidas(i)) }])) }))
  const esNuevo = i => !productosZona.some(p => mismoProducto(p, i))
  const recibidas = i => parseInt(filas[i.id].cantidad) || 0
  const total = pedido.items.reduce((s, i) => s + recibidas(i) * (Number(filas[i.id].precio) || 0), 0)
  const faltanPrecios = pedido.items.filter(i => recibidas(i) > 0 && esNuevo(i) && !(Number(filas[i.id].venta) > 0))

  const confirmar = async () => {
    if (faltanPrecios.length) { showMsg('error', `Poné el precio de venta de: ${faltanPrecios.map(i => i.nombre).join(', ')}`); return }
    const incompletos = pedido.items.filter(i => recibidas(i) < pedidas(i))
    if (incompletos.length && !confirm(`Faltan ${incompletos.length} producto${incompletos.length > 1 ? 's' : ''} por completar. ¿Confirmar igual? El pedido queda como "recibido incompleto".`)) return
    setGuardando(true)
    try {
      const r = await api.post(`/proveedores/pedidos/${pedido.id}/recibir`, {
        items: pedido.items.map(i => ({ id: i.id, cantidad_recibida: recibidas(i), precio_recibido: filas[i.id].precio, precio_venta: filas[i.id].venta || undefined })),
      })
      alTerminar(`✓ Pedido recibido: ${r.data.unidades} unidades sumadas al stock de ${pedido.local}${r.data.nuevos.length ? ` (productos nuevos: ${r.data.nuevos.join(', ')})` : ''}`)
    } catch (err) { showMsg('error', err.response?.data?.error || 'No se pudo recibir el pedido') }
    finally { setGuardando(false) }
  }

  return (
    <div style={{ paddingBottom: 80 }}>
      <button onClick={() => setRecibiendo(null)} style={{ background: 'none', border: 'none', color: 'var(--brand)', fontSize: 14, fontWeight: 600, padding: 0, marginBottom: 10, cursor: 'pointer' }}>‹ Pedidos</button>
      <h1 style={{ fontSize: 20, fontWeight: 600, margin: '0 0 4px', color: 'var(--text)' }}>Recibir pedido de {pedido.proveedor_nombre}</h1>
      <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--text-secondary)' }}>
        Tildá ✓ lo que llegó completo. Si llegó otra cantidad, escaneá cada unidad con el lector o escribila. Si el precio cambió, corregilo.
      </p>
      {msg && <div role="status" style={{ padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 12, background: msg.tipo === 'ok' ? 'var(--green-bg)' : 'var(--red-bg)', color: msg.tipo === 'ok' ? 'var(--green)' : 'var(--red)' }}>{msg.texto}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
        <button onClick={tildarTodo} style={btn(false)}>✓ Llegó todo</button>
      </div>
      <div style={{ ...tarjeta, overflow: 'hidden' }}>
        {pedido.items.map(i => {
          const f = filas[i.id]
          const n = recibidas(i)
          const ok = n === pedidas(i) && n > 0
          const diferente = f.cantidad !== '' && n !== pedidas(i)
          return (
            <div key={i.id} style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-light)', borderLeft: `3px solid ${ok ? 'var(--green)' : diferente ? 'var(--amber)' : 'transparent'}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 200, cursor: 'pointer' }}>
                  <input type="checkbox" checked={f.tildado || ok} onChange={e => tildar(i, e.target.checked)} style={{ width: 22, height: 22, accentColor: 'var(--brand)' }} />
                  <span>
                    <span style={{ display: 'block', fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>{i.nombre}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Pedido: {i.bultos}{i.unidades_bulto > 1 ? ` bulto${i.bultos > 1 ? 's' : ''} x${i.unidades_bulto} = ${pedidas(i)}` : ''} u.{i.codigo_barras ? ` · ${i.codigo_barras}` : ''}</span>
                  </span>
                </label>
                <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Llegaron
                  <input type="number" min="0" inputMode="numeric" value={f.cantidad} placeholder="0" onChange={e => cambiar(i.id, { cantidad: e.target.value, tildado: false })} style={{ width: 70, marginLeft: 6, padding: '6px', textAlign: 'center' }} />
                </label>
                <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>$ c/u
                  <input type="number" min="0" value={f.precio} onChange={e => cambiar(i.id, { precio: e.target.value })} style={{ width: 90, marginLeft: 6, padding: '6px' }} />
                </label>
              </div>
              {diferente && <p style={{ margin: '6px 0 0 32px', fontSize: 12, color: 'var(--amber)' }}>Llegaron {n} de {pedidas(i)}</p>}
              {n > 0 && esNuevo(i) && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '8px 0 0 32px', fontSize: 12, color: 'var(--text-secondary)' }}>
                  Producto nuevo en {pedido.local}: precio de venta $
                  <input type="number" min="0" value={f.venta} onChange={e => cambiar(i.id, { venta: e.target.value })} style={{ width: 100, padding: '6px', borderColor: Number(f.venta) > 0 ? undefined : 'var(--amber)' }} />
                </label>
              )}
            </div>
          )
        })}
      </div>
      <div style={{ position: 'sticky', bottom: 0, marginTop: 14, ...tarjeta, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ flex: 1, fontSize: 14, color: 'var(--text-secondary)' }}>Llegó por <b style={{ color: 'var(--text)', fontSize: 18 }}>{fmt(total)}</b> · pedido {fmt(pedido.total_pedido)}</span>
        <button onClick={confirmar} disabled={guardando} style={btn(true)}>{guardando ? 'Guardando…' : 'Confirmar y sumar al stock'}</button>
      </div>
    </div>
  )
}

// ─── Modales ────────────────────────────────────────────────────────────────
function ModalProveedor({ datos, setDatos, onClose, alGuardar }) {
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)
  const guardar = async () => {
    setGuardando(true); setError(null)
    try {
      const r = datos.id ? await api.put(`/proveedores/${datos.id}`, datos) : await api.post('/proveedores', datos)
      alGuardar(r.data)
    } catch (err) { setError(err.response?.data?.error || 'No se pudo guardar') }
    finally { setGuardando(false) }
  }
  return (
    <Modal titulo={datos.id ? 'Editar proveedor' : 'Nuevo proveedor'} onClose={onClose}>
      {error && <p style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--red)' }}>{error}</p>}
      <Campo label="Nombre"><input autoFocus value={datos.nombre || ''} onChange={e => setDatos({ ...datos, nombre: e.target.value })} placeholder="Ej: Distribuidora Norte" /></Campo>
      <Campo label="Teléfono / WhatsApp" ayuda="Para mandarle los pedidos por WhatsApp"><input inputMode="tel" value={datos.telefono || ''} onChange={e => setDatos({ ...datos, telefono: e.target.value })} placeholder="Ej: 11 5641 0025" /></Campo>
      <Campo label="Contacto (opcional)"><input value={datos.contacto || ''} onChange={e => setDatos({ ...datos, contacto: e.target.value })} placeholder="Ej: Jorge (vendedor)" /></Campo>
      <Campo label="Notas (opcional)"><input value={datos.notas || ''} onChange={e => setDatos({ ...datos, notas: e.target.value })} placeholder="Ej: entrega martes y viernes" /></Campo>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button onClick={onClose} style={btn(false)}>Cancelar</button>
        <button onClick={guardar} disabled={guardando || !String(datos.nombre || '').trim()} style={btn(true)}>{guardando ? 'Guardando…' : 'Guardar'}</button>
      </div>
    </Modal>
  )
}

function ModalItem({ proveedor, datos, setDatos, onClose, alGuardar }) {
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)
  const guardar = async () => {
    setGuardando(true); setError(null)
    try {
      if (datos.id) await api.put(`/proveedores/${proveedor.id}/productos/${datos.id}`, datos)
      else await api.post(`/proveedores/${proveedor.id}/productos`, datos)
      alGuardar()
    } catch (err) { setError(err.response?.data?.error || 'No se pudo guardar') }
    finally { setGuardando(false) }
  }
  return (
    <Modal titulo={datos.id ? 'Editar producto' : `Producto de ${proveedor.nombre}`} onClose={onClose}>
      {error && <p style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--red)' }}>{error}</p>}
      <Campo label="Nombre"><input autoFocus value={datos.nombre} onChange={e => setDatos({ ...datos, nombre: e.target.value })} placeholder="Ej: Alfajor Jorgito chocolate" /></Campo>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Campo label="Precio de compra (c/u)"><input type="number" min="0" value={datos.precio_compra} onChange={e => setDatos({ ...datos, precio_compra: e.target.value })} placeholder="Ej: 500" /></Campo>
        <Campo label="Unidades por bulto" ayuda="1 si se compra suelto"><input type="number" min="1" value={datos.unidades_bulto} onChange={e => setDatos({ ...datos, unidades_bulto: e.target.value })} /></Campo>
      </div>
      <Campo label="Código de barras (opcional)" ayuda="Escanealo con el lector o escribilo"><input value={datos.codigo_barras || ''} onChange={e => setDatos({ ...datos, codigo_barras: e.target.value })} placeholder="Ej: 7790580000011" /></Campo>
      <Campo label="Categoría">
        <select value={datos.categoria || 'otro'} onChange={e => setDatos({ ...datos, categoria: e.target.value })}>{CATEGORIAS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>
      </Campo>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button onClick={onClose} style={btn(false)}>Cancelar</button>
        <button onClick={guardar} disabled={guardando || !String(datos.nombre || '').trim()} style={btn(true)}>{guardando ? 'Guardando…' : 'Guardar'}</button>
      </div>
    </Modal>
  )
}

function ModalImportar({ proveedor, onClose, alTerminar }) {
  const [filas, setFilas] = useState(null)
  const [error, setError] = useState(null)
  const [importando, setImportando] = useState(false)
  const leer = async archivo => {
    setError(null)
    try {
      const productos = await leerArchivo(archivo)
      // en la lista del proveedor, "precio" es el precio de compra
      setFilas(productos.map(p => ({ fila: p.fila, nombre: p.nombre, precio_compra: p.costo !== '' && p.costo != null ? p.costo : p.precio, codigo_barras: p.codigo_barras, categoria: p.categoria || 'otro', unidades_bulto: p.unidades_bulto || 1 })))
    } catch (err) { setError(err.message) }
  }
  const importar = async () => {
    setImportando(true)
    try { const r = await api.post(`/proveedores/${proveedor.id}/productos/importar`, { productos: filas }); alTerminar(r.data) }
    catch (err) { setError(err.response?.data?.error || 'No se pudo importar') }
    finally { setImportando(false) }
  }
  return (
    <Modal titulo={`Importar lista de ${proveedor.nombre}`} onClose={onClose} ancho={620}>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 12px' }}>
        Subí un Excel (.xlsx) o CSV con las columnas <b>nombre</b> y <b>precio</b> (de compra), y si querés <b>codigo_barras</b>, <b>categoria</b> y <b>bulto</b> (unidades por caja). Lo que ya está en el catálogo se actualiza.
      </p>
      <input type="file" accept=".xlsx,.csv,.txt" onChange={e => e.target.files[0] && leer(e.target.files[0])} />
      {error && <p style={{ margin: '10px 0 0', fontSize: 13, color: 'var(--red)' }}>{error}</p>}
      {filas && (
        <>
          <p style={{ margin: '12px 0 6px', fontSize: 13, color: 'var(--text)' }}>{filas.length} producto{filas.length > 1 ? 's' : ''} leídos:</p>
          <div style={{ maxHeight: 240, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12 }}>
            {filas.slice(0, 200).map(f => <div key={f.fila} style={{ padding: '6px 10px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', gap: 8 }}><span>{f.nombre}{f.unidades_bulto > 1 ? ` · x${f.unidades_bulto}` : ''}</span><b>{fmt(f.precio_compra)}</b></div>)}
          </div>
        </>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
        <button onClick={onClose} style={btn(false)}>Cancelar</button>
        <button onClick={importar} disabled={!filas?.length || importando} style={{ ...btn(true), opacity: filas?.length ? 1 : 0.5 }}>{importando ? 'Importando…' : 'Importar'}</button>
      </div>
    </Modal>
  )
}
