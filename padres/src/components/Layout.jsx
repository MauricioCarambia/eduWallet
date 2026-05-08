import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const NAV = [
  { path: '/inicio', label: 'Inicio', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> },
  { path: '/historial', label: 'Historial', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg> },
  { path: '/recargar', label: 'Recargar', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg> },
  { path: '/control', label: 'Control', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93l-1.41 1.41M4.93 4.93l1.41 1.41M12 2v2M12 20v2M2 12h2M20 12h2M19.07 19.07l-1.41-1.41M4.93 19.07l1.41-1.41"/></svg> },
]

export default function Layout({ children }) {
  const { padre, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => { logout(); navigate('/') }

  return (
    <div style={{ minHeight: '100vh', background: '#F8F9FA', paddingBottom: 70 }}>
      {/* header */}
      <div style={{ background: 'white', borderBottom: '1px solid #F0F0F0', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 30, height: 30, borderRadius: 9, background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>
          </div>
          <span style={{ fontSize: 15, fontWeight: 600 }}>EduWallet</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13, color: '#666' }}>{padre?.nombre}</span>
          <button onClick={handleLogout} style={{ background: 'none', border: 'none', color: '#999', fontSize: 12, padding: '4px 8px', borderRadius: 6, border: '1px solid #F0F0F0' }}>Salir</button>
        </div>
      </div>

      {/* contenido */}
      <main style={{ padding: '16px' }}>
        {children}
      </main>

      {/* bottom nav */}
      <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, background: 'white', borderTop: '1px solid #F0F0F0', display: 'flex', zIndex: 10 }}>
        {NAV.map(item => (
          <NavLink key={item.path} to={item.path} style={({ isActive }) => ({
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '10px 0 8px',
            textDecoration: 'none', color: isActive ? '#111' : '#aaa', fontSize: 10, fontWeight: isActive ? 600 : 400,
            borderTop: isActive ? '2px solid #111' : '2px solid transparent', transition: 'color .15s'
          })}>
            {item.icon}
            {item.label}
          </NavLink>
        ))}
      </div>
    </div>
  )
}