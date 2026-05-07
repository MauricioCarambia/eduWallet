import { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [sesion, setSesion] = useState(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('admin_token')
    const empleado = localStorage.getItem('admin_sesion')
    if (token && empleado) {
      setSesion(JSON.parse(empleado))
    }
    setCargando(false)
  }, [])

  const login = (empleado, token) => {
    localStorage.setItem('admin_token', token)
    localStorage.setItem('admin_sesion', JSON.stringify(empleado))
    setSesion(empleado)
  }

  const logout = () => {
    localStorage.removeItem('admin_token')
    localStorage.removeItem('admin_sesion')
    setSesion(null)
  }

  return (
    <AuthContext.Provider value={{ sesion, login, logout, cargando }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)