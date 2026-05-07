import { useState, useEffect } from 'react'
import api from '../api/axios'

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

function Btn({ onClick, color = '#111', children, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{ padding: '8px 16px', border: 'none', borderRadius: 8, background: color, color: 'white', fontSize: 13, fontWeight: 500, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1 }}>
      {children}
    </button>
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
      setEmpleados(eRes.data)
      setCajas(cRes.data)
    } catch (err) {
      console.error(err)
    } finally {
      setCargando(false)
    }
  }

  const cerrarModal = () => { setModal(null); setSeleccionado(null); setForm(FORM_VACIO); setPinReset('') }

  const guardarNuevo = async () => {
    if (!form.nombre || !form.usuario || !form.pin) return
    try {
      const res = await api.post('/empleados', form)
      setEmpleados(prev => [...prev, res.data])
      showMsg('ok', `Empleado ${form.nombre} registrado`)
      cerrarModal()
    } catch (err) { showMsg('error', err.response?.data?.error || 'Error al registrar') }
  }

  const toggleEmpleado = async id => {
    try {
      const res = await api.patch(`/empleados/${id}/toggle`)
      setEmpleados(prev => prev.map(e => e.id === id ? { ...e, activo: res.data.activo } : e))
    } catch (err) { showMsg('error', 'Error') }
  }

  const resetearPin = async () => {
    if (!pinReset || pinReset.length < 4) { showMsg('error', 'El PIN debe tener al menos 4 caracteres'); return }
    try {
      await api.patch(`/empleados/${seleccionado.id}/resetear-pin`, { pin_nuevo: pinReset })
      showMsg('ok', 'PIN reseteado correctamente')
      cerrarModal()
    } catch (err) { showMsg('error', 'Error al resetear PIN') }
  }

  const cajasEmpleado = seleccionado ? cajas.filter(c => c.empleado_id === seleccionado.id) : []
  const totalVentasEmpleado = cajasEmpleado.reduce((s, c) => s + parseFloat(c.ventas || 0), 0)

  if (cargando) return <div style={{ color: '#999' }}>Cargando...</div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: '0 0 4px' }}>Empleados</h1>
          <p style={{ color: '#999', fontSize: 13, margin: 0 }}>{empleados.length} empleados registrados</p>
        </div>
        <Btn onClick={() => setModal('nuevo')}>+ Nuevo empleado</Btn>
      </div>

      {msg && <div style={{ padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16, background: msg.tipo === 'ok' ? '#F0FDF4' : '#FEF2F2', color: msg.tipo === 'ok' ? '#16A34A' : '#DC2626' }}>{msg.texto}</div>}

      <div style={{ display: 'grid', gap: 10 }}>
        {empleados.map(e => {
          const cajasE = cajas.filter(c => c.empleado_id === e.id)
          const totalE = cajasE.reduce((s, c) => s + parseFloat(c.ventas || 0), 0)
          return (
            <div key={e.id} style={{ background: 'white', borderRadius: 12, padding: '1rem 1.25rem', border: '1px solid #F0F0F0', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: '#F8F9FA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, color: '#666', flexShrink: 0 }}>
                {e.nombre.split(' ').slice(0, 2).map(n => n[0]).join('')}
              </div>
              <div style={{ flex: 1, minWidth: 150 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 500 }}>{e.nombre}</p>
                  <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 6, background: e.rol === 'admin' ? '#F5F3FF' : '#EFF6FF', color: e.rol === 'admin' ? '#7C3AED' : '#2563EB' }}>{e.rol}</span>
                  <span style={{ fontSize: 10, fontWeight: 500, padding: '2px 7px', borderRadius: 6, background: e.activo ? '#F0FDF4' : '#FEF2F2', color: e.activo ? '#16A34A' : '#DC2626' }}>{e.activo ? 'Activo' : 'Inactivo'}</span>
                </div>
                <p style={{ margin: 0, fontSize: 12, color: '#999' }}>@{e.usuario} · {cajasE.length} turnos · Total vendido: <b style={{ color: '#111' }}>${Number(totalE).toLocaleString('es-AR')}</b></p>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button onClick={() => { setSeleccionado(e); setModal('cajas') }} style={{ padding: '5px 12px', border: '1px solid #F0F0F0', borderRadius: 7, background: 'white', fontSize: 12, cursor: 'pointer', color: '#666' }}>Ver turnos</button>
                <button onClick={() => { setSeleccionado(e); setModal('resetPin') }} style={{ padding: '5px 12px', border: '1px solid #F0F0F0', borderRadius: 7, background: 'white', fontSize: 12, cursor: 'pointer', color: '#666' }}>Reset PIN</button>
                <button onClick={() => toggleEmpleado(e.id)} style={{ padding: '5px 12px', border: 'none', borderRadius: 7, fontSize: 12, cursor: 'pointer', background: e.activo ? '#FEF2F2' : '#F0FDF4', color: e.activo ? '#DC2626' : '#16A34A', fontWeight: 500 }}>
                  {e.activo ? 'Deshabilitar' : 'Habilitar'}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* modal nuevo */}
      {modal === 'nuevo' && (
        <Modal title="Nuevo empleado" onClose={cerrarModal}>
          <Campo label="Nombre completo"><input value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} style={{ width: '100%' }} /></Campo>
          <Campo label="Usuario"><input value={form.usuario} onChange={e => setForm(p => ({ ...p, usuario: e.target.value }))} style={{ width: '100%' }} /></Campo>
          <Campo label="PIN"><input type="password" value={form.pin} onChange={e => setForm(p => ({ ...p, pin: e.target.value }))} style={{ width: '100%' }} /></Campo>
          <Campo label="Rol">
            <select value={form.rol} onChange={e => setForm(p => ({ ...p, rol: e.target.value }))} style={{ width: '100%' }}>
              <option value="cajero">Cajero</option>
              <option value="admin">Administrador</option>
            </select>
          </Campo>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <button onClick={cerrarModal} style={{ padding: '8px 16px', border: '1px solid #F0F0F0', borderRadius: 8, background: 'white', fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
            <Btn onClick={guardarNuevo}>Registrar</Btn>
          </div>
        </Modal>
      )}

      {/* modal reset pin */}
      {modal === 'resetPin' && seleccionado && (
        <Modal title={`Reset PIN — ${seleccionado.nombre}`} onClose={cerrarModal}>
          <p style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>Ingresá el nuevo PIN para este empleado.</p>
          <Campo label="Nuevo PIN">
            <input type="password" value={pinReset} onChange={e => setPinReset(e.target.value)} placeholder="Mínimo 4 caracteres" style={{ width: '100%' }} />
          </Campo>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={cerrarModal} style={{ padding: '8px 16px', border: '1px solid #F0F0F0', borderRadius: 8, background: 'white', fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
            <Btn onClick={resetearPin}>Resetear PIN</Btn>
          </div>
        </Modal>
      )}

      {/* modal cajas empleado */}
      {modal === 'cajas' && seleccionado && (
        <Modal title={`Turnos — ${seleccionado.nombre}`} onClose={cerrarModal}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
            <div style={{ background: '#F8F9FA', borderRadius: 8, padding: '10px 12px' }}>
              <p style={{ margin: '0 0 2px', fontSize: 11, color: '#999' }}>Total turnos</p>
              <p style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>{cajasEmpleado.length}</p>
            </div>
            <div style={{ background: '#F8F9FA', borderRadius: 8, padding: '10px 12px' }}>
              <p style={{ margin: '0 0 2px', fontSize: 11, color: '#999' }}>Total vendido</p>
              <p style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>${Number(totalVentasEmpleado).toLocaleString('es-AR')}</p>
            </div>
          </div>
          {cajasEmpleado.length === 0 ? <p style={{ color: '#999', fontSize: 13 }}>Sin turnos registrados</p> : cajasEmpleado.map(c => (
            <div key={c.id} style={{ padding: '10px 0', borderBottom: '1px solid #F8F9FA' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ margin: '0 0 2px', fontSize: 13, fontWeight: 500 }}>{c.local}</p>
                  <p style={{ margin: 0, fontSize: 11, color: '#999' }}>Apertura: {new Date(c.apertura).toLocaleString('es-AR')}</p>
                  {c.cierre && <p style={{ margin: 0, fontSize: 11, color: '#999' }}>Cierre: {new Date(c.cierre).toLocaleString('es-AR')}</p>}
                  <p style={{ margin: 0, fontSize: 11, color: '#999' }}>{c.tx_count} transacciones · Fondo: ${Number(c.fondo).toLocaleString('es-AR')}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 600 }}>${Number(c.ventas).toLocaleString('es-AR')}</p>
                  <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 6, background: c.abierta ? '#F0FDF4' : '#F8F9FA', color: c.abierta ? '#16A34A' : '#999' }}>{c.abierta ? 'Abierta' : 'Cerrada'}</span>
                </div>
              </div>
            </div>
          ))}
        </Modal>
      )}
    </div>
  )
}