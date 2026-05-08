import { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [padre, setPadre] = useState(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('padres_token')
    const padreGuardado = localStorage.getItem('padres_sesion')
    if (token && padreGuardado) setPadre(JSON.parse(padreGuardado))
    setCargando(false)
  }, [])

  const login = (padre, token) => {
    localStorage.setItem('padres_token', token)
    localStorage.setItem('padres_sesion', JSON.stringify(padre))
    setPadre(padre)
  }

  const logout = () => {
    localStorage.removeItem('padres_token')
    localStorage.removeItem('padres_sesion')
    setPadre(null)
  }

  return (
    <AuthContext.Provider value={{ padre, login, logout, cargando }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)