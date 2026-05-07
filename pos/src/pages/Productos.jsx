import { useState, useEffect } from 'react'
import api from '../api/axios'

const fmt = n => `$${Number(n).toLocaleString('es-AR')}`

function Modal({ title, onClose, children }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
      <div style={{ background: 'white', borderRadius: 16, padding: '1.5rem', width: '100%', maxWidth: 440, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, color: '#999', lineHeight: 1 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Campo({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#555', marginBottom: 5 }}>{label}</label>
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
    try {
      const res = await api.get('/productos')
      setProductos(res.data)
    } catch (err) {
      console.error(err)
    } finally {
      setCargando(false)
    }
  }

  const cerrarModal = () => { setModal(null); setSeleccionado(null); setForm(FORM_VACIO) }

  const guardarNuevo = async () => {
    if (!form.nombre) return
    try {
      const res = await api.post('/productos', { ...form, local })
      setProductos(prev => [...prev, res.data])
      showMsg('ok', `Producto ${form.nombre} agregado`)
      cerrarModal()
    } catch (err) { showMsg('error', 'Error al agregar producto') }
  }

  const eliminar = async id => {
    if (!confirm('¿Eliminar este producto?')) return
    try {
      await api.delete(`/productos/${id}`)
      setProductos(prev => prev.filter(p => p.id !== id))
      showMsg('ok', 'Producto eliminado')
    } catch (err) { showMsg('error', 'Error al eliminar') }
  }

  const editarStock = async (id, delta) => {
    try {
      const res = await api.patch(`/productos/${id}/stock`, { delta })
      setProductos(prev => prev.map(p => p.id === id ? res.data : p))
    } catch (err) { showMsg('error', 'Error al actualizar stock') }
  }

  const ajustarStock = async () => {
    const nuevoStock = parseInt(form.stock)
    if (isNaN(nuevoStock) || nuevoStock < 0) return
    const delta = nuevoStock - seleccionado.stock
    try {
      const res = await api.patch(`/productos/${seleccionado.id}/stock`, { delta })
      setProductos(prev => prev.map(p => p.id === seleccionado.id ? res.data : p))
      showMsg('ok', `Stock actualizado a ${nuevoStock}`)
      cerrarModal()
    } catch (err) { showMsg('error', 'Error al ajustar stock') }
  }

  const prodsFiltrados = productos.filter(p =>
    p.local === local && p.nombre.toLowerCase().includes(busq.toLowerCase())
  )
  const stockBajo = productos.filter(p => p.stock <= 3)

  if (cargando) return <div style={{ color: '#999' }}>Cargando...</div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: '0 0 4px' }}>Productos</h1>
          <p style={{ color: '#999', fontSize: 13, margin: 0 }}>{productos.length} productos en total</p>
        </div>
        <button onClick={() => setModal('nuevo')} style={{ padding: '8px 16px', border: 'none', borderRadius: 8, background: '#111', color: 'white', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>+ Nuevo producto</button>
      </div>

      {msg && <div style={{ padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16, background: msg.tipo === 'ok' ? '#F0FDF4' : '#FEF2F2', color: msg.tipo === 'ok' ? '#16A34A' : '#DC2626' }}>{msg.texto}</div>}

      {/* alertas stock bajo */}
      {stockBajo.length > 0 && (
        <div style={{ padding: '10px 14px', borderRadius: 10, background: '#FFF7ED', border: '1px solid #FED7AA', marginBottom: 16, fontSize: 13, color: '#D97706' }}>
          ⚠ {stockBajo.length} producto{stockBajo.length > 1 ? 's' : ''} con stock bajo: {stockBajo.map(p => p.nombre).join(', ')}
        </div>
      )}

      {/* selector local */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {['Kiosco', 'Librería'].map(l => (
          <button key={l} onClick={() => setLocal(l)} style={{ padding: '7px 18px', border: `1.5px solid ${local === l ? '#111' : '#F0F0F0'}`, borderRadius: 8, background: local === l ? '#111' : 'white', color: local === l ? 'white' : '#666', fontSize: 13, fontWeight: local === l ? 500 : 400, cursor: 'pointer' }}>{l}</button>
        ))}
      </div>

      <input placeholder="Buscar producto..." value={busq} onChange={e => setBusq(e.target.value)} style={{ width: '100%', marginBottom: 14 }} />

      {/* tabla */}
      <div style={{ background: 'white', borderRadius: 12, border: '1px solid #F0F0F0', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #F0F0F0' }}>
              {['Producto', 'Precio', 'Stock', 'Categoría', 'Acciones'].map(h => (
                <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#999', textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {prodsFiltrados.map(p => (
              <tr key={p.id} style={{ borderBottom: '1px solid #F8F9FA' }}>
                <td style={{ padding: '12px 16px', fontSize: 14, fontWeight: 500 }}>{p.nombre}</td>
                <td style={{ padding: '12px 16px', fontSize: 14 }}>{fmt(p.precio)}</td>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button onClick={() => editarStock(p.id, -1)} style={{ width: 26, height: 26, border: '1px solid #F0F0F0', borderRadius: 6, background: 'white', fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                    <span style={{ fontSize: 14, fontWeight: 600, minWidth: 28, textAlign: 'center', color: p.stock <= 3 ? '#DC2626' : '#111' }}>{p.stock}</span>
                    <button onClick={() => editarStock(p.id, 1)} style={{ width: 26, height: 26, border: '1px solid #F0F0F0', borderRadius: 6, background: 'white', fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                    <button onClick={() => { setSeleccionado(p); setForm({ stock: String(p.stock) }); setModal('stock') }} style={{ padding: '3px 8px', border: '1px solid #F0F0F0', borderRadius: 6, background: 'white', fontSize: 11, cursor: 'pointer', color: '#666' }}>Ajustar</button>
                    {p.stock <= 3 && <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 5, background: '#FEF2F2', color: '#DC2626' }}>Bajo</span>}
                  </div>
                </td>
                <td style={{ padding: '12px 16px', fontSize: 13, color: '#666' }}>{p.categoria}</td>
                <td style={{ padding: '12px 16px' }}>
                  <button onClick={() => eliminar(p.id)} style={{ padding: '4px 10px', border: 'none', borderRadius: 6, background: '#FEF2F2', color: '#DC2626', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {prodsFiltrados.length === 0 && <p style={{ padding: '2rem', textAlign: 'center', color: '#999', fontSize: 13 }}>Sin productos</p>}
      </div>

      {/* modal nuevo */}
      {modal === 'nuevo' && (
        <Modal title={`Nuevo producto — ${local}`} onClose={cerrarModal}>
          <Campo label="Nombre">
            <input value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} style={{ width: '100%' }} />
          </Campo>
          <Campo label="Precio">
            <input type="number" value={form.precio} onChange={e => setForm(p => ({ ...p, precio: e.target.value }))} style={{ width: '100%' }} />
          </Campo>
          <Campo label="Stock inicial">
            <input type="number" value={form.stock} onChange={e => setForm(p => ({ ...p, stock: e.target.value }))} style={{ width: '100%' }} />
          </Campo>
          <Campo label="Categoría">
            <select value={form.categoria} onChange={e => setForm(p => ({ ...p, categoria: e.target.value }))} style={{ width: '100%' }}>
              <option value="comida">Comida</option>
              <option value="bebida">Bebida</option>
              <option value="golosina">Golosina</option>
              <option value="útil">Útil escolar</option>
              <option value="otro">Otro</option>
            </select>
          </Campo>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <button onClick={cerrarModal} style={{ padding: '8px 16px', border: '1px solid #F0F0F0', borderRadius: 8, background: 'white', fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
            <button onClick={guardarNuevo} style={{ padding: '8px 16px', border: 'none', borderRadius: 8, background: '#111', color: 'white', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>Agregar</button>
          </div>
        </Modal>
      )}

      {/* modal ajustar stock */}
      {modal === 'stock' && seleccionado && (
        <Modal title={`Ajustar stock — ${seleccionado.nombre}`} onClose={cerrarModal}>
          <p style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>Stock actual: <b style={{ color: '#111' }}>{seleccionado.stock}</b></p>
          <Campo label="Nuevo stock">
            <input type="number" value={form.stock} onChange={e => setForm(p => ({ ...p, stock: e.target.value }))} style={{ width: '100%' }} />
          </Campo>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={cerrarModal} style={{ padding: '8px 16px', border: '1px solid #F0F0F0', borderRadius: 8, background: 'white', fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
            <button onClick={ajustarStock} style={{ padding: '8px 16px', border: 'none', borderRadius: 8, background: '#111', color: 'white', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>Guardar</button>
          </div>
        </Modal>
      )}
    </div>
  )
}