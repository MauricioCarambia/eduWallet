import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api/axios'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)
  const { login } = useAuth()
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
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', background: '#F8F9FA' }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ width: 52, height: 52, borderRadius: 16, background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 4 }}>EduWallet</h1>
          <p style={{ color: '#999', fontSize: 14 }}>Portal de Padres</p>
        </div>

        <div style={{ background: 'white', borderRadius: 20, padding: '1.5rem', border: '1px solid #F0F0F0', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#555', marginBottom: 5 }}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@email.com" onKeyDown={e => e.key === 'Enter' && handleLogin()} autoFocus />
          </div>
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#555', marginBottom: 5 }}>Contraseña</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" onKeyDown={e => e.key === 'Enter' && handleLogin()} />
          </div>
          {error && <p style={{ color: '#DC2626', fontSize: 13, marginBottom: 12 }}>{error}</p>}
          <button onClick={handleLogin} disabled={cargando} style={{ width: '100%', padding: '12px', border: 'none', borderRadius: 10, background: '#111', color: 'white', fontSize: 15, fontWeight: 600, opacity: cargando ? 0.7 : 1 }}>
            {cargando ? 'Ingresando...' : 'Ingresar'}
          </button>
          <p style={{ textAlign: 'center', fontSize: 13, color: '#666', marginTop: 14 }}>
            ¿No tenés cuenta? <Link to="/registro" style={{ color: '#111', fontWeight: 500 }}>Registrate</Link>
          </p>
        </div>
      </div>
    </div>
  )
}