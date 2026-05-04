import { useState, useEffect } from 'react'
import Login from './components/Login'
import Dashboard from './components/Dashboard'

function App() {
  const [sesion, setSesion] = useState(null)

  useEffect(() => {
    const token = localStorage.getItem('token')
    const empleado = localStorage.getItem('empleado')
    if (token && empleado) {
      setSesion(JSON.parse(empleado))
    }
  }, [])

  const handleLogin = (empleado, token) => {
    localStorage.setItem('token', token)
    localStorage.setItem('empleado', JSON.stringify(empleado))
    setSesion(empleado)
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('empleado')
    setSesion(null)
  }

  return (
    <div>
      {sesion ? (
        <Dashboard sesion={sesion} onLogout={handleLogout} />
      ) : (
        <Login onLogin={handleLogin} />
      )}
    </div>
  )
}

export default App