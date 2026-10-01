import { createContext, useContext, useState, useEffect } from 'react'
import { useAuth } from './AuthContext'
import api from '../api/axios'
import { esErrorDeRed } from '../offline/estado'

// La caja abierta se guarda en el equipo: sin internet el POS sigue vendiendo en ella
const CLAVE = 'pos_caja'
const guardar = c => { try { c ? localStorage.setItem(CLAVE, JSON.stringify(c)) : localStorage.removeItem(CLAVE) } catch { /* sin almacenamiento */ } }
const guardada = empleadoId => { try { const c = JSON.parse(localStorage.getItem(CLAVE)); return c?.empleado_id === empleadoId ? c : null } catch { return null } }

const CajaContext = createContext(null)

export function CajaProvider({ children }) {
  const { sesion } = useAuth()
  const [caja, setCajaEstado] = useState(null)
  const setCaja = valor => setCajaEstado(prev => { const c = typeof valor === 'function' ? valor(prev) : valor; guardar(c); return c })
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
      if (esErrorDeRed(err)) setCaja(guardada(sesion.id)) // sin internet: la última conocida
      else console.error(err)
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