import { useState, useEffect } from 'react'
import api from '../api/axios'
import { SkeletonTable } from '../components/Skeleton'

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
const CSV_COLUMNAS = ['nombre', 'curso', 'saldo', 'limite_diario', 'tutor', 'tutor_tel', 'alergias']
const CSV_PLANTILLA = 'nombre,curso,saldo,limite_diario,tutor,tutor_tel,alergias\nJuan Pérez,1A,500,1000,María Pérez,11-1234-5678,Ninguna\nAna García,2B,0,500,Carlos García,,Maní'

const parsearCSV = (texto) => {
  const lineas = texto.trim().split('\n').filter(l => l.trim())
  if (lineas.length < 2) return { filas: [], errores: ['El archivo debe tener encabezado y al menos una fila de datos'] }

  const encabezado = lineas[0].split(',').map(c => c.trim().toLowerCase())
  const errores = []
  const filas = []

  for (let i = 1; i < lineas.length; i++) {
    const valores = lineas[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''))
    const fila = {}
    CSV_COLUMNAS.forEach((col, idx) => { fila[col] = valores[idx] || '' })
    if (!fila.nombre) { errores.push(`Fila ${i + 1}: nombre vacío`); continue }
    if (!fila.curso)  { errores.push(`Fila ${i + 1}: curso vacío`); continue }
    filas.push(fila)
  }

  return { filas, errores }
}

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
  // importación
  const [csvFilas, setCsvFilas] = useState([])
  const [csvErrores, setCsvErrores] = useState([])
  const [importando, setImportando] = useState(false)
  const [importResult, setImportResult] = useState(null)

  const showMsg = (tipo, texto) => { setMsg({ tipo, texto }); setTimeout(() => setMsg(null), 3000) }

  useEffect(() => { cargar() }, [])

  const cargar = async () => {
    try {
      const [aRes, tRes] = await Promise.all([api.get('/alumnos'), api.get('/transacciones')])
      setAlumnos(aRes.data); setTxs(tRes.data.data ?? tRes.data)
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

  const regenerarCodigo = async () => {
    if (!confirm('¿Regenerar el código de vinculación? El código anterior dejará de funcionar.')) return
    try {
      const res = await api.patch(`/alumnos/${seleccionado.id}/codigo-vinculacion`)
      setAlumnos(p => p.map(a => a.id === seleccionado.id ? res.data : a))
      setSeleccionado(res.data)
      showMsg('ok', 'Código regenerado')
    } catch { showMsg('error', 'Error al regenerar el código') }
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
      const tRes = await api.get('/transacciones'); setTxs(tRes.data.data ?? tRes.data)
      showMsg('ok', `Recarga de ${fmt(n)} aplicada`); cerrarModal()
    } catch { showMsg('error', 'Error al recargar') }
  }

  const verQR = async alumno => {
    try {
      const res = await api.get(`/alumnos/${alumno.id}/qr`)
      setQrModal({ alumno, qr: res.data.qr, codigo: res.data.codigo })
    } catch { showMsg('error', 'Error al obtener QR') }
  }

  const onArchivoCSV = (e) => {
    const archivo = e.target.files[0]
    if (!archivo) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const { filas, errores } = parsearCSV(ev.target.result)
      setCsvFilas(filas)
      setCsvErrores(errores)
      setImportResult(null)
    }
    reader.readAsText(archivo, 'UTF-8')
    e.target.value = ''
  }

  const descargarPlantilla = () => {
    const blob = new Blob(['﻿' + CSV_PLANTILLA], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'plantilla_alumnos.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const confirmarImportacion = async () => {
    if (!csvFilas.length) return
    setImportando(true)
    try {
      const res = await api.post('/alumnos/importar', { filas: csvFilas })
      setImportResult(res.data)
      if (res.data.creados > 0) {
        const aRes = await api.get('/alumnos')
        setAlumnos(aRes.data)
        showMsg('ok', `${res.data.creados} alumnos importados correctamente`)
      }
      setCsvFilas([])
    } catch { showMsg('error', 'Error al importar') }
    finally { setImportando(false) }
  }

  const cerrarImportacion = () => { setModal(null); setCsvFilas([]); setCsvErrores([]); setImportResult(null) }

  const historialAlumno = seleccionado ? txs.filter(t => t.alumno_id === seleccionado.id) : []

  if (cargando) return <SkeletonTable rows={8} cols={5} />

  const btnStyle = (color, textColor) => ({ padding: '4px 10px', border: 'none', borderRadius: 6, background: color, color: textColor, fontSize: 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' })

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 4px', color: 'var(--text)' }}>Alumnos</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: 0 }}>{alumnos.length} alumnos registrados</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => { setCsvFilas([]); setCsvErrores([]); setImportResult(null); setModal('importar') }} style={{ padding: '8px 16px', border: '1.5px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--bg-card)', fontSize: 13, fontWeight: 500, cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            Importar CSV
          </button>
          <Btn onClick={() => { setForm(FORM_VACIO); setModal('nuevo') }}>+ Nuevo alumno</Btn>
        </div>
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
          {modal === 'editar' && seleccionado && (
            <Campo label="Código de vinculación">
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="text" readOnly value={seleccionado.codigo_vinculacion || ''} style={{ fontFamily: 'monospace', letterSpacing: 1, fontWeight: 600 }} />
                <button onClick={regenerarCodigo} style={{ padding: '8px 12px', border: '1.5px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--bg-card)', fontSize: 12, cursor: 'pointer', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Regenerar</button>
              </div>
              <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--text-tertiary)' }}>Compartí este código con la familia para vincular su cuenta a este alumno.</p>
            </Campo>
          )}
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

      {modal === 'importar' && (
        <Modal title="Importar alumnos desde CSV" onClose={cerrarImportacion}>
          {/* Instrucciones y plantilla */}
          <div style={{ background: 'var(--bg)', borderRadius: 'var(--radius)', padding: '12px 14px', marginBottom: 16, border: '1px solid var(--border)' }}>
            <p style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Formato requerido</p>
            <p style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--text-secondary)' }}>El CSV debe tener estos encabezados en la primera fila:</p>
            <code style={{ fontSize: 11, color: 'var(--accent)', background: 'var(--bg-card)', padding: '4px 8px', borderRadius: 4, display: 'block', marginBottom: 10 }}>
              nombre, curso, saldo, limite_diario, tutor, tutor_tel, alergias
            </code>
            <button onClick={descargarPlantilla} style={{ fontSize: 12, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
              Descargar plantilla de ejemplo
            </button>
          </div>

          {/* Upload */}
          {!importResult && (
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.5px' }}>Seleccioná el archivo CSV</label>
              <input type="file" accept=".csv,text/csv" onChange={onArchivoCSV} style={{ fontSize: 13 }} />
            </div>
          )}

          {/* Errores de parseo */}
          {csvErrores.length > 0 && (
            <div style={{ background: 'var(--red-bg)', borderRadius: 'var(--radius)', padding: '10px 14px', marginBottom: 14, borderLeft: '3px solid var(--red)' }}>
              <p style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 600, color: 'var(--red)' }}>Errores en el archivo ({csvErrores.length})</p>
              {csvErrores.map((e, i) => <p key={i} style={{ margin: '2px 0', fontSize: 12, color: 'var(--red)' }}>• {e}</p>)}
            </div>
          )}

          {/* Preview */}
          {csvFilas.length > 0 && !importResult && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{csvFilas.length} alumnos listos para importar</p>
                {csvFilas.length > 5 && <p style={{ margin: 0, fontSize: 11, color: 'var(--text-tertiary)' }}>Mostrando primeros 5</p>}
              </div>
              <div style={{ background: 'var(--bg)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', overflow: 'hidden', marginBottom: 16 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-card)' }}>
                      {['Nombre', 'Curso', 'Saldo', 'Límite/día', 'Tutor'].map(h => (
                        <th key={h} style={{ padding: '7px 10px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {csvFilas.slice(0, 5).map((f, i) => (
                      <tr key={i} style={{ borderBottom: i < 4 && i < csvFilas.length - 1 ? '1px solid var(--border-light)' : 'none' }}>
                        <td style={{ padding: '7px 10px', color: 'var(--text)', fontWeight: 500 }}>{f.nombre}</td>
                        <td style={{ padding: '7px 10px', color: 'var(--text-secondary)' }}>{f.curso}</td>
                        <td style={{ padding: '7px 10px', color: 'var(--text-secondary)' }}>${f.saldo || 0}</td>
                        <td style={{ padding: '7px 10px', color: 'var(--text-secondary)' }}>${f.limite_diario || 500}</td>
                        <td style={{ padding: '7px 10px', color: 'var(--text-secondary)' }}>{f.tutor || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* Resultado */}
          {importResult && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ background: 'var(--green-bg)', borderRadius: 'var(--radius)', padding: '12px 14px', marginBottom: importResult.errores > 0 ? 10 : 0, borderLeft: '3px solid var(--green)' }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--green)' }}>✓ {importResult.creados} alumnos importados correctamente</p>
              </div>
              {importResult.errores > 0 && (
                <div style={{ background: 'var(--red-bg)', borderRadius: 'var(--radius)', padding: '10px 14px', borderLeft: '3px solid var(--red)' }}>
                  <p style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 600, color: 'var(--red)' }}>⚠ {importResult.errores} filas con errores</p>
                  {importResult.detalle_errores.map((e, i) => (
                    <p key={i} style={{ margin: '2px 0', fontSize: 12, color: 'var(--red)' }}>• Fila {e.fila}: {e.error}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={cerrarImportacion} style={{ padding: '8px 16px', border: '1.5px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--bg-card)', fontSize: 13, cursor: 'pointer', color: 'var(--text-secondary)' }}>
              {importResult ? 'Cerrar' : 'Cancelar'}
            </button>
            {csvFilas.length > 0 && !importResult && (
              <Btn onClick={confirmarImportacion} disabled={importando}>
                {importando ? 'Importando...' : `Importar ${csvFilas.length} alumnos`}
              </Btn>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}