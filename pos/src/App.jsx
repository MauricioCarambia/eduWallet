import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Layout from './components/Layout'
import AvisoInstalar from './components/AvisoInstalar'
import Venta from './pages/Venta'
import Productos from './pages/Productos'
import Caja from './pages/Caja'
import Historial from './pages/Historial'
import Cuenta from './pages/Cuenta'
import Resumen from './pages/Resumen'

function PrivateRoute({ children }) {
  const { sesion, cargando } = useAuth()
  if (cargando) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-secondary)' }}>Cargando...</div>
  return sesion ? children : <Navigate to="/" replace />
}

export default function App() {
  const { sesion } = useAuth()
  return (
    <>
    <Routes>
      <Route path="/" element={sesion ? <Navigate to="/venta" replace /> : <Login />} />
      <Route path="/venta" element={<PrivateRoute><Layout><Venta /></Layout></PrivateRoute>} />
      <Route path="/resumen" element={<PrivateRoute><Layout><Resumen /></Layout></PrivateRoute>} />
      <Route path="/productos" element={<PrivateRoute><Layout><Productos /></Layout></PrivateRoute>} />
      <Route path="/caja" element={<PrivateRoute><Layout><Caja /></Layout></PrivateRoute>} />
      <Route path="/historial" element={<PrivateRoute><Layout><Historial /></Layout></PrivateRoute>} />
      <Route path="/cuenta" element={<PrivateRoute><Layout><Cuenta /></Layout></PrivateRoute>} />
    </Routes>
    <AvisoInstalar nombre="el POS" abajo />
    </>
  )
}