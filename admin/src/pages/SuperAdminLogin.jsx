import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSuperAdmin } from '../context/SuperAdminContext'
import superadminApi from '../api/axiosSuperadmin'

export default function SuperAdminLogin() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)
  const { login } = useSuperAdmin()
  const navigate = useNavigate()

  const handleLogin = async () => {
    if (!password) return
    setCargando(true); setError('')
    try {
      const res = await superadminApi.post('/superadmin/login', { password })
      login(res.data.token)
      navigate('/superadmin/dashboard')
    } catch (err) {
      setError(err.response?.data?.error || 'Error al iniciar sesión')
    } finally {
      setCargando(false)
    }
  }

  return (
    <div data-theme="dark" style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ color: 'var(--on-accent)' }} strokeWidth="2"><path d="M12 2l3 6 6 1-4.5 4.5L18 20l-6-3-6 3 1.5-6.5L3 9l6-1z"/></svg>
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>KoleTap</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Panel de plataforma (dueño)</p>
        </div>

        <div style={{ background: 'var(--bg-card)', borderRadius: 16, padding: '1.75rem', border: '1px solid #26322D' }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.5px' }}>Contraseña</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()} autoFocus
            style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #26322D', background: 'var(--bg)', color: 'var(--text)', fontSize: 14, marginBottom: 16 }} />
          {error && <div style={{ padding: '8px 12px', background: 'var(--red-bg)', color: 'var(--red)', borderRadius: 8, fontSize: 12, marginBottom: 14 }}>{error}</div>}
          <button onClick={handleLogin} disabled={cargando} style={{ width: '100%', padding: '11px', border: 'none', borderRadius: 8, background: 'var(--accent)', color: 'var(--bg)', fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: cargando ? 0.7 : 1 }}>
            {cargando ? 'Ingresando...' : 'Ingresar'}
          </button>
        </div>
      </div>
    </div>
  )
}
