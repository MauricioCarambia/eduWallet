import { useState, useEffect } from 'react'
import api from '../api/axios'

const fmt = n => `$${Number(n).toLocaleString('es-AR')}`

function Modal({ title, onClose, children }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
      <div style={{ background: 'white', borderRadius: 16, padding: '1.5rem', width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }}>
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

const FORM_VACIO = { nombre: '', curso: '', saldo: '0', limite_diario: '500', tutor: '', tutor_tel: '', alergias: 'Ninguna' }

export default function Alumnos() {
  const [alumnos, setAlumnos] = useState([])
  const [txs, setTxs] = useState([])
  const [cargando, setCargando] = useState(true)
  const [busq, setBusq] = useState('')
  const [filtroCurso, setFiltroCurso] = useState('Todos')
  const [modal, setModal] = useState(null) // 'nuevo' | 'editar' | 'historial' | 'recargar'
  const [seleccionado, setSeleccionado] = useState(null)
  const [form, setForm] = useState(FORM_VACIO)
  const [montoRecarga, setMontoRecarga] = useState('')
  const [msg, setMsg] = useState(null)

  const showMsg = (tipo, texto) => { setMsg({ tipo, texto }); setTimeout(() => setMsg(null), 3000) }

  useEffect(() => {
    cargar()
  }, [])

  const cargar = async () => {
    try {
      const [aRes, tRes] = await Promise.all([api.get('/alumnos'), api.get('/transacciones')])
      setAlumnos(aRes.data)
      setTxs(tRes.data)
    } catch (err) {
      console.error(err)
    } finally {
      setCargando(false)
    }
  }

  const cursos = ['Todos', ...new Set(alumnos.map(a => a.curso))]
  const filtrados = alumnos.filter(a =>
    (a.nombre.toLowerCase().includes(busq.toLowerCase()) || a.id.toString().includes(busq)) &&
    (filtroCurso === 'Todos' || a.curso === filtroCurso)
  )

  const abrirNuevo = () => { setForm(FORM_VACIO); setModal('nuevo') }
  const abrirEditar = a => { setSeleccionado(a); setForm({ nombre: a.nombre, curso: a.curso, saldo: a.saldo, limite_diario: a.limite_diario, tutor: a.tutor || '', tutor_tel: a.tutor_tel || '', alergias: a.alergias || 'Ninguna' }); setModal('editar') }
  const abrirHistorial = a => { setSeleccionado(a); setModal('historial') }
  const abrirRecargar = a => { setSeleccionado(a); setMontoRecarga(''); setModal('recargar') }
  const cerrarModal = () => { setModal(null); setSeleccionado(null) }

  const guardarNuevo = async () => {
    if (!form.nombre || !form.curso) return
    try {
      const res = await api.post('/alumnos', form)
      setAlumnos(prev => [...prev, res.data])
      showMsg('ok', `Alumno ${form.nombre} registrado`)
      cerrarModal()
    } catch (err) { showMsg('error', 'Error al registrar') }
  }

  const guardarEditar = async () => {
    try {
      const res = await api.put(`/alumnos/${seleccionado.id}`, form)
      setAlumnos(prev => prev.map(a => a.id === seleccionado.id ? res.data : a))
      showMsg('ok', 'Alumno actualizado')
      cerrarModal()
    } catch (err) { showMsg('error', 'Error al actualizar') }
  }

  const eliminar = async id => {
    if (!confirm('¿Eliminar este alumno?')) return
    try {
      await api.delete(`/alumnos/${id}`)
      setAlumnos(prev => prev.filter(a => a.id !== id))
      showMsg('ok', 'Alumno eliminado')
    } catch (err) { showMsg('error', 'Error al eliminar') }
  }

  const toggleBloqueo = async a => {
    try {
      const res = await api.patch(`/alumnos/${a.id}/toggle`)
      setAlumnos(prev => prev.map(x => x.id === a.id ? res.data : x))
    } catch (err) { showMsg('error', 'Error') }
  }

  const recargar = async () => {
    const n = parseInt(montoRecarga)
    if (!n || n <= 0) return
    try {
      const res = await api.post(`/alumnos/${seleccionado.id}/recargar`, { monto: n, empleado_id: 1, descripcion: 'Recarga desde admin' })
      setAlumnos(prev => prev.map(a => a.id === seleccionado.id ? res.data : a))
      const tRes = await api.get('/transacciones')
      setTxs(tRes.data)
      showMsg('ok', `Recarga de ${fmt(n)} aplicada`)
      cerrarModal()
    } catch (err) { showMsg('error', 'Error al recargar') }
  }

  const historialAlumno = seleccionado ? txs.filter(t => t.alumno_id === seleccionado.id) : []

  if (cargando) return <div style={{ color: '#999' }}>Cargando...</div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: '0 0 4px' }}>Alumnos</h1>
          <p style={{ color: '#999', fontSize: 13, margin: 0 }}>{alumnos.length} alumnos registrados</p>
        </div>
        <Btn onClick={abrirNuevo}>+ Nuevo alumno</Btn>
      </div>

      {msg && <div style={{ padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16, background: msg.tipo === 'ok' ? '#F0FDF4' : '#FEF2F2', color: msg.tipo === 'ok' ? '#16A34A' : '#DC2626' }}>{msg.texto}</div>}

      {/* filtros */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <input placeholder="Buscar alumno..." value={busq} onChange={e => setBusq(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
        <select value={filtroCurso} onChange={e => setFiltroCurso(e.target.value)} style={{ minWidth: 140 }}>
          {cursos.map(c => <option key={c}>{c}</option>)}
        </select>
      </div>

      {/* tabla */}
      <div style={{ background: 'white', borderRadius: 12, border: '1px solid #F0F0F0', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #F0F0F0' }}>
                {['Alumno', 'Curso', 'Saldo', 'Límite diario', 'Estado', 'Acciones'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#999', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtrados.map(a => (
                <tr key={a.id} style={{ borderBottom: '1px solid #F8F9FA' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 10, background: '#F8F9FA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: '#666', flexShrink: 0 }}>
                        {a.nombre.split(' ').slice(0, 2).map(n => n[0]).join('')}
                      </div>
                      <div>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 500 }}>{a.nombre}</p>
                        <p style={{ margin: 0, fontSize: 11, color: '#999' }}>{a.tutor}{a.alergias !== 'Ninguna' && <span style={{ color: '#D97706', marginLeft: 6 }}>⚠ {a.alergias}</span>}</p>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: '#666' }}>{a.curso}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: parseFloat(a.saldo) < 200 ? '#DC2626' : '#111' }}>{fmt(a.saldo)}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: '#666' }}>{fmt(a.limite_diario)}/día</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontSize: 11, fontWeight: 500, padding: '3px 8px', borderRadius: 6, background: a.activo ? '#F0FDF4' : '#FEF2F2', color: a.activo ? '#16A34A' : '#DC2626' }}>
                      {a.activo ? 'Activa' : 'Bloqueada'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {[
                        { label: 'Historial', onClick: () => abrirHistorial(a), color: '#F8F9FA', textColor: '#111' },
                        { label: 'Recargar', onClick: () => abrirRecargar(a), color: '#F0FDF4', textColor: '#16A34A' },
                        { label: 'Editar', onClick: () => abrirEditar(a), color: '#F8F9FA', textColor: '#111' },
                        { label: a.activo ? 'Bloquear' : 'Activar', onClick: () => toggleBloqueo(a), color: a.activo ? '#FEF2F2' : '#F0FDF4', textColor: a.activo ? '#DC2626' : '#16A34A' },
                        { label: '×', onClick: () => eliminar(a.id), color: '#FEF2F2', textColor: '#DC2626' },
                      ].map(b => (
                        <button key={b.label} onClick={b.onClick} style={{ padding: '4px 10px', border: 'none', borderRadius: 6, background: b.color, color: b.textColor, fontSize: 12, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' }}>{b.label}</button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtrados.length === 0 && <p style={{ padding: '2rem', textAlign: 'center', color: '#999', fontSize: 13 }}>Sin resultados</p>}
      </div>

      {/* modal nuevo/editar */}
      {(modal === 'nuevo' || modal === 'editar') && (
        <Modal title={modal === 'nuevo' ? 'Nuevo alumno' : 'Editar alumno'} onClose={cerrarModal}>
          {[['Nombre completo', 'nombre', 'text'], ['Curso (ej: 4to A)', 'curso', 'text'], ['Saldo inicial', 'saldo', 'number'], ['Límite diario', 'limite_diario', 'number'], ['Tutor/Padre', 'tutor', 'text'], ['Teléfono tutor', 'tutor_tel', 'text'], ['Alergias', 'alergias', 'text']].map(([label, key, type]) => (
            <Campo key={key} label={label}>
              <input type={type} value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} style={{ width: '100%' }} />
            </Campo>
          ))}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <button onClick={cerrarModal} style={{ padding: '8px 16px', border: '1px solid #F0F0F0', borderRadius: 8, background: 'white', fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
            <Btn onClick={modal === 'nuevo' ? guardarNuevo : guardarEditar}>{modal === 'nuevo' ? 'Registrar' : 'Guardar'}</Btn>
          </div>
        </Modal>
      )}

      {/* modal historial */}
      {modal === 'historial' && seleccionado && (
        <Modal title={`Historial — ${seleccionado.nombre}`} onClose={cerrarModal}>
          <div style={{ marginBottom: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div style={{ background: '#F8F9FA', borderRadius: 8, padding: '10px 12px' }}>
              <p style={{ margin: '0 0 2px', fontSize: 11, color: '#999' }}>Saldo actual</p>
              <p style={{ margin: 0, fontSize: 18, fontWeight: 600, color: parseFloat(seleccionado.saldo) < 200 ? '#DC2626' : '#111' }}>{fmt(seleccionado.saldo)}</p>
            </div>
            <div style={{ background: '#F8F9FA', borderRadius: 8, padding: '10px 12px' }}>
              <p style={{ margin: '0 0 2px', fontSize: 11, color: '#999' }}>Total gastado</p>
              <p style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>{fmt(historialAlumno.filter(t => t.tipo === 'compra').reduce((s, t) => s + parseFloat(t.monto), 0))}</p>
            </div>
          </div>
          {historialAlumno.length === 0 ? <p style={{ color: '#999', fontSize: 13 }}>Sin movimientos</p> : historialAlumno.map(t => (
            <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid #F8F9FA' }}>
              <div>
                <p style={{ margin: 0, fontSize: 13 }}>{t.descripcion}</p>
                <p style={{ margin: 0, fontSize: 11, color: '#999' }}>{new Date(t.fecha).toLocaleString('es-AR')} · {t.lugar}</p>
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: t.tipo === 'recarga' ? '#16A34A' : '#111' }}>
                {t.tipo === 'recarga' ? '+' : '-'}{fmt(t.monto)}
              </span>
            </div>
          ))}
        </Modal>
      )}

      {/* modal recargar */}
      {modal === 'recargar' && seleccionado && (
        <Modal title={`Recargar — ${seleccionado.nombre}`} onClose={cerrarModal}>
          <p style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>Saldo actual: <b style={{ color: '#111' }}>{fmt(seleccionado.saldo)}</b></p>
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            {[200, 500, 1000, 2000].map(n => (
              <button key={n} onClick={() => setMontoRecarga(String(n))} style={{ flex: 1, padding: '8px 4px', border: `1px solid ${montoRecarga == n ? '#111' : '#F0F0F0'}`, borderRadius: 8, background: montoRecarga == n ? '#111' : 'white', color: montoRecarga == n ? 'white' : '#666', fontSize: 12, cursor: 'pointer', fontWeight: montoRecarga == n ? 500 : 400 }}>{fmt(n)}</button>
            ))}
          </div>
          <Campo label="Otro monto">
            <input type="number" placeholder="Ingresá el monto" value={montoRecarga} onChange={e => setMontoRecarga(e.target.value)} style={{ width: '100%' }} />
          </Campo>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={cerrarModal} style={{ padding: '8px 16px', border: '1px solid #F0F0F0', borderRadius: 8, background: 'white', fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
            <Btn onClick={recargar} color="#16A34A">Recargar</Btn>
          </div>
        </Modal>
      )}
    </div>
  )
}