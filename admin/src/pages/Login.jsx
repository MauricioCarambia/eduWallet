import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api/axios'

export default function Login() {
  const [usuario, setUsuario] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleLogin = async () => {
    if (!usuario || !pin) return
    setCargando(true); setError('')
    try {
      const res = await api.post('/empleados/login', { usuario, pin })
      if (res.data.empleado.rol !== 'admin') {
        setError('Acceso restringido a administradores')
        setCargando(false); return
      }
      login(res.data.empleado, res.data.token)
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.error || 'Error al iniciar sesión')
    } finally {
      setCargando(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F8F9FA', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 4 }}>EduWallet</h1>
          <p style={{ color: '#999', fontSize: 13 }}>Panel de Administración</p>
        </div>

        <div style={{ background: 'white', borderRadius: 16, padding: '2rem', border: '1px solid #F0F0F0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#555', marginBottom: 6 }}>Usuario</label>
            <input value={usuario} onChange={e => setUsuario(e.target.value)} placeholder="usuario" style={{ width: '100%' }} onKeyDown={e => e.key === 'Enter' && handleLogin()} autoFocus />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#555', marginBottom: 6 }}>PIN</label>
            <input type="password" value={pin} onChange={e => setPin(e.target.value)} placeholder="••••" style={{ width: '100%' }} onKeyDown={e => e.key === 'Enter' && handleLogin()} />
          </div>
          {error && <p style={{ color: '#E53E3E', fontSize: 13, marginBottom: 14 }}>{error}</p>}
          <button onClick={handleLogin} disabled={cargando} style={{ width: '100%', padding: '10px', border: 'none', borderRadius: 10, background: '#111', color: 'white', fontSize: 14, fontWeight: 500, opacity: cargando ? 0.7 : 1 }}>
            {cargando ? 'Ingresando...' : 'Ingresar'}
          </button>
        </div>
      </div>
    </div>
  )
}