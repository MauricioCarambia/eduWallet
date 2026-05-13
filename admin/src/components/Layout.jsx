import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const NAV = [
  { path: '/dashboard', label: 'Dashboard', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg> },
  { path: '/alumnos', label: 'Alumnos', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg> },
  { path: '/padres', label: 'Padres', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg> },
  { path: '/empleados', label: 'Empleados', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> },
  { path: '/cajas', label: 'Cajas', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg> },
  { path: '/reportes', label: 'Reportes', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> },
  { path: '/auditoria', label: 'Auditoría', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg> },
  { path: '/configuracion', label: 'Configuración', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93l-1.41 1.41M4.93 4.93l1.41 1.41M12 2v2M12 20v2M2 12h2M20 12h2M19.07 19.07l-1.41-1.41M4.93 19.07l1.41-1.41"/></svg> },
]

export default function Layout({ children }) {
  const { sesion, logout } = useAuth()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleLogout = () => { logout(); navigate('/') }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F8F9FA' }}>
      {/* overlay mobile */}
      {mobileOpen && <div onClick={() => setMobileOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 40 }} />}

      {/* sidebar */}
      <aside style={{
        width: collapsed ? 64 : 220, flexShrink: 0, background: 'white',
        borderRight: '1px solid #F0F0F0', display: 'flex', flexDirection: 'column',
        position: 'fixed', top: 0, left: mobileOpen ? 0 : collapsed ? 0 : 0, bottom: 0,
        zIndex: 50, transition: 'width .2s',
        transform: window.innerWidth < 768 && !mobileOpen ? 'translateX(-100%)' : 'none',
      }}>
        <div style={{ padding: collapsed ? '20px 0' : '20px 16px', borderBottom: '1px solid #F0F0F0', display: 'flex', alignItems: 'center', gap: 10, justifyContent: collapsed ? 'center' : 'space-between' }}>
          {!collapsed && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>
              </div>
              <span style={{ fontWeight: 600, fontSize: 15 }}>EduWallet</span>
            </div>
          )}
          <button onClick={() => setCollapsed(!collapsed)} style={{ background: 'none', border: 'none', color: '#999', padding: 4, borderRadius: 6, display: 'flex' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
        </div>

        <nav style={{ flex: 1, padding: '12px 8px', overflowY: 'auto' }}>
          {NAV.map(item => (
            <NavLink key={item.path} to={item.path} onClick={() => setMobileOpen(false)} style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 10, padding: collapsed ? '10px 0' : '9px 12px',
              borderRadius: 8, textDecoration: 'none', marginBottom: 2, justifyContent: collapsed ? 'center' : 'flex-start',
              background: isActive ? '#F3F4F6' : 'transparent',
              color: isActive ? '#111' : '#666', fontWeight: isActive ? 500 : 400, fontSize: 13,
              transition: 'background .15s'
            })}>
              {item.icon}
              {!collapsed && item.label}
            </NavLink>
          ))}
        </nav>

        <div style={{ padding: collapsed ? '12px 0' : '12px 16px', borderTop: '1px solid #F0F0F0' }}>
          {!collapsed && (
            <div style={{ marginBottom: 8 }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 500 }}>{sesion?.nombre}</p>
              <p style={{ margin: 0, fontSize: 11, color: '#999' }}>{sesion?.rol}</p>
            </div>
          )}
          <button onClick={handleLogout} style={{ width: '100%', padding: collapsed ? '8px 0' : '7px 12px', border: '1px solid #F0F0F0', borderRadius: 8, background: 'white', color: '#666', fontSize: 12, display: 'flex', alignItems: 'center', gap: 8, justifyContent: collapsed ? 'center' : 'flex-start' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            {!collapsed && 'Salir'}
          </button>
        </div>
      </aside>

      {/* main */}
      <div style={{ flex: 1, marginLeft: collapsed ? 64 : 220, transition: 'margin .2s', minWidth: 0 }}>
        {/* topbar mobile */}
        <div style={{ display: 'none', padding: '12px 16px', background: 'white', borderBottom: '1px solid #F0F0F0', alignItems: 'center', gap: 12, position: 'sticky', top: 0, zIndex: 30 }} className="mobile-topbar">
          <button onClick={() => setMobileOpen(true)} style={{ background: 'none', border: 'none', display: 'flex', color: '#111' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
          <span style={{ fontWeight: 600, fontSize: 15 }}>EduWallet Admin</span>
        </div>

        <main style={{ padding: '24px', maxWidth: 1200, margin: '0 auto' }}>
          {children}
        </main>
      </div>
    </div>
  )
}