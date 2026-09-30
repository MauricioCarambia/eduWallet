import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import api from '../api/axios'

const etiqueta = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.5px' }

// Primera vez (o PIN olvidado): el administrador da un código de un solo uso
// y el empleado elige su propio PIN. El administrador nunca lo conoce.
function ActivarCuenta({ colegioInicial, usuarioInicial, onListo, onVolver }) {
  const [colegio, setColegio] = useState(colegioInicial)
  const [usuario, setUsuario] = useState(usuarioInicial)
  const [codigo, setCodigo] = useState('')
  const [pin, setPin] = useState('')
  const [pin2, setPin2] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  const activar = async () => {
    setError('')
    if (!/^\d{4,6}$/.test(pin)) { setError('El PIN tiene que tener entre 4 y 6 números'); return }
    if (pin !== pin2) { setError('Los dos PIN no coinciden'); return }
    setEnviando(true)
    try {
      await api.post('/empleados/activar', { colegio, usuario, codigo, pin })
      onListo(colegio, usuario)
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo activar la cuenta')
    } finally { setEnviando(false) }
  }

  const listo = colegio && usuario && codigo && pin && pin2
  return (
    <div style={{ background: 'var(--bg-card)', borderRadius: 20, padding: '1.5rem', border: '1.5px solid var(--border)', boxShadow: 'var(--shadow-md)' }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', margin: '0 0 4px' }}>Activar cuenta</h2>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 16px' }}>Usá el código que te dio el administrador y elegí tu PIN. Nadie más lo va a conocer.</p>
      <div style={{ marginBottom: 12 }}>
        <label style={etiqueta} htmlFor="act-colegio">Colegio</label>
        <input id="act-colegio" value={colegio} onChange={e => setColegio(e.target.value)} />
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={etiqueta} htmlFor="act-usuario">Usuario</label>
        <input id="act-usuario" value={usuario} onChange={e => setUsuario(e.target.value)} autoCapitalize="none" />
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={etiqueta} htmlFor="act-codigo">Código de activación</label>
        <input id="act-codigo" value={codigo} onChange={e => setCodigo(e.target.value.toUpperCase())} placeholder="XXXX-XXXX" autoCapitalize="characters" style={{ fontFamily: 'monospace', letterSpacing: 2 }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
        <div>
          <label style={etiqueta} htmlFor="act-pin">Tu PIN</label>
          <input id="act-pin" type="password" inputMode="numeric" maxLength={6} value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ''))} placeholder="4 a 6 números" />
        </div>
        <div>
          <label style={etiqueta} htmlFor="act-pin2">Repetilo</label>
          <input id="act-pin2" type="password" inputMode="numeric" maxLength={6} value={pin2} onChange={e => setPin2(e.target.value.replace(/\D/g, ''))} onKeyDown={e => e.key === 'Enter' && listo && activar()} />
        </div>
      </div>
      {error && <div style={{ padding: '10px 14px', background: 'var(--red-bg)', color: 'var(--red)', borderRadius: 8, fontSize: 13, marginBottom: 14 }}>{error}</div>}
      <button onClick={activar} disabled={enviando || !listo}
        style={{ width: '100%', padding: '14px', border: 'none', borderRadius: 'var(--radius)', background: 'var(--brand)', color: 'var(--on-brand)', fontSize: 15, fontWeight: 600, opacity: enviando || !listo ? 0.5 : 1, cursor: 'pointer', marginBottom: 10 }}>
        {enviando ? 'Activando...' : 'Activar y elegir PIN'}
      </button>
      <button onClick={onVolver} style={{ width: '100%', padding: '8px', border: 'none', background: 'none', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer' }}>Volver a iniciar sesión</button>
    </div>
  )
}

