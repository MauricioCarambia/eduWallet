import { useState, useEffect } from 'react'
import api from '../api/axios'
import useUmbralStock from '../hooks/useUmbralStock'
import { SkeletonTable } from '../components/Skeleton'
import { useLocales } from '../hooks/useLocales'
import { useAuth } from '../context/AuthContext'
import useLectorTarjeta from '../hooks/useLectorTarjeta'
import { leerArchivo, descargarModelo } from '../utils/importarProductos'
import { ALERGENOS, nombresAlergenos } from '../utils/alergenos'
import Icono from '../components/Icono'

const fmt = n => `$${Number(n).toLocaleString('es-AR')}`

function Modal({ title, onClose, children, ancho = 440 }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
      <div style={{ background: 'var(--bg-card)', borderRadius: 16, padding: '1.5rem', width: '100%', maxWidth: ancho, maxHeight: '90vh', overflowY: 'auto', border: '1px solid var(--border)', boxShadow: 'var(--shadow-md)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, color: 'var(--text-secondary)', lineHeight: 1, cursor: 'pointer' }}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Campo({ label, children, ayuda }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.5px' }}>{label}</label>
      {children}
      {ayuda && <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--text-secondary)' }}>{ayuda}</p>}
    </div>
  )
}

// Alérgenos que contiene el producto: el POS avisa (o bloquea) si el alumno es alérgico
function ElegirAlergenos({ value = [], onChange }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {Object.entries(ALERGENOS).map(([clave, texto]) => {
        const activo = value.includes(clave)
        return (
          <button key={clave} type="button" aria-pressed={activo} onClick={() => onChange(activo ? value.filter(a => a !== clave) : [...value, clave])}
            style={{ padding: '5px 10px', borderRadius: 16, border: `1.5px solid ${activo ? 'var(--red)' : 'var(--border)'}`, background: activo ? 'var(--red-bg)' : 'var(--bg-card)', color: activo ? 'var(--red)' : 'var(--text-secondary)', fontSize: 12, fontWeight: activo ? 600 : 400, cursor: 'pointer' }}>
            {activo && <Icono nombre="alerta" />}{texto}
          </button>
        )
      })}
    </div>
  )
}

function SelectCategoria({ value, onChange }) {
  return (
    <select value={value} onChange={onChange}>
      <option value="comida">Comida</option>
      <option value="bebida">Bebida</option>
      <option value="golosina">Golosina</option>
      <option value="útil">Útil escolar</option>
      <option value="otro">Otro</option>
    </select>
  )
}

