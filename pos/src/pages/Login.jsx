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
      login(res.data.empleado, res.data.token)
      navigate('/pos')
    } catch (err) {
      setError(err.response?.data?.error || 'Error al iniciar sesión')
    } finally {
      setCargando(false)
    }
  }

  const agregarPin = n => { if (pin.length < 6) setPin(p => p + n) }
  const borrarPin = () => setPin(p => p.slice(0, -1))

  return (
    <div style={{ minHeight: '100vh', background: '#F8F9FA', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ width: '100%', maxWidth: 360 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M7 15h2M13 15h4"/></svg>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 4 }}>EduWallet POS</h1>
          <p style={{ color: '#999', fontSize: 14 }}>Punto de Venta</p>
        </div>

        <div style={{ background: 'white', borderRadius: 20, padding: '1.5rem', border: '1px solid #F0F0F0', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#555', marginBottom: 6 }}>Usuario</label>
            <input value={usuario} onChange={e => setUsuario(e.target.value)} placeholder="usuario" style={{ width: '100%' }} autoFocus />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#555', marginBottom: 6 }}>PIN</label>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 16 }}>
              {[0,1,2,3].map(i => (
                <div key={i} style={{ width: 14, height: 14, borderRadius: '50%', background: pin.length > i ? '#111' : '#F0F0F0', transition: 'background .2s' }} />
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              {[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map((n, i) => (
                <button key={i} onClick={() => n === '⌫' ? borrarPin() : n !== '' ? agregarPin(String(n)) : null}
                  style={{ padding: '16px', border: '1.5px solid #F0F0F0', borderRadius: 12, background: n === '⌫' ? '#FEF2F2' : 'white', fontSize: n === '⌫' ? 18 : 20, fontWeight: 500, color: n === '⌫' ? '#DC2626' : '#111', opacity: n === '' ? 0 : 1, cursor: n === '' ? 'default' : 'pointer' }}>
                  {n}
                </button>
              ))}
            </div>
          </div>

          {error && <p style={{ color: '#DC2626', fontSize: 13, marginBottom: 12, textAlign: 'center' }}>{error}</p>}

          <button onClick={handleLogin} disabled={cargando || !usuario || !pin}
            style={{ width: '100%', padding: '14px', border: 'none', borderRadius: 12, background: '#111', color: 'white', fontSize: 15, fontWeight: 600, opacity: cargando || !usuario || !pin ? 0.5 : 1 }}>
            {cargando ? 'Ingresando...' : 'Ingresar'}
          </button>
        </div>
      </div>
    </div>
  )
}