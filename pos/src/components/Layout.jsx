import { useState, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useCaja } from '../context/CajaContext'
import api from '../api/axios'

const NAV = [
  { path: '/venta', label: 'Venta', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M7 15h2M13 15h4"/></svg> },
  { path: '/productos', label: 'Productos', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg> },
  { path: '/caja', label: 'Caja', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/></svg> },
  { path: '/historial', label: 'Historial', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg> },
]

const fmt = n => `$${Number(n).toLocaleString('es-AR')}`

const ALERTAS_INTERVALO = 30000 // 30s

export default function Layout({ children }) {
  const { sesion, logout } = useAuth()
  const { dark, toggle } = useTheme()
  const { caja } = useCaja()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)
  const [branding, setBranding] = useState({ nombre_colegio: 'EduWallet', logo: null })
  const [stockBajo, setStockBajo] = useState([])
  const [mostrarAlertas, setMostrarAlertas] = useState(false)

  useEffect(() => {
    api.get('/configuracion/branding').then(r => setBranding(r.data)).catch(() => {})
  }, [])

  useEffect(() => {
    const cargarStockBajo = () => {
      api.get('/productos/stock-bajo').then(r => setStockBajo(r.data.productos || [])).catch(() => {})
    }
    cargarStockBajo()
    const id = setInterval(cargarStockBajo, ALERTAS_INTERVALO)
    return () => clearInterval(id)
  }, [])

  const handleLogout = () => { logout(); navigate('/') }

  const sidebarBg = dark ? '#162032' : '#1E3A5F'
  const sidebarText = 'rgba(255,255,255,0.7)'
  const sidebarBorder = 'rgba(255,255,255,0.08)'
  const sidebarActive = 'rgba(255,255,255,0.15)'

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      <aside style={{ width: collapsed ? 64 : 220, flexShrink: 0, background: sidebarBg, display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, bottom: 0, zIndex: 50, transition: 'width .2s', boxShadow: '2px 0 8px rgba(0,0,0,0.15)' }}>

        <div style={{ padding: collapsed ? '20px 0' : '20px 16px', borderBottom: `1px solid ${sidebarBorder}`, display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'space-between' }}>
          {!collapsed && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: branding.logo ? 'white' : 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                {branding.logo
                  ? <img src={branding.logo} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>
                }
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'white', lineHeight: 1.2 }}>{branding.nombre_colegio || 'EduWallet'}</p>
                <p style={{ margin: 0, fontSize: 10, color: sidebarText }}>Punto de Venta</p>
              </div>
            </div>
          )}
          <button onClick={() => setCollapsed(!collapsed)} style={{ background: 'none', border: 'none', color: sidebarText, padding: 4, borderRadius: 6, display: 'flex', cursor: 'pointer' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
        </div>

        {/* estado caja */}
        {!collapsed && (
          <div style={{ padding: '10px 16px', background: caja ? 'rgba(5,150,105,0.15)' : 'rgba(220,38,38,0.1)', borderBottom: `1px solid ${sidebarBorder}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: caja ? '#34D399' : '#F87171' }} />
              <span style={{ fontSize: 11, fontWeight: 500, color: caja ? '#34D399' : '#F87171' }}>
                {caja ? `${caja.local} · ${fmt(caja.ventas || 0)}` : 'Sin caja abierta'}
              </span>
            </div>
          </div>
        )}

        <nav style={{ flex: 1, padding: '10px 8px', overflowY: 'auto' }}>
          {NAV.map(item => (
            <NavLink key={item.path} to={item.path} style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 10,
              padding: collapsed ? '10px 0' : '9px 12px',
              borderRadius: 8, textDecoration: 'none', marginBottom: 2,
              justifyContent: collapsed ? 'center' : 'flex-start',
              background: isActive ? sidebarActive : 'transparent',
              color: isActive ? 'white' : sidebarText,
              fontWeight: isActive ? 500 : 400, fontSize: 13,
              borderLeft: isActive && !collapsed ? '3px solid var(--accent)' : '3px solid transparent',
            })}>
              {item.icon}
              {!collapsed && item.label}
            </NavLink>
          ))}
        </nav>

        <div style={{ padding: collapsed ? '12px 0' : '12px 16px', borderTop: `1px solid ${sidebarBorder}` }}>
          {!collapsed && (
            <div style={{ marginBottom: 10 }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 500, color: 'white' }}>{sesion?.nombre}</p>
              <p style={{ margin: 0, fontSize: 10, color: sidebarText }}>{sesion?.rol}</p>
            </div>
          )}
          <div style={{ display: 'flex', gap: 6, justifyContent: collapsed ? 'center' : 'flex-start' }}>
            <button onClick={toggle} style={{ width: 32, height: 32, border: `1px solid ${sidebarBorder}`, borderRadius: 8, background: 'transparent', color: sidebarText, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              {dark
                ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/></svg>
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

      <div style={{ flex: 1, marginLeft: collapsed ? 64 : 220, transition: 'margin .2s', minWidth: 0 }}>
        {/* alertas de stock bajo */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '14px 24px 0', position: 'relative' }}>
          <button onClick={() => setMostrarAlertas(v => !v)} style={{ position: 'relative', width: 38, height: 38, border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg-card)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: 'var(--shadow)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
            {stockBajo.length > 0 && (
              <span style={{ position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, padding: '0 4px', borderRadius: 9, background: 'var(--red)', color: 'white', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {stockBajo.length}
              </span>
            )}
          </button>

          {mostrarAlertas && (
            <div style={{ position: 'absolute', top: 50, right: 24, width: 300, maxHeight: 360, overflowY: 'auto', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: 'var(--shadow-md)', zIndex: 60 }}>
              <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-light)', fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                Alertas de stock bajo
              </div>
              {stockBajo.length === 0 ? (
                <p style={{ padding: '16px 14px', margin: 0, fontSize: 13, color: 'var(--text-tertiary)' }}>Sin alertas — todo el stock está OK.</p>
              ) : (
                stockBajo.map(p => (
                  <div key={p.id} style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <p style={{ margin: '0 0 2px', fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{p.nombre}</p>
                      <p style={{ margin: 0, fontSize: 11, color: 'var(--text-tertiary)' }}>{p.local} · {p.categoria}</p>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 8, color: p.stock === 0 ? 'var(--red)' : 'var(--amber)', background: p.stock === 0 ? 'var(--red-bg)' : 'var(--amber-bg)' }}>
                      {p.stock === 0 ? 'Sin stock' : `Stock: ${p.stock}`}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <main style={{ padding: '24px', maxWidth: 1200, margin: '0 auto' }}>
          {children}
        </main>
      </div>
    </div>
  )
}