import { useState, useEffect } from 'react'
import api from '../api/axios'
import { SkeletonTable } from '../components/Skeleton'

const fmt = n => `$${Number(n).toLocaleString('es-AR')}`

function Modal({ title, onClose, children }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
      <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', width: '100%', maxWidth: 440, maxHeight: '90vh', overflowY: 'auto', border: '1.5px solid var(--border)', boxShadow: 'var(--shadow-md)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{title}</h2>
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
      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.5px' }}>{label}</label>
      {children}
    </div>
  )
}

const FORM_VACIO = { nombre: '', usuario: '', pin: '', rol: 'cajero' }

export default function Empleados() {
  const [empleados, setEmpleados] = useState([])
  const [cajas, setCajas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [modal, setModal] = useState(null)
  const [seleccionado, setSeleccionado] = useState(null)
  const [form, setForm] = useState(FORM_VACIO)
  const [pinReset, setPinReset] = useState('')
  const [msg, setMsg] = useState(null)

  const showMsg = (tipo, texto) => { setMsg({ tipo, texto }); setTimeout(() => setMsg(null), 3000) }

  useEffect(() => { cargar() }, [])

  const cargar = async () => {
    try {
      const [eRes, cRes] = await Promise.all([api.get('/empleados'), api.get('/cajas')])
      setEmpleados(eRes.data); setCajas(cRes.data)
    } catch (err) { console.error(err) }
    finally { setCargando(false) }
  }

  const cerrarModal = () => { setModal(null); setSeleccionado(null); setForm(FORM_VACIO); setPinReset('') }

  const guardarNuevo = async () => {
    if (!form.nombre || !form.usuario || !form.pin) return
    try {
      const res = await api.post('/empleados', form)
      setEmpleados(p => [...p, res.data])
      showMsg('ok', `Empleado ${form.nombre} registrado`); cerrarModal()
    } catch (err) { showMsg('error', err.response?.data?.error || 'Error al registrar') }
  }

  const toggleEmpleado = async id => {
    try {
      const res = await api.patch(`/empleados/${id}/toggle`)
      setEmpleados(p => p.map(e => e.id === id ? { ...e, activo: res.data.activo } : e))
    } catch { showMsg('error', 'Error') }
  }

  const resetearPin = async () => {
    if (!pinReset || pinReset.length < 4) { showMsg('error', 'PIN debe tener al menos 4 caracteres'); return }
    try {
      await api.patch(`/empleados/${seleccionado.id}/resetear-pin`, { pin_nuevo: pinReset })
      showMsg('ok', 'PIN reseteado correctamente'); cerrarModal()
    } catch { showMsg('error', 'Error al resetear PIN') }
  }

  const cajasEmpleado = seleccionado ? cajas.filter(c => c.empleado_id === seleccionado.id) : []
  const totalVentas = cajasEmpleado.reduce((s, c) => s + parseFloat(c.ventas || 0), 0)

  if (cargando) return <SkeletonTable rows={8} cols={4} />

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 4px', color: 'var(--text)' }}>Empleados</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: 0 }}>{empleados.length} empleados registrados</p>
        </div>
        <button onClick={() => setModal('nuevo')} style={{ padding: '8px 18px', border: 'none', borderRadius: 'var(--radius)', background: '#1E3A5F', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>+ Nuevo empleado</button>
      </div>

      {msg && <div style={{ padding: '10px 14px', borderRadius: 'var(--radius)', fontSize: 13, marginBottom: 16, background: msg.tipo === 'ok' ? 'var(--green-bg)' : 'var(--red-bg)', color: msg.tipo === 'ok' ? 'var(--green)' : 'var(--red)', borderLeft: `3px solid ${msg.tipo === 'ok' ? 'var(--green)' : 'var(--red)'}` }}>{msg.texto}</div>}

      <div style={{ display: 'grid', gap: 10 }}>
        {empleados.map(e => {
          const cajasE = cajas.filter(c => c.empleado_id === e.id)
          const totalE = cajasE.reduce((s, c) => s + parseFloat(c.ventas || 0), 0)
          return (
            <div key={e.id} style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: '1rem 1.25rem', border: '1.5px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', boxShadow: 'var(--shadow)' }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: 'var(--bg)', border: '1.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', flexShrink: 0 }}>
                {e.nombre.split(' ').slice(0, 2).map(n => n[0]).join('')}
              </div>
              <div style={{ flex: 1, minWidth: 150 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{e.nombre}</p>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 6, background: e.rol === 'admin' ? '#EDE9FE' : 'var(--brand-light)', color: e.rol === 'admin' ? '#7C3AED' : 'var(--accent)' }}>{e.rol}</span>
                  <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 6, background: e.activo ? 'var(--green-bg)' : 'var(--red-bg)', color: e.activo ? 'var(--green)' : 'var(--red)' }}>{e.activo ? 'Activo' : 'Inactivo'}</span>
                </div>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--text-tertiary)' }}>@{e.usuario} · {cajasE.length} turnos · Total: <b style={{ color: 'var(--text)' }}>{fmt(totalE)}</b></p>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {[
                  { label: 'Ver turnos', onClick: () => { setSeleccionado(e); setModal('cajas') }, bg: 'var(--bg)', color: 'var(--text-secondary)' },
                  { label: 'Reset PIN', onClick: () => { setSeleccionado(e); setModal('resetPin') }, bg: 'var(--amber-bg)', color: 'var(--amber)' },
                  { label: e.activo ? 'Deshabilitar' : 'Habilitar', onClick: () => toggleEmpleado(e.id), bg: e.activo ? 'var(--red-bg)' : 'var(--green-bg)', color: e.activo ? 'var(--red)' : 'var(--green)' },
                ].map(b => (
                  <button key={b.label} onClick={b.onClick} style={{ padding: '6px 12px', border: 'none', borderRadius: 'var(--radius)', background: b.bg, color: b.color, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{b.label}</button>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {modal === 'nuevo' && (
        <Modal title="Nuevo empleado" onClose={cerrarModal}>
          <Campo label="Nombre completo"><input value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} /></Campo>
          <Campo label="Usuario"><input value={form.usuario} onChange={e => setForm(p => ({ ...p, usuario: e.target.value }))} /></Campo>
          <Campo label="PIN"><input type="password" value={form.pin} onChange={e => setForm(p => ({ ...p, pin: e.target.value }))} /></Campo>
          <Campo label="Rol">
            <select value={form.rol} onChange={e => setForm(p => ({ ...p, rol: e.target.value }))}>
              <option value="cajero">Cajero</option>
              <option value="admin">Administrador</option>
            </select>
          </Campo>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <button onClick={cerrarModal} style={{ padding: '8px 16px', border: '1.5px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--bg-card)', fontSize: 13, cursor: 'pointer', color: 'var(--text-secondary)' }}>Cancelar</button>
            <button onClick={guardarNuevo} style={{ padding: '8px 18px', border: 'none', borderRadius: 'var(--radius)', background: '#1E3A5F', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Registrar</button>
          </div>
        </Modal>
      )}

      {modal === 'resetPin' && seleccionado && (
        <Modal title={`Reset PIN — ${seleccionado.nombre}`} onClose={cerrarModal}>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>Ingresá el nuevo PIN para este empleado.</p>
          <Campo label="Nuevo PIN">
            <input type="password" value={pinReset} onChange={e => setPinReset(e.target.value)} placeholder="Mínimo 4 caracteres" />
          </Campo>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={cerrarModal} style={{ padding: '8px 16px', border: '1.5px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--bg-card)', fontSize: 13, cursor: 'pointer', color: 'var(--text-secondary)' }}>Cancelar</button>
            <button onClick={resetearPin} style={{ padding: '8px 18px', border: 'none', borderRadius: 'var(--radius)', background: '#1E3A5F', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Resetear</button>
          </div>
        </Modal>
      )}

      {modal === 'cajas' && seleccionado && (
        <Modal title={`Turnos — ${seleccionado.nombre}`} onClose={cerrarModal}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
            {[['Total turnos', cajasEmpleado.length], ['Total vendido', fmt(totalVentas)]].map(([label, value]) => (
              <div key={label} style={{ background: 'var(--bg)', borderRadius: 'var(--radius)', padding: '10px 12px', border: '1px solid var(--border)' }}>
                <p style={{ margin: '0 0 2px', fontSize: 11, color: 'var(--text-secondary)' }}>{label}</p>
                <p style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>{value}</p>
              </div>
            ))}
          </div>
          {cajasEmpleado.length === 0 ? <p style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>Sin turnos</p> : cajasEmpleado.map(c => (
            <div key={c.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border-light)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ margin: '0 0 2px', fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{c.local}</p>
                  <p style={{ margin: 0, fontSize: 11, color: 'var(--text-tertiary)' }}>{new Date(c.apertura).toLocaleString('es-AR')}</p>
                  <p style={{ margin: 0, fontSize: 11, color: 'var(--text-tertiary)' }}>{c.tx_count} tx · Fondo: {fmt(c.fondo)}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{fmt(c.ventas)}</p>
                  <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 6, background: c.abierta ? 'var(--green-bg)' : 'var(--bg)', color: c.abierta ? 'var(--green)' : 'var(--text-tertiary)' }}>{c.abierta ? 'Abierta' : 'Cerrada'}</span>
                </div>
              </div>
            </div>
          ))}
        </Modal>
      )}
    </div>
  )
}