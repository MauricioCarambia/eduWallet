import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTheme } from '../context/ThemeContext'
import api from '../api/axios'

export default function OlvidePassword() {
  const [email, setEmail]       = useState('')
  const [estado, setEstado]     = useState('idle') // idle | cargando | enviado | error
  const [mensaje, setMensaje]   = useState('')
  const { dark, toggle }        = useTheme()

  const handleSubmit = async () => {
    if (!email) return
    setEstado('cargando')
    try {
      const res = await api.post('/padres/recuperar', { email })
      setMensaje(res.data.mensaje)
      setEstado('enviado')
    } catch (err) {
      setMensaje(err.response?.data?.error || 'Error al enviar el email')
      setEstado('error')
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', position: 'relative' }}>
      <button onClick={toggle} style={{ position: 'absolute', top: 20, right: 20, width: 36, height: 36, border: '1.5px solid var(--border)', borderRadius: 10, background: 'var(--bg-card)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
        {dark
          ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/></svg>
          : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
        }
      </button>

      <div style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', boxShadow: '0 4px 14px rgba(30,58,95,0.3)' }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Recuperar contraseña</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Te enviamos un enlace a tu email</p>
        </div>

        <div style={{ background: 'var(--bg-card)', borderRadius: 16, padding: '1.5rem', border: '1.5px solid var(--border)', boxShadow: 'var(--shadow-md)' }}>
          {estado === 'enviado' ? (
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--green-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <p style={{ fontSize: 14, color: 'var(--text)', fontWeight: 600, margin: '0 0 8px' }}>Email enviado</p>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 20px' }}>{mensaje}</p>
              <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: '0 0 16px' }}>Revisá tu bandeja de entrada y spam. El enlace expira en 1 hora.</p>
              <Link to="/" style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}>Volver al inicio de sesión</Link>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.5px' }}>Email de tu cuenta</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                  autoFocus
                />
              </div>

              {estado === 'error' && (
                <div style={{ padding: '10px 14px', background: 'var(--red-bg)', color: 'var(--red)', borderRadius: 8, fontSize: 13, marginBottom: 16, borderLeft: '3px solid var(--red)' }}>
                  {mensaje}
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={estado === 'cargando' || !email}
                style={{ width: '100%', padding: '12px', border: 'none', borderRadius: 10, background: 'var(--brand)', color: 'white', fontSize: 15, fontWeight: 600, opacity: (estado === 'cargando' || !email) ? 0.7 : 1, cursor: (estado === 'cargando' || !email) ? 'not-allowed' : 'pointer', marginBottom: 14 }}
              >
                {estado === 'cargando' ? 'Enviando...' : 'Enviar enlace'}
              </button>

              <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
                <Link to="/" style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}>← Volver al inicio de sesión</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
