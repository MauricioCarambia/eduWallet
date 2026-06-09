import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Registro from './pages/Registro'
import OlvidePassword from './pages/OlvidePassword'
import ResetearPassword from './pages/ResetearPassword'
import Inicio from './pages/Inicio'
import Historial from './pages/Historial'
import Recargar from './pages/Recargar'
import Control from './pages/Control'
import Layout from './components/Layout'

function PrivateRoute({ children }) {
  const { padre, cargando } = useAuth()
  if (cargando) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#999' }}>Cargando...</div>
  return padre ? children : <Navigate to="/" replace />
}

export default function App() {
  const { padre } = useAuth()
  return (
    <Routes>
      <Route path="/" element={padre ? <Navigate to="/inicio" replace /> : <Login />} />
      <Route path="/registro" element={padre ? <Navigate to="/inicio" replace /> : <Registro />} />
      <Route path="/olvide-password" element={padre ? <Navigate to="/inicio" replace /> : <OlvidePassword />} />
      <Route path="/resetear-password" element={padre ? <Navigate to="/inicio" replace /> : <ResetearPassword />} />
      <Route path="/inicio" element={<PrivateRoute><Layout><Inicio /></Layout></PrivateRoute>} />
      <Route path="/historial" element={<PrivateRoute><Layout><Historial /></Layout></PrivateRoute>} />
      <Route path="/recargar" element={<PrivateRoute><Layout><Recargar /></Layout></PrivateRoute>} />
      <Route path="/control" element={<PrivateRoute><Layout><Control /></Layout></PrivateRoute>} />
    </Routes>
  )
}