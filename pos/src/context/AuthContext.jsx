import { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [sesion, setSesion] = useState(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('pos_token')
    const empleado = localStorage.getItem('pos_sesion')
    if (token && empleado) {
      const datos = JSON.parse(empleado)
      // El admin del colegio ya no opera el POS: una sesión suya guardada de
      // antes se descarta y tiene que usar el panel admin
      if (datos.rol === 'admin') {
        localStorage.removeItem('pos_token')
        localStorage.removeItem('pos_sesion')
      } else {
        setSesion(datos)
      }
    }
    setCargando(false)
  }, [])

  const login = (empleado, token) => {
    localStorage.setItem('pos_token', token)
    localStorage.setItem('pos_sesion', JSON.stringify(empleado))
    setSesion(empleado)
  }

  const logout = () => {
    localStorage.removeItem('pos_token')
    localStorage.removeItem('pos_sesion')
    setSesion(null)
  }

  return (
    <AuthContext.Provider value={{ sesion, login, logout, cargando }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)