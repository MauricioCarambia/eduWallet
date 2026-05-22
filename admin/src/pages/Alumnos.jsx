import { useState, useEffect } from 'react'
import api from '../api/axios'

const fmt = n => `$${Number(n).toLocaleString('es-AR')}`

function Modal({ title, onClose, children }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
      <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto', border: '1.5px solid var(--border)', boxShadow: 'var(--shadow-md)' }}>
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

function Btn({ onClick, color = '#1E3A5F', children, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{ padding: '8px 18px', border: 'none', borderRadius: 'var(--radius)', background: color, color: 'white', fontSize: 13, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1 }}>
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
  const [modal, setModal] = useState(null)
  const [seleccionado, setSeleccionado] = useState(null)
  const [form, setForm] = useState(FORM_VACIO)
  const [montoRecarga, setMontoRecarga] = useState('')
  const [msg, setMsg] = useState(null)
  const [qrModal, setQrModal] = useState(null)

  const showMsg = (tipo, texto) => { setMsg({ tipo, texto }); setTimeout(() => setMsg(null), 3000) }

  useEffect(() => { cargar() }, [])

  const cargar = async () => {
    try {
      const [aRes, tRes] = await Promise.all([api.get('/alumnos'), api.get('/transacciones')])
      setAlumnos(aRes.data); setTxs(tRes.data)
    } catch (err) { console.error(err) }
    finally { setCargando(false) }
  }

  const cursos = ['Todos', ...new Set(alumnos.map(a => a.curso))]
  const filtrados = alumnos.filter(a =>
    (a.nombre.toLowerCase().includes(busq.toLowerCase()) || a.id.toString().includes(busq)) &&
    (filtroCurso === 'Todos' || a.curso === filtroCurso)
  )

  const cerrarModal = () => { setModal(null); setSeleccionado(null) }

  const guardarNuevo = async () => {
    if (!form.nombre || !form.curso) return
    try {
      const res = await api.post('/alumnos', form)
      setAlumnos(p => [...p, res.data])
      showMsg('ok', `Alumno ${form.nombre} registrado`)
      cerrarModal()
    } catch { showMsg('error', 'Error al registrar') }
  }

  const guardarEditar = async () => {
    try {
      const res = await api.put(`/alumnos/${seleccionado.id}`, form)
      setAlumnos(p => p.map(a => a.id === seleccionado.id ? res.data : a))
      showMsg('ok', 'Alumno actualizado'); cerrarModal()
    } catch { showMsg('error', 'Error al actualizar') }
  }

  const eliminar = async id => {
    if (!confirm('¿Eliminar este alumno?')) return
    try {
      await api.delete(`/alumnos/${id}`)
      setAlumnos(p => p.filter(a => a.id !== id))
      showMsg('ok', 'Alumno eliminado')
    } catch { showMsg('error', 'Error al eliminar') }
  }

  const toggleBloqueo = async a => {
    try {
      const res = await api.patch(`/alumnos/${a.id}/toggle`)
      setAlumnos(p => p.map(x => x.id === a.id ? res.data : x))
    } catch { showMsg('error', 'Error') }
  }

  const recargar = async () => {
    const n = parseInt(montoRecarga); if (!n || n <= 0) return
    try {
      const res = await api.post(`/alumnos/${seleccionado.id}/recargar`, { monto: n, empleado_id: 1, descripcion: 'Recarga desde admin' })
      setAlumnos(p => p.map(a => a.id === seleccionado.id ? res.data : a))
      const tRes = await api.get('/transacciones'); setTxs(tRes.data)
      showMsg('ok', `Recarga de ${fmt(n)} aplicada`); cerrarModal()
    } catch { showMsg('error', 'Error al recargar') }
  }

  const verQR = async alumno => {
    try {
      const res = await api.get(`/alumnos/${alumno.id}/qr`)
      setQrModal({ alumno, qr: res.data.qr, codigo: res.data.codigo })
    } catch { showMsg('error', 'Error al obtener QR') }
  }

  const historialAlumno = seleccionado ? txs.filter(t => t.alumno_id === seleccionado.id) : []

  if (cargando) return <div style={{ color: 'var(--text-tertiary)' }}>Cargando...</div>

  const btnStyle = (color, textColor) => ({ padding: '4px 10px', border: 'none', borderRadius: 6, background: color, color: textColor, fontSize: 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' })

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 4px', color: 'var(--text)' }}>Alumnos</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: 0 }}>{alumnos.length} alumnos registrados</p>
        </div>
        <Btn onClick={() => { setForm(FORM_VACIO); setModal('nuevo') }}>+ Nuevo alumno</Btn>
      </div>

      {msg && <div style={{ padding: '10px 14px', borderRadius: 'var(--radius)', fontSize: 13, marginBottom: 16, background: msg.tipo === 'ok' ? 'var(--green-bg)' : 'var(--red-bg)', color: msg.tipo === 'ok' ? 'var(--green)' : 'var(--red)', borderLeft: `3px solid ${msg.tipo === 'ok' ? 'var(--green)' : 'var(--red)'}` }}>{msg.texto}</div>}

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <input placeholder="Buscar alumno..." value={busq} onChange={e => setBusq(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
        <select value={filtroCurso} onChange={e => setFiltroCurso(e.target.value)} style={{ minWidth: 140 }}>
          {cursos.map(c => <option key={c}>{c}</option>)}
        </select>
      </div>

      <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1.5px solid var(--border)', overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1.5px solid var(--border)', background: 'var(--bg)' }}>
                {['Alumno', 'Curso', 'Saldo', 'Límite diario', 'Estado', 'Acciones'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.5px', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtrados.map((a, idx) => (
                <tr key={a.id} style={{ borderBottom: idx < filtrados.length - 1 ? '1px solid var(--border-light)' : 'none' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--bg)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', flexShrink: 0 }}>
                        {a.nombre.split(' ').slice(0, 2).map(n => n[0]).join('')}
                      </div>
                      <div>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{a.nombre}</p>
                        <p style={{ margin: 0, fontSize: 11, color: 'var(--text-tertiary)' }}>
                          {a.tutor}{a.alergias !== 'Ninguna' && <span style={{ color: 'var(--amber)', marginLeft: 6 }}>⚠ {a.alergias}</span>}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-secondary)' }}>{a.curso}</td>
                  <td style={{ padding: '12px 16px', fontSize: 14, fontWeight: 700, color: parseFloat(a.saldo) < 200 ? 'var(--red)' : 'var(--green)' }}>{fmt(a.saldo)}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-secondary)' }}>{fmt(a.limite_diario)}/día</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 6, background: a.activo ? 'var(--green-bg)' : 'var(--red-bg)', color: a.activo ? 'var(--green)' : 'var(--red)' }}>
                      {a.activo ? 'Activa' : 'Bloqueada'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      <button onClick={() => { setSeleccionado(a); setModal('historial') }} style={btnStyle('var(--bg)', 'var(--text)')}>Historial</button>
                      <button onClick={() => { setSeleccionado(a); setMontoRecarga(''); setModal('recargar') }} style={btnStyle('var(--green-bg)', 'var(--green)')}>Recargar</button>
                      <button onClick={() => { setSeleccionado(a); setForm({ nombre: a.nombre, curso: a.curso, saldo: a.saldo, limite_diario: a.limite_diario, tutor: a.tutor || '', tutor_tel: a.tutor_tel || '', alergias: a.alergias || 'Ninguna' }); setModal('editar') }} style={btnStyle('var(--bg)', 'var(--text)')}>Editar</button>
                      <button onClick={() => verQR(a)} style={btnStyle('var(--brand-light)', 'var(--accent)')}>QR</button>
                      <button onClick={() => toggleBloqueo(a)} style={btnStyle(a.activo ? 'var(--red-bg)' : 'var(--green-bg)', a.activo ? 'var(--red)' : 'var(--green)')}>{a.activo ? 'Bloquear' : 'Activar'}</button>
                      <button onClick={() => eliminar(a.id)} style={btnStyle('var(--red-bg)', 'var(--red)')}>×</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtrados.length === 0 && <p style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>Sin resultados</p>}
      </div>

      {(modal === 'nuevo' || modal === 'editar') && (
        <Modal title={modal === 'nuevo' ? 'Nuevo alumno' : 'Editar alumno'} onClose={cerrarModal}>
          {[['Nombre completo', 'nombre', 'text'], ['Curso', 'curso', 'text'], ['Saldo inicial', 'saldo', 'number'], ['Límite diario', 'limite_diario', 'number'], ['Tutor', 'tutor', 'text'], ['Teléfono', 'tutor_tel', 'text'], ['Alergias', 'alergias', 'text']].map(([label, key, type]) => (
            <Campo key={key} label={label}>
              <input type={type} value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} />
            </Campo>
          ))}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <button onClick={cerrarModal} style={{ padding: '8px 16px', border: '1.5px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--bg-card)', fontSize: 13, cursor: 'pointer', color: 'var(--text-secondary)' }}>Cancelar</button>
            <Btn onClick={modal === 'nuevo' ? guardarNuevo : guardarEditar}>{modal === 'nuevo' ? 'Registrar' : 'Guardar'}</Btn>
          </div>
        </Modal>
      )}

      {modal === 'historial' && seleccionado && (
        <Modal title={`Historial — ${seleccionado.nombre}`} onClose={cerrarModal}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
            {[['Saldo actual', fmt(seleccionado.saldo), parseFloat(seleccionado.saldo) < 200 ? 'var(--red)' : 'var(--green)'],
              ['Total gastado', fmt(historialAlumno.filter(t => t.tipo === 'compra').reduce((s, t) => s + parseFloat(t.monto), 0)), 'var(--text)']
            ].map(([label, value, color]) => (
              <div key={label} style={{ background: 'var(--bg)', borderRadius: 'var(--radius)', padding: '10px 12px', border: '1px solid var(--border)' }}>
                <p style={{ margin: '0 0 2px', fontSize: 11, color: 'var(--text-secondary)' }}>{label}</p>
                <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color }}>{value}</p>
              </div>
            ))}
          </div>
          {historialAlumno.length === 0 ? <p style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>Sin movimientos</p> :
            historialAlumno.map(t => (
              <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid var(--border-light)' }}>
                <div>
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--text)' }}>{t.descripcion}</p>
                  <p style={{ margin: 0, fontSize: 11, color: 'var(--text-tertiary)' }}>{new Date(t.fecha).toLocaleString('es-AR')} · {t.lugar}</p>
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: t.tipo === 'recarga' ? 'var(--green)' : 'var(--text)' }}>
                  {t.tipo === 'recarga' ? '+' : '-'}{fmt(t.monto)}
                </span>
              </div>
            ))}
        </Modal>
      )}

      {modal === 'recargar' && seleccionado && (
        <Modal title={`Recargar — ${seleccionado.nombre}`} onClose={cerrarModal}>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14 }}>Saldo actual: <b style={{ color: 'var(--text)' }}>{fmt(seleccionado.saldo)}</b></p>
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            {[200, 500, 1000, 2000].map(n => (
              <button key={n} onClick={() => setMontoRecarga(String(n))} style={{ flex: 1, padding: '8px 4px', border: `1.5px solid ${montoRecarga == n ? '#1E3A5F' : 'var(--border)'}`, borderRadius: 'var(--radius)', background: montoRecarga == n ? '#1E3A5F' : 'var(--bg-card)', color: montoRecarga == n ? 'white' : 'var(--text-secondary)', fontSize: 12, cursor: 'pointer', fontWeight: montoRecarga == n ? 600 : 400 }}>{fmt(n)}</button>
            ))}
          </div>
          <Campo label="Otro monto">
            <input type="number" placeholder="Ingresá el monto" value={montoRecarga} onChange={e => setMontoRecarga(e.target.value)} />
          </Campo>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={cerrarModal} style={{ padding: '8px 16px', border: '1.5px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--bg-card)', fontSize: 13, cursor: 'pointer', color: 'var(--text-secondary)' }}>Cancelar</button>
            <Btn onClick={recargar} color="var(--green)">Recargar</Btn>
          </div>
        </Modal>
      )}

      {qrModal && (
        <Modal title={`QR — ${qrModal.alumno.nombre}`} onClose={() => setQrModal(null)}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ display: 'inline-block', padding: 16, background: 'white', borderRadius: 'var(--radius-lg)', border: '1.5px solid var(--border)', marginBottom: 12 }}>
              <img src={qrModal.qr} alt="QR" style={{ width: 200, height: 200, display: 'block' }} />
            </div>
            <p style={{ margin: '0 0 4px', fontSize: 13, color: 'var(--text-secondary)' }}>Código: <b style={{ color: 'var(--text)' }}>{qrModal.codigo}</b></p>
            <p style={{ margin: '0 0 16px', fontSize: 12, color: 'var(--text-tertiary)' }}>{qrModal.alumno.curso}</p>
            <Btn onClick={() => { const a = document.createElement('a'); a.href = qrModal.qr; a.download = `QR-${qrModal.alumno.nombre}.png`; a.click() }}>Descargar QR</Btn>
          </div>
        </Modal>
      )}
    </div>
  )
}