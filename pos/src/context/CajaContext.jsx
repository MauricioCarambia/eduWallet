import { createContext, useContext, useState, useEffect } from 'react'
import { useAuth } from './AuthContext'
import api from '../api/axios'
import { esErrorDeRed, offlineHabilitado } from '../offline/estado'
import { abrirCajaSinConexion, cerrarCajaSinConexion, esCajaLocal, sincronizar } from '../offline/sync'

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

  // Al subir lo hecho sin internet, la caja vuelve a venir del servidor (una
  // caja abierta sin conexión ya tiene su número real)
  useEffect(() => {
    if (!sesion) return
    const alSincronizar = () => cargarCaja()
    window.addEventListener('koletap:sincronizado', alSincronizar)
    return () => window.removeEventListener('koletap:sincronizado', alSincronizar)
  }, [sesion])

  const cargarCaja = async () => {
    try {
      const res = await api.get('/cajas')
      const cajaMia = res.data.find(c => c.empleado_id === sesion.id && c.abierta)
      // una caja abierta sin internet que todavía no se subió sigue siendo la de este equipo
      const local = guardada(sesion.id)
      setCaja(cajaMia || (esCajaLocal(local) ? local : null))
    } catch (err) {
      if (esErrorDeRed(err)) setCaja(guardada(sesion.id)) // sin internet: la última conocida
      else console.error(err)
    } finally {
      setCargando(false)
    }
  }

  // Sin internet (modo offline) la caja se abre en el equipo y se crea en el
  // servidor al volver la conexión, con la hora real de apertura
  const abrirCaja = async (local, fondo) => {
    try {
      const res = await api.post('/cajas', {
        empleado_id: sesion.id,
        local,
        fondo: parseInt(fondo) || 0
      })
      setCaja(res.data)
      return res.data
    } catch (err) {
      if (!offlineHabilitado() || !esErrorDeRed(err)) throw err
      const c = await abrirCajaSinConexion({ local: sesion.local || local, fondo, empleadoId: sesion.id })
      setCaja(c)
      return c
    }
  }

  // Devuelve { sinConexion: true } si el cierre quedó para subir después
  const cerrarCaja = async () => {
    if (!caja) return
    if (esCajaLocal(caja)) {
      // todavía no está en el servidor: se cierra acá y se sube con lo pendiente
      await cerrarCajaSinConexion(caja)
      setCaja(null)
      sincronizar()
      return { sinConexion: true }
    }
    try {
      await api.patch(`/cajas/${caja.id}/cerrar`)
    } catch (err) {
      if (!offlineHabilitado() || !esErrorDeRed(err)) throw err
      await cerrarCajaSinConexion(caja)
      setCaja(null)
      return { sinConexion: true }
    }
    setCaja(null)
  }

  const actualizarVentas = (monto) => {
    setCaja(prev => prev ? ({
      ...prev,
      ventas: (parseFloat(prev.ventas) || 0) + monto,
      tx_count: (prev.tx_count || 0) + (monto < 0 ? -1 : 1) // anular resta una venta
    }) : prev)
  }

  return (
    <CajaContext.Provider value={{ caja, cargando, abrirCaja, cerrarCaja, actualizarVentas, recargar: cargarCaja }}>
      {children}
    </CajaContext.Provider>
  )
}

export const useCaja = () => useContext(CajaContext)