const btnSec = { padding: '8px 16px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-card)', fontSize: 13, cursor: 'pointer', color: 'var(--text-secondary)' }
const btnPri = { padding: '8px 16px', border: 'none', borderRadius: 8, background: 'var(--brand)', color: 'var(--on-brand)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }

const FORM_VACIO = { nombre: '', precio: '', stock: '10', categoria: 'comida', codigo_barras: '', alergenos: [], grupo: '' }
const limpiarCodigo = c => String(c ?? '').replace(/\s+/g, '')

export default function Productos() {
  const umbral = useUmbralStock()
  const { sesion } = useAuth()
  const { locales } = useLocales()
  const [productos, setProductos] = useState([])
  const [local, setLocal] = useState('')
  const [cargando, setCargando] = useState(true)
  const [modal, setModal] = useState(null)
  const [seleccionado, setSeleccionado] = useState(null)
  const [form, setForm] = useState(FORM_VACIO)
  const [busq, setBusq] = useState('')
  const [msg, setMsg] = useState(null)
  const [importacion, setImportacion] = useState(null) // { archivo, filas, error, resultado }
  const [importando, setImportando] = useState(false)

  const showMsg = (tipo, texto) => { setMsg({ tipo, texto }); setTimeout(() => setMsg(null), 3000) }

  useEffect(() => { cargar() }, [])
  const zonaFija = sesion?.local || null
  useEffect(() => { if (!local) setLocal(zonaFija || (locales.length > 0 ? locales[0] : '')) }, [locales, zonaFija])

  const cargar = async () => {
    try { const res = await api.get('/productos'); setProductos(res.data) }
    catch (err) { console.error(err) } finally { setCargando(false) }
  }

  const cerrarModal = () => { setModal(null); setSeleccionado(null); setForm(FORM_VACIO); setImportacion(null) }

  const abrirStock = (p, sumar = 0) => { setSeleccionado(p); setForm({ stock: String(p.stock + sumar) }); setModal('stock') }

  // Lector de códigos de barras (el mismo lector USB del QR de la credencial):
  // con el formulario abierto completa el código; si no, busca el producto en
  // esta zona: si existe abre el stock (cada escaneo suma 1), si no, lo da de alta
  const alEscanear = leido => {
    const codigo = limpiarCodigo(leido)
    if (modal === 'nuevo' || modal === 'editar') { setForm(p => ({ ...p, codigo_barras: codigo })); return }
    if (modal === 'stock') {
      if (seleccionado?.codigo_barras === codigo) setForm(p => ({ stock: String((parseInt(p.stock) || 0) + 1) }))
      else showMsg('error', 'Guardá o cerrá el stock de este producto antes de escanear otro')
      return
    }
    if (modal) return
    const existente = productos.find(p => p.local === local && p.codigo_barras === codigo)
    if (existente) abrirStock(existente, 1)
    else { setForm({ ...FORM_VACIO, codigo_barras: codigo }); setModal('nuevo') }
  }
  useLectorTarjeta(alEscanear, !!local, { repetidaMs: 0 })

  const guardarNuevo = async () => {
    if (!form.nombre) return
    try {
      const res = await api.post('/productos', { ...form, local })
      setProductos(prev => [...prev, res.data])
      showMsg('ok', `Producto ${form.nombre} agregado`); cerrarModal()
    } catch (err) { showMsg('error', err.response?.data?.error || 'Error al agregar producto') }
  }

  const guardarEdicion = async () => {
    if (!form.nombre) return
    try {
      const res = await api.put(`/productos/${seleccionado.id}`, { nombre: form.nombre, precio: form.precio, categoria: form.categoria, codigo_barras: form.codigo_barras, alergenos: form.alergenos || [], grupo: form.grupo || '' })
      setProductos(prev => prev.map(p => p.id === res.data.id ? res.data : p))
      showMsg('ok', `Producto ${res.data.nombre} actualizado`); cerrarModal()
    } catch (err) { showMsg('error', err.response?.data?.error || 'Error al guardar el producto') }
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

  // ─── Importar desde Excel / CSV ───────────────────────────────────────────
  const elegirArchivo = async e => {
    const archivo = e.target.files?.[0]
    e.target.value = ''
    if (!archivo) return
    try { setImportacion({ archivo: archivo.name, filas: await leerArchivo(archivo) }) }
    catch (err) { setImportacion({ archivo: archivo.name, error: err.message || 'No se pudo leer el archivo' }) }
  }

  const confirmarImportacion = async () => {
    const validas = importacion.filas.filter(f => !f.aviso)
    if (validas.length === 0 || importando) return
    setImportando(true)
    try {
      const res = await api.post('/productos/importar', { local, productos: validas.map(f => ({ ...f, aviso: undefined })) })
      const avisos = importacion.filas.filter(f => f.aviso).map(f => ({ fila: f.fila, error: f.aviso }))
      const errores = [...avisos, ...res.data.errores].sort((a, b) => a.fila - b.fila)
      setImportacion(prev => ({ ...prev, resultado: { ...res.data, errores } }))
      await cargar()
    } catch (err) {
      setImportacion(prev => ({ ...prev, error: err.response?.data?.error || 'Error al importar' }))
    } finally { setImportando(false) }
  }

  const texto = busq.toLowerCase()
  const prodsFiltrados = productos.filter(p => p.local === local && (p.nombre.toLowerCase().includes(texto) || (p.codigo_barras || '').includes(busq.trim())))
  const deLaZona = productos.filter(p => p.local === local)
  const stockBajo = deLaZona.filter(p => p.stock <= umbral)
  const gruposZona = [...new Set(deLaZona.map(p => p.grupo).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'))

  if (cargando) return <SkeletonTable rows={6} cols={4} />

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: '0 0 4px', color: 'var(--text)' }}>Productos</h1>
          <p style={{ color: 'var(--text)', fontSize: 13, margin: 0 }}>{deLaZona.length} productos{local ? ` en ${local}` : ''} · escaneá un código de barras para cargarlo o sumar stock</p>
        </div>
        {local && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { setImportacion({}); setModal('importar') }} style={btnSec}><Icono nombre="subir" />Importar Excel</button>
            <button onClick={() => setModal('nuevo')} style={btnPri}>+ Nuevo producto</button>
          </div>
        )}
      </div>

      {msg && <div style={{ padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16, background: msg.tipo === 'ok' ? 'var(--green-bg)' : 'var(--red-bg)', color: msg.tipo === 'ok' ? 'var(--green)' : 'var(--red)', borderLeft: `3px solid ${msg.tipo === 'ok' ? 'var(--green)' : 'var(--red)'}` }}>{msg.texto}</div>}

      <datalist id="grupos-zona">{gruposZona.map(g => <option key={g} value={g} />)}</datalist>

      {stockBajo.length > 0 && (
        <div style={{ padding: '10px 14px', borderRadius: 10, background: 'var(--amber-bg)', border: '1px solid var(--amber)', marginBottom: 16, fontSize: 13, color: 'var(--amber)', borderLeft: '3px solid var(--amber)' }}>
          <Icono nombre="alerta" />{stockBajo.length} producto{stockBajo.length > 1 ? 's' : ''} con stock bajo: {stockBajo.map(p => p.nombre).join(', ')}
        </div>
      )}

      {!zonaFija && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          {locales.map(l => (
            <button key={l} onClick={() => setLocal(l)} style={{ padding: '7px 18px', border: `1.5px solid ${local === l ? 'var(--brand)' : 'var(--border)'}`, borderRadius: 8, background: local === l ? 'var(--brand)' : 'var(--bg-card)', color: local === l ? 'var(--on-brand)' : 'var(--text-secondary)', fontSize: 13, fontWeight: local === l ? 500 : 400, cursor: 'pointer' }}>{l}</button>
          ))}
        </div>
      )}

      <input placeholder="Buscar por nombre o código..." value={busq} onChange={e => setBusq(e.target.value)} style={{ marginBottom: 14 }} />

      <div style={{ background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Producto', 'Código de barras', 'Precio', 'Stock', 'Categoría', 'Acciones'].map(h => (
                <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.5px' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {prodsFiltrados.map(p => (
              <tr key={p.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                <td style={{ padding: '12px 16px', fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>
                  {p.nombre}
                  {p.grupo && <span style={{ display: 'inline-block', marginTop: 3, fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 6, background: 'var(--brand-light)', color: 'var(--brand)' }}>{p.grupo}</span>}
                  {p.alergenos?.length > 0 && <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--red)' }}><Icono nombre="alerta" />{nombresAlergenos(p.alergenos)}</div>}
                </td>
                <td style={{ padding: '12px 16px', fontSize: 13, fontFamily: 'monospace', color: p.codigo_barras ? 'var(--text)' : 'var(--text-tertiary)' }}>{p.codigo_barras || '—'}</td>
                <td style={{ padding: '12px 16px', fontSize: 14, color: 'var(--text)' }}>{fmt(p.precio)}</td>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button onClick={() => editarStock(p.id, -1)} style={{ width: 26, height: 26, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-card)', fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>−</button>
                    <span style={{ fontSize: 14, fontWeight: 600, minWidth: 28, textAlign: 'center', color: p.stock <= umbral ? 'var(--red)' : 'var(--text)' }}>{p.stock}</span>
                    <button onClick={() => editarStock(p.id, 1)} style={{ width: 26, height: 26, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-card)', fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>+</button>
                    <button onClick={() => abrirStock(p)} style={{ padding: '3px 8px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-card)', fontSize: 11, cursor: 'pointer', color: 'var(--text-secondary)' }}>Ajustar</button>
                    {p.stock <= umbral && <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 5, background: 'var(--red-bg)', color: 'var(--red)' }}>Bajo</span>}
                  </div>
                </td>
                <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-secondary)' }}>{p.categoria}</td>
                <td style={{ padding: '12px 16px', display: 'flex', gap: 6 }}>
                  <button onClick={() => { setSeleccionado(p); setForm({ nombre: p.nombre, precio: String(Number(p.precio)), categoria: p.categoria || 'otro', codigo_barras: p.codigo_barras || '', alergenos: p.alergenos || [], grupo: p.grupo || '' }); setModal('editar') }} style={{ padding: '4px 10px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-card)', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>Editar</button>
                  <button onClick={() => eliminar(p.id)} style={{ padding: '4px 10px', border: 'none', borderRadius: 6, background: 'var(--red-bg)', color: 'var(--red)', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {prodsFiltrados.length === 0 && <p style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>Sin productos</p>}
      </div>

      {modal === 'nuevo' && (
        <Modal title={`Nuevo producto — ${local}`} onClose={cerrarModal}>
          <Campo label="Nombre"><input autoFocus value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} /></Campo>
          <Campo label="Precio"><input type="number" value={form.precio} onChange={e => setForm(p => ({ ...p, precio: e.target.value }))} /></Campo>
          <Campo label="Stock inicial"><input type="number" value={form.stock} onChange={e => setForm(p => ({ ...p, stock: e.target.value }))} /></Campo>
          <Campo label="Categoría"><SelectCategoria value={form.categoria} onChange={e => setForm(p => ({ ...p, categoria: e.target.value }))} /></Campo>
          <Campo label="Grupo (opcional)" ayuda="Para variedades del mismo producto (ej. Alfajores): en Venta se muestran juntas en una sola tarjeta">
            <input list="grupos-zona" value={form.grupo || ''} onChange={e => setForm(p => ({ ...p, grupo: e.target.value }))} placeholder="Ej: Alfajores" />
          </Campo>
          <Campo label="Código de barras (opcional)" ayuda="Escanealo con el lector o escribilo">
            <input value={form.codigo_barras} onChange={e => setForm(p => ({ ...p, codigo_barras: e.target.value }))} placeholder="Ej: 7790580000011" />
          </Campo>
          <Campo label="Contiene alérgenos" ayuda="Si un alumno es alérgico, el punto de venta avisa o no deja venderlo">
            <ElegirAlergenos value={form.alergenos} onChange={v => setForm(p => ({ ...p, alergenos: v }))} />
          </Campo>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <button onClick={cerrarModal} style={btnSec}>Cancelar</button>
            <button onClick={guardarNuevo} style={btnPri}>Agregar</button>
          </div>
        </Modal>
      )}

      {modal === 'editar' && seleccionado && (
        <Modal title={`Editar — ${seleccionado.nombre}`} onClose={cerrarModal}>
          <Campo label="Nombre"><input value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} /></Campo>
          <Campo label="Precio"><input type="number" value={form.precio} onChange={e => setForm(p => ({ ...p, precio: e.target.value }))} /></Campo>
          <Campo label="Categoría"><SelectCategoria value={form.categoria} onChange={e => setForm(p => ({ ...p, categoria: e.target.value }))} /></Campo>
          <Campo label="Grupo (opcional)" ayuda="Para variedades del mismo producto (ej. Alfajores): en Venta se muestran juntas en una sola tarjeta">
            <input list="grupos-zona" value={form.grupo || ''} onChange={e => setForm(p => ({ ...p, grupo: e.target.value }))} placeholder="Ej: Alfajores" />
          </Campo>
          <Campo label="Código de barras (opcional)" ayuda="Escanealo con el lector o escribilo">
            <input value={form.codigo_barras} onChange={e => setForm(p => ({ ...p, codigo_barras: e.target.value }))} placeholder="Ej: 7790580000011" />
          </Campo>
          <Campo label="Contiene alérgenos" ayuda="Si un alumno es alérgico, el punto de venta avisa o no deja venderlo">
            <ElegirAlergenos value={form.alergenos} onChange={v => setForm(p => ({ ...p, alergenos: v }))} />
          </Campo>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <button onClick={cerrarModal} style={btnSec}>Cancelar</button>
            <button onClick={guardarEdicion} style={btnPri}>Guardar</button>
          </div>
        </Modal>
      )}

      {modal === 'stock' && seleccionado && (
        <Modal title={`Ajustar stock — ${seleccionado.nombre}`} onClose={cerrarModal}>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>Stock actual: <b style={{ color: 'var(--text)' }}>{seleccionado.stock}</b></p>
          <Campo label="Nuevo stock" ayuda={seleccionado.codigo_barras ? 'Cada vez que escaneás este producto suma 1' : null}>
            <input type="number" value={form.stock} onChange={e => setForm(p => ({ ...p, stock: e.target.value }))} />
          </Campo>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={cerrarModal} style={btnSec}>Cancelar</button>
            <button onClick={ajustarStock} style={btnPri}>Guardar</button>
          </div>
        </Modal>
      )}

      {modal === 'importar' && importacion && (
        <Modal title={`Importar productos — ${local}`} onClose={cerrarModal} ancho={620}>
          {importacion.resultado ? (
            <div>
              <div style={{ padding: '12px 14px', borderRadius: 10, background: 'var(--green-bg)', color: 'var(--green)', fontSize: 14, marginBottom: 12 }}>
                ✓ {importacion.resultado.creados} producto{importacion.resultado.creados === 1 ? '' : 's'} nuevo{importacion.resultado.creados === 1 ? '' : 's'} y {importacion.resultado.actualizados} actualizado{importacion.resultado.actualizados === 1 ? '' : 's'}
              </div>
              {importacion.resultado.errores.length > 0 && (
                <div style={{ padding: '10px 14px', borderRadius: 10, background: 'var(--red-bg)', color: 'var(--red)', fontSize: 13, marginBottom: 12 }}>
                  <b>{importacion.resultado.errores.length} fila{importacion.resultado.errores.length === 1 ? '' : 's'} sin importar:</b>
                  <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                    {importacion.resultado.errores.slice(0, 30).map(e => <li key={e.fila}>Fila {e.fila}: {e.error}</li>)}
                  </ul>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button onClick={cerrarModal} style={btnPri}>Listo</button></div>
            </div>
          ) : (
            <div>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 12px', lineHeight: 1.5 }}>
                Subí un Excel (.xlsx) o CSV con las columnas <b>nombre</b> y <b>precio</b>, y si querés <b>stock</b>, <b>categoria</b>, <b>codigo_barras</b>, <b>alergenos</b> y <b>grupo</b> (ej.: "maní, gluten").
                Los productos que ya existen en {local} (mismo código o mismo nombre) se actualizan; el resto se crea.
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
                <label style={{ ...btnPri, display: 'inline-block' }}>
                  Elegir archivo
                  <input type="file" accept=".xlsx,.csv" onChange={elegirArchivo} style={{ display: 'none' }} />
                </label>
                <button onClick={descargarModelo} style={btnSec}>Descargar planilla modelo</button>
              </div>

              {importacion.error && <div style={{ padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 12, background: 'var(--red-bg)', color: 'var(--red)' }}>{importacion.archivo ? `${importacion.archivo}: ` : ''}{importacion.error}</div>}

              {importacion.filas && (
                <>
                  <p style={{ fontSize: 13, color: 'var(--text)', margin: '0 0 8px' }}><b>{importacion.archivo}</b> · {importacion.filas.length} producto{importacion.filas.length === 1 ? '' : 's'}</p>
                  <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'auto', maxHeight: 260, marginBottom: 14 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: 'var(--bg-subtle)', position: 'sticky', top: 0 }}>
                          {['Fila', 'Nombre', 'Precio', 'Stock', 'Categoría', 'Código'].map(h => <th key={h} style={{ padding: '6px 8px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600 }}>{h}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {importacion.filas.slice(0, 100).map(f => (
                          <tr key={f.fila} style={{ borderTop: '1px solid var(--border-light)', color: f.aviso ? 'var(--red)' : 'var(--text)' }} title={f.aviso || ''}>
                            <td style={{ padding: '5px 8px', color: 'var(--text-secondary)' }}>{f.fila}</td>
                            <td style={{ padding: '5px 8px' }}>{f.nombre || <i style={{ color: 'var(--red)' }}>falta</i>}</td>
                            <td style={{ padding: '5px 8px' }}>{typeof f.precio === 'number' ? fmt(f.precio) : <i style={{ color: 'var(--red)' }}>{f.precio || 'falta'}</i>}</td>
                            <td style={{ padding: '5px 8px' }}>{f.stock === '' ? '—' : f.stock}</td>
                            <td style={{ padding: '5px 8px' }}>{f.categoria || '—'}</td>
                            <td style={{ padding: '5px 8px', fontFamily: 'monospace' }}>{f.aviso ? <Icono nombre="alerta" /> : f.codigo_barras || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {importacion.filas.length > 100 && <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '-6px 0 12px' }}>Se muestran los primeros 100.</p>}
                  {importacion.filas.some(f => f.aviso) && <p style={{ fontSize: 12, color: 'var(--red)', margin: '0 0 12px' }}><Icono nombre="alerta" />{importacion.filas.find(f => f.aviso).aviso}</p>}
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button onClick={cerrarModal} style={btnSec}>Cancelar</button>
                    <button onClick={confirmarImportacion} disabled={importando} style={{ ...btnPri, opacity: importando ? 0.6 : 1 }}>{importando ? 'Importando...' : `Importar ${importacion.filas.filter(f => !f.aviso).length} productos`}</button>
                  </div>
                </>
              )}
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}
