import { useState, useEffect } from 'react'
import api from '../../../pos/src/api/axios'

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
    } catch (err) {
      console.error(err)
    } finally {
      setCargando(false)
    }
  }

  const toggleSeleccionado = (email) => {
    setSeleccionados(prev =>
      prev.includes(email) ? prev.filter(e => e !== email) : [...prev, email]
    )
  }

  const enviar = async () => {
    if (!asunto || !mensaje) { showMsg('error', 'Completá asunto y mensaje'); return }
    if (!todos && seleccionados.length === 0) { showMsg('error', 'Seleccioná al menos un destinatario'); return }
    setEnviando(true)
    try {
      const res = await api.post('/mensajes', {
        asunto,
        mensaje,
        todos,
        destinatarios: seleccionados
      })
      showMsg('ok', res.data.mensaje)
      setAsunto('')
      setMensaje('')
      setSeleccionados([])
    } catch (err) {
      showMsg('error', err.response?.data?.error || 'Error al enviar')
    } finally {
      setEnviando(false)
    }
  }

  if (cargando) return <div style={{ color: '#999' }}>Cargando...</div>

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, margin: '0 0 4px' }}>Mensajes</h1>
        <p style={{ color: '#999', fontSize: 13, margin: 0 }}>Enviá mensajes a los padres del colegio</p>
      </div>

      {msg && <div style={{ padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16, background: msg.tipo === 'ok' ? '#F0FDF4' : '#FEF2F2', color: msg.tipo === 'ok' ? '#16A34A' : '#DC2626' }}>{msg.texto}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16 }}>
        {/* formulario */}
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ background: 'white', borderRadius: 12, padding: '1.25rem', border: '1px solid #F0F0F0' }}>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#555', marginBottom: 6 }}>Asunto</label>
              <input value={asunto} onChange={e => setAsunto(e.target.value)} placeholder="Ej: Recordatorio de pago" style={{ width: '100%' }} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#555', marginBottom: 6 }}>Mensaje</label>
              <textarea value={mensaje} onChange={e => setMensaje(e.target.value)} placeholder="Escribí el mensaje acá..." rows={8}
                style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #E5E7EB', borderRadius: 10, fontSize: 14, fontFamily: 'inherit', resize: 'vertical', outline: 'none' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p style={{ fontSize: 13, color: '#999', margin: 0 }}>
                {todos ? `${padres.length} destinatarios` : `${seleccionados.length} seleccionados`}
              </p>
              <button onClick={enviar} disabled={enviando || !asunto || !mensaje}
                style={{ padding: '10px 24px', border: 'none', borderRadius: 10, background: !asunto || !mensaje ? '#F0F0F0' : '#111', color: !asunto || !mensaje ? '#999' : 'white', fontSize: 14, fontWeight: 600, cursor: !asunto || !mensaje ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                {enviando ? 'Enviando...' : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                    Enviar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* destinatarios */}
        <div style={{ background: 'white', borderRadius: 12, padding: '1.25rem', border: '1px solid #F0F0F0', height: 'fit-content' }}>
          <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 600 }}>Destinatarios</p>
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            <button onClick={() => setTodos(true)} style={{ flex: 1, padding: '7px', border: `1.5px solid ${todos ? '#111' : '#F0F0F0'}`, borderRadius: 8, background: todos ? '#111' : 'white', color: todos ? 'white' : '#666', fontSize: 12, fontWeight: todos ? 600 : 400, cursor: 'pointer' }}>
              Todos ({padres.length})
            </button>
            <button onClick={() => setTodos(false)} style={{ flex: 1, padding: '7px', border: `1.5px solid ${!todos ? '#111' : '#F0F0F0'}`, borderRadius: 8, background: !todos ? '#111' : 'white', color: !todos ? 'white' : '#666', fontSize: 12, fontWeight: !todos ? 600 : 400, cursor: 'pointer' }}>
              Seleccionar
            </button>
          </div>

          {!todos && (
            <div style={{ maxHeight: 400, overflowY: 'auto' }}>
              {padres.map(p => (
                <div key={p.id} onClick={() => toggleSeleccionado(p.email)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, cursor: 'pointer', background: seleccionados.includes(p.email) ? '#F8F9FA' : 'transparent', marginBottom: 2 }}>
                  <div style={{ width: 18, height: 18, borderRadius: 4, border: `2px solid ${seleccionados.includes(p.email) ? '#111' : '#ddd'}`, background: seleccionados.includes(p.email) ? '#111' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {seleccionados.includes(p.email) && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nombre}</p>
                    <p style={{ margin: 0, fontSize: 11, color: '#999', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.email}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!todos && seleccionados.length > 0 && (
            <button onClick={() => setSeleccionados([])} style={{ marginTop: 10, width: '100%', padding: '6px', border: '1px solid #F0F0F0', borderRadius: 7, background: 'white', fontSize: 12, color: '#999', cursor: 'pointer' }}>
              Limpiar selección
            </button>
          )}
        </div>
      </div>
    </div>
  )
}