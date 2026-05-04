import { useState } from 'react'
import api from '../api/axios'

export default function Login({ onLogin }) {
  const [usuario, setUsuario] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  const handleLogin = async () => {
    if (!usuario || !pin) return
    setCargando(true)
    setError('')
    try {
      const res = await api.post('/empleados/login', { usuario, pin })
      onLogin(res.data.empleado, res.data.token)
    } catch (err) {
      setError(err.response?.data?.error || 'Error al iniciar sesión')
    } finally {
      setCargando(false)
    }
  }

  return (
    <div style={{ fontFamily: 'sans-serif', maxWidth: 340, margin: '4rem auto', padding: '0 1rem' }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ width: 52, height: 52, borderRadius: 14, background: '#185FA5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M7 15h2M13 15h4"/></svg>
        </div>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>EduWallet</h2>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#666' }}>Ingresá con tu usuario y PIN</p>
      </div>

      <div style={{ background: 'white', border: '1px solid #e5e5e5', borderRadius: 12, padding: '1.5rem' }}>
        <div style={{ marginBottom: 12 }}>
          <p style={{ margin: '0 0 4px', fontSize: 13, color: '#555' }}>Usuario</p>
          <input
            value={usuario}
            onChange={e => setUsuario(e.target.value)}
            placeholder="usuario"
            style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14 }}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
          />
        </div>
        <div style={{ marginBottom: 16 }}>
          <p style={{ margin: '0 0 4px', fontSize: 13, color: '#555' }}>PIN</p>
          <input
            type="password"
            value={pin}
            onChange={e => setPin(e.target.value)}
            placeholder="••••"
            style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14 }}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
          />
        </div>
        {error && <p style={{ margin: '0 0 12px', fontSize: 13, color: '#A32D2D' }}>{error}</p>}
        <button
          onClick={handleLogin}
          disabled={cargando}
          style={{ width: '100%', padding: '10px', border: 'none', borderRadius: 8, background: '#185FA5', color: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 500 }}
        >
          {cargando ? 'Ingresando...' : 'Ingresar'}
        </button>
      </div>
    </div>
  )
}