import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useSearchParams } from 'react-router-dom'
import api from '../api/axios'

export default function Cuenta() {
  const { sesion } = useAuth()
  const [searchParams] = useSearchParams()
  const [estado, setEstado] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [conectando, setConectando] = useState(false)
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    const mp = searchParams.get('mp')
    if (mp === 'conectado') setMsg({ tipo: 'ok', texto: 'Cuenta de Mercado Pago conectada correctamente' })
    else if (mp === 'error') setMsg({ tipo: 'error', texto: 'No se pudo conectar Mercado Pago. Probá de nuevo.' })
  }, [searchParams])

  const cargar = async () => {
    try {
      const res = await api.get('/mp/estado')
      setEstado(res.data)
    } catch (err) { console.error(err) }
    finally { setCargando(false) }
  }

  useEffect(() => { cargar() }, [])

  const conectar = async () => {
    setConectando(true)
    try {
      const res = await api.get('/mp/conectar/empleado')
      window.location.href = res.data.url
    } catch (err) {
      setMsg({ tipo: 'error', texto: err.response?.data?.error || 'Error al iniciar la conexión' })
      setConectando(false)
    }
  }

  if (cargando) return <div style={{ padding: '1rem', color: 'var(--text-tertiary)' }}>Cargando...</div>

  return (
    <div style={{ maxWidth: 480 }}>
      <h1 style={{ fontSize: 20, fontWeight: 600, margin: '0 0 4px', color: 'var(--text)' }}>Mi cuenta</h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: '0 0 20px' }}>{sesion?.nombre} · @{sesion?.usuario}</p>

      {msg && (
        <div style={{ padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16, background: msg.tipo === 'ok' ? 'var(--green-bg)' : 'var(--red-bg)', color: msg.tipo === 'ok' ? 'var(--green)' : 'var(--red)', borderLeft: `3px solid ${msg.tipo === 'ok' ? 'var(--green)' : 'var(--red)'}` }}>
          {msg.texto}
        </div>
      )}

      <div style={{ background: 'var(--bg-card)', borderRadius: 16, padding: '1.25rem', border: '1px solid var(--border)', boxShadow: 'var(--shadow)' }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 6px', color: 'var(--text)' }}>Mercado Pago</h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 16px' }}>
          Conectá tu cuenta para recibir directamente lo que vendas cuando se cierre tu turno de caja.
        </p>

        {!estado?.disponible ? (
          <div style={{ padding: '10px 14px', background: 'var(--amber-bg)', color: 'var(--amber)', borderRadius: 8, fontSize: 13, borderLeft: '3px solid var(--amber)' }}>
            Todavía no está habilitada la conexión con Mercado Pago en este colegio.
          </div>
        ) : estado?.empleado_conectado ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'var(--green-bg)', color: 'var(--green)', borderRadius: 8, fontSize: 13, fontWeight: 500 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            Cuenta conectada
          </div>
        ) : (
          <button onClick={conectar} disabled={conectando} style={{ width: '100%', padding: '14px', border: 'none', borderRadius: 12, background: '#009EE3', color: 'white', fontSize: 15, fontWeight: 700, cursor: 'pointer', opacity: conectando ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {conectando ? 'Redirigiendo...' : 'Conectar Mercado Pago'}
          </button>
        )}
      </div>
    </div>
  )
}
