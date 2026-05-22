import { useState, useEffect } from 'react'
import api from '../api/axios'

export default function Mensajes() {
  const [padres, setPadres] = useState([])
  const [asunto, setAsunto] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [todos, setTodos] = useState(true)
  const [seleccionados, setSeleccionados] = useState([])
  const [enviando, setEnviando] = useState(false)
  const [msg, setMsg] = useState(null)
  const [cargando, setCargando] = useState(true)

  const showMsg = (tipo, texto) => { setMsg({ tipo, texto }); setTimeout(() => setMsg(null), 4000) }

  useEffect(() => { cargar() }, [])

  const cargar = async () => {
    try {
      const res = await api.get('/admin/padres')
      setPadres(res.data.filter(p => p.activo))
    } catch (err) { console.error(err) }
    finally { setCargando(false) }
  }

  const toggleSeleccionado = email => setSeleccionados(p => p.includes(email) ? p.filter(e => e !== email) : [...p, email])

  const enviar = async () => {
    if (!asunto || !mensaje) { showMsg('error', 'Completá asunto y mensaje'); return }
    if (!todos && seleccionados.length === 0) { showMsg('error', 'Seleccioná al menos un destinatario'); return }
    setEnviando(true)
    try {
      const res = await api.post('/mensajes', { asunto, mensaje, todos, destinatarios: seleccionados })
      showMsg('ok', res.data.mensaje)
      setAsunto(''); setMensaje(''); setSeleccionados([])
    } catch (err) { showMsg('error', err.response?.data?.error || 'Error al enviar') }
    finally { setEnviando(false) }
  }

  if (cargando) return <div style={{ color: 'var(--text-tertiary)' }}>Cargando...</div>

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 4px', color: 'var(--text)' }}>Mensajes</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: 0 }}>Enviá mensajes a los padres del colegio</p>
      </div>

      {msg && <div style={{ padding: '10px 14px', borderRadius: 'var(--radius)', fontSize: 13, marginBottom: 16, background: msg.tipo === 'ok' ? 'var(--green-bg)' : 'var(--red-bg)', color: msg.tipo === 'ok' ? 'var(--green)' : 'var(--red)', borderLeft: `3px solid ${msg.tipo === 'ok' ? 'var(--green)' : 'var(--red)'}` }}>{msg.texto}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16 }}>
        <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: '1.25rem', border: '1.5px solid var(--border)', boxShadow: 'var(--shadow)' }}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.5px' }}>Asunto</label>
            <input value={asunto} onChange={e => setAsunto(e.target.value)} placeholder="Ej: Recordatorio de pago" />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.5px' }}>Mensaje</label>
            <textarea value={mensaje} onChange={e => setMensaje(e.target.value)} placeholder="Escribí el mensaje acá..." rows={8}
              style={{ padding: '10px 14px', border: '1.5px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 14, fontFamily: 'inherit', resize: 'vertical', outline: 'none', background: 'var(--bg-input)', color: 'var(--text)', width: '100%', boxSizing: 'border-box' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: 0 }}>{todos ? `${padres.length} destinatarios` : `${seleccionados.length} seleccionados`}</p>
            <button onClick={enviar} disabled={enviando || !asunto || !mensaje}
              style={{ padding: '10px 24px', border: 'none', borderRadius: 'var(--radius)', background: !asunto || !mensaje ? 'var(--bg)' : '#1E3A5F', color: !asunto || !mensaje ? 'var(--text-tertiary)' : 'white', fontSize: 13, fontWeight: 600, cursor: !asunto || !mensaje ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
              {enviando ? 'Enviando...' : <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>Enviar</>}
            </button>
          </div>
        </div>

        <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: '1.25rem', border: '1.5px solid var(--border)', boxShadow: 'var(--shadow)', height: 'fit-content' }}>
          <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Destinatarios</p>
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            {[['Todos', true], ['Seleccionar', false]].map(([label, val]) => (
              <button key={label} onClick={() => setTodos(val)} style={{ flex: 1, padding: '7px', border: `1.5px solid ${todos === val ? '#1E3A5F' : 'var(--border)'}`, borderRadius: 'var(--radius)', background: todos === val ? '#1E3A5F' : 'var(--bg-card)', color: todos === val ? 'white' : 'var(--text-secondary)', fontSize: 12, fontWeight: todos === val ? 600 : 400, cursor: 'pointer' }}>
                {label}{label === 'Todos' ? ` (${padres.length})` : ''}
              </button>
            ))}
          </div>
          {!todos && (
            <div style={{ maxHeight: 380, overflowY: 'auto' }}>
              {padres.map(p => (
                <div key={p.id} onClick={() => toggleSeleccionado(p.email)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, cursor: 'pointer', background: seleccionados.includes(p.email) ? 'var(--bg)' : 'transparent', marginBottom: 2 }}>
                  <div style={{ width: 18, height: 18, borderRadius: 4, border: `2px solid ${seleccionados.includes(p.email) ? '#1E3A5F' : 'var(--border)'}`, background: seleccionados.includes(p.email) ? '#1E3A5F' : 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {seleccionados.includes(p.email) && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nombre}</p>
                    <p style={{ margin: 0, fontSize: 11, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.email}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          {!todos && seleccionados.length > 0 && (
            <button onClick={() => setSeleccionados([])} style={{ marginTop: 10, width: '100%', padding: '6px', border: '1.5px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--bg-card)', fontSize: 12, color: 'var(--text-tertiary)', cursor: 'pointer' }}>Limpiar selección</button>
          )}
        </div>
      </div>
    </div>
  )
}