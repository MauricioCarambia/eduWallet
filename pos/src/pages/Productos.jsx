import { useState, useEffect } from 'react'
import api from '../api/axios'
import { SkeletonTable } from '../components/Skeleton'

const fmt = n => `$${Number(n).toLocaleString('es-AR')}`

function Modal({ title, onClose, children }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
      <div style={{ background: 'var(--bg-card)', borderRadius: 16, padding: '1.5rem', width: '100%', maxWidth: 440, maxHeight: '90vh', overflowY: 'auto', border: '1px solid var(--border)', boxShadow: 'var(--shadow-md)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, color: 'var(--text-tertiary)', lineHeight: 1, cursor: 'pointer' }}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Campo({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.5px' }}>{label}</label>
      {children}
    </div>
  )
}

const FORM_VACIO = { nombre: '', precio: '0', stock: '10', categoria: 'comida' }

export default function Productos() {
  const [productos, setProductos] = useState([])
  const [local, setLocal] = useState('Kiosco')
  const [cargando, setCargando] = useState(true)
  const [modal, setModal] = useState(null)
  const [seleccionado, setSeleccionado] = useState(null)
  const [form, setForm] = useState(FORM_VACIO)
  const [busq, setBusq] = useState('')
  const [msg, setMsg] = useState(null)

  const showMsg = (tipo, texto) => { setMsg({ tipo, texto }); setTimeout(() => setMsg(null), 3000) }

  useEffect(() => { cargar() }, [])

  const cargar = async () => {
    try { const res = await api.get('/productos'); setProductos(res.data) }
    catch (err) { console.error(err) } finally { setCargando(false) }
  }

  const cerrarModal = () => { setModal(null); setSeleccionado(null); setForm(FORM_VACIO) }

  const guardarNuevo = async () => {
    if (!form.nombre) return
    try {
      const res = await api.post('/productos', { ...form, local })
      setProductos(prev => [...prev, res.data])
      showMsg('ok', `Producto ${form.nombre} agregado`); cerrarModal()
    } catch (err) { showMsg('error', 'Error al agregar producto') }
  }

  const eliminar = async id => {
    if (!confirm('¿Eliminar este producto?')) return
    try { await api.delete(`/productos/${id}`); setProductos(prev => prev.filter(p => p.id !== id)); showMsg('ok', 'Producto eliminado') }
    catch (err) { showMsg('error', 'Error al eliminar') }
  }

  const editarStock = async (id, delta) => {
    try { const res = await api.patch(`/productos/${id}/stock`, { delta }); setProductos(prev => prev.map(p => p.id === id ? res.data : p)) }
    catch (err) { showMsg('error', 'Error al actualizar stock') }
  }

  const ajustarStock = async () => {
    const nuevoStock = parseInt(form.stock)
    if (isNaN(nuevoStock) || nuevoStock < 0) return
    const delta = nuevoStock - seleccionado.stock
    try {
      const res = await api.patch(`/productos/${seleccionado.id}/stock`, { delta })
      setProductos(prev => prev.map(p => p.id === seleccionado.id ? res.data : p))
      showMsg('ok', `Stock actualizado a ${nuevoStock}`); cerrarModal()
    } catch (err) { showMsg('error', 'Error al ajustar stock') }
  }

  const prodsFiltrados = productos.filter(p => p.local === local && p.nombre.toLowerCase().includes(busq.toLowerCase()))
  const stockBajo = productos.filter(p => p.stock <= 3)

  if (cargando) return <SkeletonTable rows={6} cols={4} />

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: '0 0 4px', color: 'var(--text)' }}>Productos</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: 0 }}>{productos.length} productos en total</p>
        </div>
        <button onClick={() => setModal('nuevo')} style={{ padding: '8px 16px', border: 'none', borderRadius: 8, background: 'var(--brand)', color: 'white', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>+ Nuevo producto</button>
      </div>

      {msg && <div style={{ padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16, background: msg.tipo === 'ok' ? 'var(--green-bg)' : 'var(--red-bg)', color: msg.tipo === 'ok' ? 'var(--green)' : 'var(--red)', borderLeft: `3px solid ${msg.tipo === 'ok' ? 'var(--green)' : 'var(--red)'}` }}>{msg.texto}</div>}

      {stockBajo.length > 0 && (
        <div style={{ padding: '10px 14px', borderRadius: 10, background: 'var(--amber-bg)', border: '1px solid var(--amber)', marginBottom: 16, fontSize: 13, color: 'var(--amber)', borderLeft: '3px solid var(--amber)' }}>
          ⚠ {stockBajo.length} producto{stockBajo.length > 1 ? 's' : ''} con stock bajo: {stockBajo.map(p => p.nombre).join(', ')}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {['Kiosco', 'Librería'].map(l => (
          <button key={l} onClick={() => setLocal(l)} style={{ padding: '7px 18px', border: `1.5px solid ${local === l ? 'var(--brand)' : 'var(--border)'}`, borderRadius: 8, background: local === l ? 'var(--brand)' : 'var(--bg-card)', color: local === l ? 'white' : 'var(--text-secondary)', fontSize: 13, fontWeight: local === l ? 500 : 400, cursor: 'pointer' }}>{l}</button>
        ))}
      </div>

      <input placeholder="Buscar producto..." value={busq} onChange={e => setBusq(e.target.value)} style={{ marginBottom: 14 }} />

      <div style={{ background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Producto', 'Precio', 'Stock', 'Categoría', 'Acciones'].map(h => (
                <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '.5px' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {prodsFiltrados.map(p => (
              <tr key={p.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                <td style={{ padding: '12px 16px', fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>{p.nombre}</td>
                <td style={{ padding: '12px 16px', fontSize: 14, color: 'var(--text)' }}>{fmt(p.precio)}</td>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button onClick={() => editarStock(p.id, -1)} style={{ width: 26, height: 26, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-card)', fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>−</button>
                    <span style={{ fontSize: 14, fontWeight: 600, minWidth: 28, textAlign: 'center', color: p.stock <= 3 ? 'var(--red)' : 'var(--text)' }}>{p.stock}</span>
                    <button onClick={() => editarStock(p.id, 1)} style={{ width: 26, height: 26, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-card)', fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>+</button>
                    <button onClick={() => { setSeleccionado(p); setForm({ stock: String(p.stock) }); setModal('stock') }} style={{ padding: '3px 8px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-card)', fontSize: 11, cursor: 'pointer', color: 'var(--text-secondary)' }}>Ajustar</button>
                    {p.stock <= 3 && <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 5, background: 'var(--red-bg)', color: 'var(--red)' }}>Bajo</span>}
                  </div>
                </td>
                <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-secondary)' }}>{p.categoria}</td>
                <td style={{ padding: '12px 16px' }}>
                  <button onClick={() => eliminar(p.id)} style={{ padding: '4px 10px', border: 'none', borderRadius: 6, background: 'var(--red-bg)', color: 'var(--red)', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {prodsFiltrados.length === 0 && <p style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>Sin productos</p>}
      </div>

      {modal === 'nuevo' && (
        <Modal title={`Nuevo producto — ${local}`} onClose={cerrarModal}>
          <Campo label="Nombre"><input value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} /></Campo>
          <Campo label="Precio"><input type="number" value={form.precio} onChange={e => setForm(p => ({ ...p, precio: e.target.value }))} /></Campo>
          <Campo label="Stock inicial"><input type="number" value={form.stock} onChange={e => setForm(p => ({ ...p, stock: e.target.value }))} /></Campo>
          <Campo label="Categoría">
            <select value={form.categoria} onChange={e => setForm(p => ({ ...p, categoria: e.target.value }))}>
              <option value="comida">Comida</option>
              <option value="bebida">Bebida</option>
              <option value="golosina">Golosina</option>
              <option value="útil">Útil escolar</option>
              <option value="otro">Otro</option>
            </select>
          </Campo>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <button onClick={cerrarModal} style={{ padding: '8px 16px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-card)', fontSize: 13, cursor: 'pointer', color: 'var(--text-secondary)' }}>Cancelar</button>
            <button onClick={guardarNuevo} style={{ padding: '8px 16px', border: 'none', borderRadius: 8, background: 'var(--brand)', color: 'white', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>Agregar</button>
          </div>
        </Modal>
      )}

      {modal === 'stock' && seleccionado && (
        <Modal title={`Ajustar stock — ${seleccionado.nombre}`} onClose={cerrarModal}>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>Stock actual: <b style={{ color: 'var(--text)' }}>{seleccionado.stock}</b></p>
          <Campo label="Nuevo stock"><input type="number" value={form.stock} onChange={e => setForm(p => ({ ...p, stock: e.target.value }))} /></Campo>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={cerrarModal} style={{ padding: '8px 16px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-card)', fontSize: 13, cursor: 'pointer', color: 'var(--text-secondary)' }}>Cancelar</button>
            <button onClick={ajustarStock} style={{ padding: '8px 16px', border: 'none', borderRadius: 8, background: 'var(--brand)', color: 'white', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>Guardar</button>
          </div>
        </Modal>
      )}
    </div>
  )
}