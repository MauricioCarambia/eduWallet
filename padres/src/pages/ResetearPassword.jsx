import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useTheme } from '../context/ThemeContext'
import api from '../api/axios'

export default function ResetearPassword() {
  const [params]                  = useSearchParams()
  const token                     = params.get('token')
  const [password, setPassword]   = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [estado, setEstado]       = useState('idle') // idle | cargando | ok | error | token_invalido
  const [mensaje, setMensaje]     = useState('')
  const { dark, toggle }          = useTheme()
  const navigate                  = useNavigate()

  useEffect(() => {
    if (!token) setEstado('token_invalido')
  }, [token])

  const handleSubmit = async () => {
    if (!password || !confirmar) return
    if (password.length < 6) { setMensaje('La contraseña debe tener al menos 6 caracteres'); return }
    if (password !== confirmar) { setMensaje('Las contraseñas no coinciden'); return }

    setEstado('cargando')
    setMensaje('')
    try {
      const res = await api.post('/padres/resetear-password', { token, nuevaPassword: password })
      setMensaje(res.data.mensaje)
      setEstado('ok')
      setTimeout(() => navigate('/'), 3000)
    } catch (err) {
      setMensaje(err.response?.data?.error || 'Error al restablecer la contraseña')
      setEstado('error')
    }
  }

  if (estado === 'token_invalido') {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
        <div style={{ width: '100%', maxWidth: 380, background: 'var(--bg-card)', borderRadius: 16, padding: '2rem', border: '1.5px solid var(--border)', textAlign: 'center' }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--red-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </div>
          <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', margin: '0 0 8px' }}>Enlace inválido</p>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 20px' }}>Este enlace de recuperación es inválido o ya expiró.</p>
          <Link to="/olvide-password" style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}>Solicitar un nuevo enlace</Link>
        </div>
      </div>
    )
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
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Nueva contraseña</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Ingresá tu nueva contraseña</p>
        </div>

        <div style={{ background: 'var(--bg-card)', borderRadius: 16, padding: '1.5rem', border: '1.5px solid var(--border)', boxShadow: 'var(--shadow-md)' }}>
          {estado === 'ok' ? (
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--green-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <p style={{ fontSize: 14, color: 'var(--text)', fontWeight: 600, margin: '0 0 8px' }}>¡Contraseña actualizada!</p>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 4px' }}>{mensaje}</p>
              <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: 0 }}>Redirigiendo al inicio de sesión...</p>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.5px' }}>Nueva contraseña</label>
                <input type="password" value={password} onChange={e => { setPassword(e.target.value); setMensaje('') }} placeholder="Mínimo 6 caracteres" autoFocus />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.5px' }}>Confirmar contraseña</label>
                <input type="password" value={confirmar} onChange={e => { setConfirmar(e.target.value); setMensaje('') }} placeholder="Repetí la contraseña" onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
              </div>

              {mensaje && (
                <div style={{ padding: '10px 14px', background: estado === 'error' ? 'var(--red-bg)' : 'var(--amber-bg)', color: estado === 'error' ? 'var(--red)' : 'var(--amber)', borderRadius: 8, fontSize: 13, marginBottom: 16, borderLeft: `3px solid ${estado === 'error' ? 'var(--red)' : 'var(--amber)'}` }}>
                  {mensaje}
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={estado === 'cargando' || !password || !confirmar}
                style={{ width: '100%', padding: '12px', border: 'none', borderRadius: 10, background: 'var(--brand)', color: 'white', fontSize: 15, fontWeight: 600, opacity: (estado === 'cargando' || !password || !confirmar) ? 0.7 : 1, cursor: (estado === 'cargando' || !password || !confirmar) ? 'not-allowed' : 'pointer', marginBottom: 14 }}
              >
                {estado === 'cargando' ? 'Guardando...' : 'Guardar contraseña'}
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
