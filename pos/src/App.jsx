import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Layout from './components/Layout'
import Venta from './pages/Venta'
import Productos from './pages/Productos'
import Caja from './pages/Caja'
import Historial from './pages/Historial'

function PrivateRoute({ children }) {
  const { sesion, cargando } = useAuth()
  if (cargando) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#999' }}>Cargando...</div>
  return sesion ? children : <Navigate to="/" replace />
}

export default function App() {
  const { sesion } = useAuth()
  return (
    <Routes>
      <Route path="/" element={sesion ? <Navigate to="/venta" replace /> : <Login />} />
      <Route path="/venta" element={<PrivateRoute><Layout><Venta /></Layout></PrivateRoute>} />
      <Route path="/productos" element={<PrivateRoute><Layout><Productos /></Layout></PrivateRoute>} />
      <Route path="/caja" element={<PrivateRoute><Layout><Caja /></Layout></PrivateRoute>} />
      <Route path="/historial" element={<PrivateRoute><Layout><Historial /></Layout></PrivateRoute>} />
    </Routes>
  )
}