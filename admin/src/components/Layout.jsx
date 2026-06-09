import { useState, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import api from '../api/axios'

const NAV = [
  { path: '/dashboard', label: 'Dashboard', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg> },
  { path: '/alumnos', label: 'Alumnos', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg> },
  { path: '/empleados', label: 'Empleados', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> },
  { path: '/padres', label: 'Padres', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg> },
  { path: '/cajas', label: 'Cajas', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg> },
  { path: '/reportes', label: 'Reportes', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> },
  { path: '/mensajes', label: 'Mensajes', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg> },
  { path: '/auditoria', label: 'Auditoría', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg> },
  { path: '/configuracion', label: 'Configuración', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93l-1.41 1.41M4.93 4.93l1.41 1.41M12 2v2M12 20v2M2 12h2M20 12h2M19.07 19.07l-1.41-1.41M4.93 19.07l1.41-1.41"/></svg> },
]

export default function Layout({ children }) {
  const { sesion, logout } = useAuth()
  const { dark, toggle } = useTheme()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [branding, setBranding] = useState({ nombre_colegio: 'EduWallet', logo: null })

  useEffect(() => {
    api.get('/configuracion/branding').then(r => setBranding(r.data)).catch(() => {})
  }, [])

  const handleLogout = () => { logout(); navigate('/') }

  const sidebarBg = dark ? '#162032' : '#1E3A5F'
  const sidebarText = 'rgba(255,255,255,0.7)'
  const sidebarActive = 'rgba(255,255,255,0.15)'
  const sidebarBorder = 'rgba(255,255,255,0.08)'

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      {mobileOpen && <div onClick={() => setMobileOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 40 }} />}

      <aside style={{ width: collapsed ? 64 : 230, flexShrink: 0, background: sidebarBg, display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, bottom: 0, zIndex: 50, transition: 'width .2s', boxShadow: '2px 0 8px rgba(0,0,0,0.15)' }}>

        {/* logo */}
        <div style={{ padding: collapsed ? '20px 0' : '20px 18px', borderBottom: `1px solid ${sidebarBorder}`, display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'space-between' }}>
          {!collapsed && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: branding.logo ? 'white' : 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                {branding.logo
                  ? <img src={branding.logo} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>
                }
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'white', lineHeight: 1.2 }}>{branding.nombre_colegio || 'EduWallet'}</p>
                <p style={{ margin: 0, fontSize: 10, color: sidebarText }}>Administración</p>
              </div>
            </div>
          )}
          <button onClick={() => setCollapsed(!collapsed)} style={{ background: 'none', border: 'none', color: sidebarText, padding: 4, borderRadius: 6, display: 'flex', cursor: 'pointer' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
        </div>

        {/* nav */}
        <nav style={{ flex: 1, padding: '10px 8px', overflowY: 'auto' }}>
          {NAV.map(item => (
            <NavLink key={item.path} to={item.path} onClick={() => setMobileOpen(false)} style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 10,
              padding: collapsed ? '10px 0' : '9px 12px',
              borderRadius: 8, textDecoration: 'none', marginBottom: 2,
              justifyContent: collapsed ? 'center' : 'flex-start',
              background: isActive ? sidebarActive : 'transparent',
              color: isActive ? 'white' : sidebarText,
              fontWeight: isActive ? 500 : 400, fontSize: 13,
              borderLeft: isActive && !collapsed ? '3px solid var(--accent)' : '3px solid transparent',
              transition: 'all .15s'
            })}>
              {item.icon}
              {!collapsed && item.label}
            </NavLink>
          ))}
        </nav>

        {/* footer */}
        <div style={{ padding: collapsed ? '12px 0' : '12px 16px', borderTop: `1px solid ${sidebarBorder}` }}>
          {!collapsed && (
            <div style={{ marginBottom: 10, padding: '8px 0' }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 500, color: 'white' }}>{sesion?.nombre}</p>
              <p style={{ margin: 0, fontSize: 10, color: sidebarText }}>{sesion?.rol}</p>
            </div>
          )}
          <div style={{ display: 'flex', gap: 6, justifyContent: collapsed ? 'center' : 'flex-start' }}>
            <button onClick={toggle} title={dark ? 'Modo claro' : 'Modo oscuro'} style={{ width: 32, height: 32, border: `1px solid ${sidebarBorder}`, borderRadius: 8, background: 'transparent', color: sidebarText, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              {dark
                ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
              }
            </button>
            {!collapsed && (
              <button onClick={handleLogout} style={{ flex: 1, padding: '7px 12px', border: `1px solid ${sidebarBorder}`, borderRadius: 8, background: 'transparent', color: sidebarText, fontSize: 12, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                Salir
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* main */}
      <div style={{ flex: 1, marginLeft: collapsed ? 64 : 230, transition: 'margin .2s', minWidth: 0 }}>
        <main style={{ padding: '28px', maxWidth: 1200, margin: '0 auto' }}>
          {children}
        </main>
      </div>
    </div>
  )
}