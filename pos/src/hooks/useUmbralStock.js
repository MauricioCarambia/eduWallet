import { useEffect, useState } from 'react'
import api from '../api/axios'

// Configuración del colegio (nombre, umbral de stock bajo…), pedida una sola
// vez por sesión de la página y compartida por todas las pantallas
let pedido = null
export const leerConfigColegio = () => (pedido ??= api.get('/configuracion/mi-colegio')
  .then(r => r.data || {})
  .catch(() => { pedido = null; return {} }))

export function useConfigColegio() {
  const [config, setConfig] = useState({})
  useEffect(() => {
    let vigente = true
    leerConfigColegio().then(c => { if (vigente) setConfig(c) })
    return () => { vigente = false }
  }, [])
  return config
}

// Umbral de stock bajo de Configuración (admin). Lo usan el cartel y la tabla
// de Productos y las tarjetas de Venta, igual que la campanita del servidor.
const UMBRAL_POR_DEFECTO = 5

export default function useUmbralStock() {
  const config = useConfigColegio()
  const u = Number(config.umbral_stock_bajo ?? UMBRAL_POR_DEFECTO)
  return Number.isFinite(u) ? u : UMBRAL_POR_DEFECTO
}
