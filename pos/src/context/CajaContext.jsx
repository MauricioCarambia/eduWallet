import { createContext, useContext, useState, useEffect } from 'react'
import { useAuth } from './AuthContext'
import api from '../api/axios'

const CajaContext = createContext(null)

export function CajaProvider({ children }) {
  const { sesion } = useAuth()
  const [caja, setCaja] = useState(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    if (sesion) cargarCaja()
  }, [sesion])

  const cargarCaja = async () => {
    try {
      const res = await api.get('/cajas')
      const cajaMia = res.data.find(c => c.empleado_id === sesion.id && c.abierta)
      setCaja(cajaMia || null)
    } catch (err) {
      console.error(err)
    } finally {
      setCargando(false)
    }
  }

  const abrirCaja = async (local, fondo) => {
    const res = await api.post('/cajas', {
      empleado_id: sesion.id,
      local,
      fondo: parseInt(fondo) || 0
    })
    setCaja(res.data)
    return res.data
  }

  const cerrarCaja = async () => {
    if (!caja) return
    await api.patch(`/cajas/${caja.id}/cerrar`)
    setCaja(null)
  }

  const actualizarVentas = (monto) => {
    setCaja(prev => prev ? ({
      ...prev,
      ventas: (parseFloat(prev.ventas) || 0) + monto,
      tx_count: (prev.tx_count || 0) + 1
    }) : prev)
  }

  return (
    <CajaContext.Provider value={{ caja, cargando, abrirCaja, cerrarCaja, actualizarVentas, recargar: cargarCaja }}>
      {children}
    </CajaContext.Provider>
  )
}

export const useCaja = () => useContext(CajaContext)