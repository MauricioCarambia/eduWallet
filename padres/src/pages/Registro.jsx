import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api/axios'

export default function Registro() {
  const [form, setForm] = useState({ nombre: '', email: '', password: '', confirmar: '' })
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleRegistro = async () => {
    if (!form.nombre || !form.email || !form.password) { setError('Completá todos los campos'); return }
    if (form.password !== form.confirmar) { setError('Las contraseñas no coinciden'); return }
    if (form.password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres'); return }
    setCargando(true); setError('')
    try {
      const res = await api.post('/padres/registro', { nombre: form.nombre, email: form.email, password: form.password })
      login(res.data.padre, res.data.token)
      navigate('/inicio')
    } catch (err) {
      setError(err.response?.data?.error || 'Error al registrarse')
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
          <p style={{ color: '#999', fontSize: 14 }}>Creá tu cuenta</p>
        </div>

        <div style={{ background: 'white', borderRadius: 20, padding: '1.5rem', border: '1px solid #F0F0F0', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          {[['Nombre completo', 'nombre', 'text', 'Ej: María García'], ['Email', 'email', 'email', 'tu@email.com'], ['Contraseña', 'password', 'password', 'Mínimo 6 caracteres'], ['Confirmar contraseña', 'confirmar', 'password', '••••••••']].map(([label, key, type, ph]) => (
            <div key={key} style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#555', marginBottom: 5 }}>{label}</label>
              <input type={type} value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} placeholder={ph} />
            </div>
          ))}
          {error && <p style={{ color: '#DC2626', fontSize: 13, marginBottom: 12 }}>{error}</p>}
          <button onClick={handleRegistro} disabled={cargando} style={{ width: '100%', padding: '12px', border: 'none', borderRadius: 10, background: '#111', color: 'white', fontSize: 15, fontWeight: 600, opacity: cargando ? 0.7 : 1 }}>
            {cargando ? 'Creando cuenta...' : 'Crear cuenta'}
          </button>
          <p style={{ textAlign: 'center', fontSize: 13, color: '#666', marginTop: 14 }}>
            ¿Ya tenés cuenta? <Link to="/" style={{ color: '#111', fontWeight: 500 }}>Iniciá sesión</Link>
          </p>
        </div>
      </div>
    </div>
  )
}