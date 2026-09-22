import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { useSuperAdmin } from './context/SuperAdminContext'
import Login from './pages/Login'
import SuperAdminLogin from './pages/SuperAdminLogin'
import SuperAdminDashboard from './pages/SuperAdminDashboard'
import Dashboard from './pages/Dashboard'
import Alumnos from './pages/Alumnos'
import Empleados from './pages/Empleados'
import Cajas from './pages/Cajas'
import Reportes from './pages/Reportes'
import Auditoria from './pages/Auditoria'
import Configuracion from './pages/Configuracion'
import Layout from './components/Layout'
import Padres from './pages/Padres'
import Mensajes from './pages/Mensajes'

function PrivateRoute({ children }) {
  const { sesion, cargando } = useAuth()
  if (cargando) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#999' }}>Cargando...</div>
  return sesion ? children : <Navigate to="/" replace />
}

function SuperAdminPrivateRoute({ children }) {
  const { autenticado, cargando } = useSuperAdmin()
  if (cargando) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#8B95A8', background: '#0B1220' }}>Cargando...</div>
  return autenticado ? children : <Navigate to="/superadmin" replace />
}

export default function App() {
  const { sesion } = useAuth()

  return (
    <Routes>
      <Route path="/" element={sesion ? <Navigate to="/dashboard" replace /> : <Login />} />
      <Route path="/dashboard" element={<PrivateRoute><Layout><Dashboard /></Layout></PrivateRoute>} />
      <Route path="/alumnos" element={<PrivateRoute><Layout><Alumnos /></Layout></PrivateRoute>} />
      <Route path="/padres" element={<PrivateRoute><Layout><Padres /></Layout></PrivateRoute>} />
      <Route path="/empleados" element={<PrivateRoute><Layout><Empleados /></Layout></PrivateRoute>} />
      <Route path="/mensajes" element={<PrivateRoute><Layout><Mensajes /></Layout></PrivateRoute>} />
      <Route path="/cajas" element={<PrivateRoute><Layout><Cajas /></Layout></PrivateRoute>} />
      <Route path="/reportes" element={<PrivateRoute><Layout><Reportes /></Layout></PrivateRoute>} />
      <Route path="/auditoria" element={<PrivateRoute><Layout><Auditoria /></Layout></PrivateRoute>} />
      <Route path="/configuracion" element={<PrivateRoute><Layout><Configuracion /></Layout></PrivateRoute>} />
      <Route path="/superadmin" element={<SuperAdminLogin />} />
      <Route path="/superadmin/dashboard" element={<SuperAdminPrivateRoute><SuperAdminDashboard /></SuperAdminPrivateRoute>} />
    </Routes>
  )
}