export default function Login() {
  const [colegio, setColegio] = useState(() => localStorage.getItem('admin_colegio') || '')
  const [usuario, setUsuario] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)
  const [modo, setModo] = useState('login') // 'login' | 'activar'
  const [aviso, setAviso] = useState('')
  const [pendiente, setPendiente] = useState(false)
  const { login } = useAuth()
  const { dark, toggle } = useTheme()
  const { t } = useTranslation()
  const navigate = useNavigate()

  const handleLogin = async () => {
    if (!colegio || !usuario || !pin) return
    setCargando(true); setError('')
    try {
      localStorage.setItem('admin_colegio', colegio)
      const res = await api.post('/empleados/login', { colegio, usuario, pin, app: 'admin' })
      if (res.data.empleado.rol !== 'admin') {
        setError(t('login.error_acceso'))
        setCargando(false); return
      }
      login(res.data.empleado, res.data.token)
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.error || t('login.error_login'))
      setPendiente(!!err.response?.data?.pendiente_activacion)
    } finally {
      setCargando(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', position: 'relative' }}>

      {/* toggle tema */}
      <button onClick={toggle} style={{ position: 'absolute', top: 20, right: 20, width: 36, height: 36, border: '1.5px solid var(--border)', borderRadius: 10, background: 'var(--bg-card)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
        {dark
          ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
          : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
        }
      </button>

      <div style={{ width: '100%', maxWidth: 400 }}>
        {/* header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 56, height: 56, borderRadius: 12.25, background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', boxShadow: 'var(--shadow-brand)' }}>
            <img src="/favicon.svg" alt="KoleTap" width="56" height="56" style={{ display: 'block' }} />
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>KoleTap</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{t('login.subtitulo')}</p>
        </div>

        {modo === 'activar' ? (
          <ActivarCuenta colegioInicial={colegio} usuarioInicial={usuario}
            onVolver={() => { setModo('login'); setError('') }}
            onListo={(c, u) => { setColegio(c); setUsuario(u); setPin(''); setError(''); setPendiente(false); setModo('login'); setAviso('¡Cuenta activada! Ingresá con tu PIN.') }} />
        ) : (
        <>
        <div style={{ background: 'var(--bg-card)', borderRadius: 16, padding: '2rem', border: '1.5px solid var(--border)', boxShadow: 'var(--shadow-md)' }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.5px' }}>{t('login.colegio')}</label>
            <input value={colegio} onChange={e => setColegio(e.target.value)} placeholder={t('login.colegio_placeholder')} onKeyDown={e => e.key === 'Enter' && handleLogin()} autoFocus />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.5px' }}>{t('login.usuario')}</label>
            <input value={usuario} onChange={e => setUsuario(e.target.value)} placeholder={t('login.usuario_placeholder')} onKeyDown={e => e.key === 'Enter' && handleLogin()} />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.5px' }}>{t('login.pin')}</label>
            <input type="password" value={pin} onChange={e => setPin(e.target.value)} placeholder="••••" onKeyDown={e => e.key === 'Enter' && handleLogin()} />
          </div>
          {aviso && <div style={{ padding: '10px 14px', background: 'var(--green-bg)', color: 'var(--green)', borderRadius: 8, fontSize: 13, marginBottom: 14 }}>{aviso}</div>}
          {error && <div style={{ padding: '10px 14px', background: 'var(--red-bg)', color: 'var(--red)', borderRadius: 8, fontSize: 13, marginBottom: 16, borderLeft: '3px solid var(--red)' }}>{error}</div>}
          <button onClick={handleLogin} disabled={cargando} style={{ width: '100%', padding: '12px', border: 'none', borderRadius: 10, background: 'var(--brand)', color: 'var(--on-brand)', fontSize: 14, fontWeight: 600, opacity: cargando ? 0.7 : 1, boxShadow: 'var(--shadow-brand)' }}>
            {cargando ? t('login.ingresando') : t('login.ingresar')}
          </button>
        </div>
        <button onClick={() => { setModo('activar'); setError(''); setAviso('') }} style={{ display: 'block', margin: '14px auto 0', padding: '6px 10px', border: 'none', background: 'none', color: pendiente ? 'var(--brand)' : 'var(--text-secondary)', fontSize: 13, fontWeight: pendiente ? 600 : 400, cursor: 'pointer', textDecoration: 'underline' }}>
          ¿Primera vez o te dieron un código? Activar cuenta
        </button>
        </>
        )}
      </div>
    </div>
  )
}