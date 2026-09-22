import { createContext, useContext, useState, useEffect } from 'react'

const SuperAdminContext = createContext(null)

export function SuperAdminProvider({ children }) {
  const [autenticado, setAutenticado] = useState(false)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    setAutenticado(!!localStorage.getItem('superadmin_token'))
    setCargando(false)
  }, [])

  const login = (token) => {
    localStorage.setItem('superadmin_token', token)
    setAutenticado(true)
  }

  const logout = () => {
    localStorage.removeItem('superadmin_token')
    setAutenticado(false)
  }

  return (
    <SuperAdminContext.Provider value={{ autenticado, login, logout, cargando }}>
      {children}
    </SuperAdminContext.Provider>
  )
}

export const useSuperAdmin = () => useContext(SuperAdminContext)
