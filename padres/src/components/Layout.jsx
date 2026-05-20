import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useState, useEffect } from 'react'

const NAV = [
  { path: '/inicio', label: 'Inicio', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> },
  { path: '/historial', label: 'Historial', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg> },
  { path: '/recargar', label: 'Recargar', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg> },
  { path: '/control', label: 'Control', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93l-1.41 1.41M4.93 4.93l1.41 1.41M12 2v2M12 20v2M2 12h2M20 12h2M19.07 19.07l-1.41-1.41M4.93 19.07l1.41-1.41"/></svg> },
]

export default function Layout({ children }) {
  const { padre, logout } = useAuth()
  const { dark, toggle } = useTheme()
  const navigate = useNavigate()
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [mostrarInstalar, setMostrarInstalar] = useState(false)

  useEffect(() => {
    const handler = e => { e.preventDefault(); setDeferredPrompt(e); setMostrarInstalar(true) }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const instalarApp = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') setMostrarInstalar(false)
    setDeferredPrompt(null)
  }

  const handleLogout = () => { logout(); navigate('/') }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', paddingBottom: 72 }}>

      {/* banner instalar PWA */}
      {mostrarInstalar && (
        <div style={{ background: '#1E3A5F', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'white' }}>Instalá EduWallet</p>
              <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>Agregala a tu pantalla de inicio</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={instalarApp} style={{ padding: '6px 14px', border: 'none', borderRadius: 7, background: 'white', color: '#1E3A5F', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Instalar</button>
            <button onClick={() => setMostrarInstalar(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', fontSize: 18, cursor: 'pointer' }}>×</button>
          </div>
        </div>
      )}

      {/* header */}
      <div style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10, boxShadow: 'var(--shadow)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 30, height: 30, borderRadius: 9, background: '#1E3A5F', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>
          </div>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>EduWallet</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{padre?.nombre?.split(' ')[0]}</span>
          <button onClick={toggle} style={{ width: 32, height: 32, border: '1.5px solid var(--border)', borderRadius: 8, background: 'var(--bg-card)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            {dark
              ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/></svg>
              : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
            }
          </button>
          <button onClick={handleLogout} style={{ fontSize: 12, padding: '5px 10px', border: '1.5px solid var(--border)', borderRadius: 7, background: 'var(--bg-card)', color: 'var(--text-secondary)', cursor: 'pointer' }}>Salir</button>
        </div>
      </div>

      {/* contenido */}
      <main style={{ padding: '16px' }}>
        {children}
      </main>

      {/* bottom nav */}
      <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, background: 'var(--bg-card)', borderTop: '1px solid var(--border)', display: 'flex', zIndex: 10, boxShadow: '0 -2px 8px rgba(0,0,0,0.06)' }}>
        {NAV.map(item => (
          <NavLink key={item.path} to={item.path} style={({ isActive }) => ({
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
            padding: '10px 0 8px', textDecoration: 'none',
            color: isActive ? '#1E3A5F' : 'var(--text-tertiary)',
            fontSize: 10, fontWeight: isActive ? 600 : 400,
            borderTop: isActive ? '2px solid #1E3A5F' : '2px solid transparent',
            transition: 'color .15s'
          })}>
            {item.icon}
            {item.label}
          </NavLink>
        ))}
      </div>
    </div>
  )
}