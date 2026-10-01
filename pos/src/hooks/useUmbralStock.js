import { useEffect, useState } from 'react'
import api from '../api/axios'

// Umbral de stock bajo de Configuración (admin). Lo usan el cartel y la tabla
// de Productos y las tarjetas de Venta, igual que la campanita del servidor.
const UMBRAL_POR_DEFECTO = 5
let pedido = null // un solo pedido por sesión de la página

export default function useUmbralStock() {
  const [umbral, setUmbral] = useState(UMBRAL_POR_DEFECTO)
  useEffect(() => {
    let vigente = true
    pedido ??= api.get('/configuracion/mi-colegio')
      .then(r => Number(r.data?.umbral_stock_bajo ?? UMBRAL_POR_DEFECTO))
      .catch(() => { pedido = null; return UMBRAL_POR_DEFECTO })
    pedido.then(u => { if (vigente && Number.isFinite(u)) setUmbral(u) })
    return () => { vigente = false }
  }, [])
  return umbral
}
