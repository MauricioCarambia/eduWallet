import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import api from '../api/axios'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)
  const { login } = useAuth()
  const { dark, toggle } = useTheme()
  const navigate = useNavigate()

  const handleLogin = async () => {
    if (!email || !password) return
    setCargando(true); setError('')
    try {
      const res = await api.post('/padres/login', { email, password })
      login(res.data.padre, res.data.token)
      navigate('/inicio')
    } catch (err) {
      setError(err.response?.data?.error || 'Error al iniciar sesión')
    } finally {
      setCargando(false)
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
          <div style={{ width: 56, height: 56, borderRadius: 16, background: '#1E3A5F', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', boxShadow: '0 4px 14px rgba(30,58,95,0.3)' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>EduWallet</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Portal de Padres</p>
        </div>

        <div style={{ background: 'var(--bg-card)', borderRadius: 16, padding: '1.5rem', border: '1.5px solid var(--border)', boxShadow: 'var(--shadow-md)' }}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.5px' }}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@email.com" onKeyDown={e => e.key === 'Enter' && handleLogin()} autoFocus />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.5px' }}>Contraseña</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" onKeyDown={e => e.key === 'Enter' && handleLogin()} />
          </div>
          {error && <div style={{ padding: '10px 14px', background: 'var(--red-bg)', color: 'var(--red)', borderRadius: 8, fontSize: 13, marginBottom: 16, borderLeft: '3px solid var(--red)' }}>{error}</div>}
          <button onClick={handleLogin} disabled={cargando} style={{ width: '100%', padding: '12px', border: 'none', borderRadius: 10, background: '#1E3A5F', color: 'white', fontSize: 15, fontWeight: 600, opacity: cargando ? 0.7 : 1, boxShadow: '0 2px 8px rgba(30,58,95,0.3)', marginBottom: 14 }}>
            {cargando ? 'Ingresando...' : 'Ingresar'}
          </button>
          <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
            ¿No tenés cuenta? <Link to="/registro" style={{ color: '#1E3A5F', fontWeight: 600, textDecoration: 'none' }}>Registrate</Link>
          </p>
        </div>
      </div>
    </div>
  )
}