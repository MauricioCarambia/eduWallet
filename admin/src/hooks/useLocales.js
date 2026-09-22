import { useState, useEffect } from 'react'
import api from '../api/axios'

export function useLocales(todos = false) {
  const [locales, setLocales] = useState([])
  const [cargando, setCargando] = useState(true)

  const recargar = () => {
    setCargando(true)
    api.get(`/locales${todos ? '?todos=1' : ''}`)
      .then(r => setLocales(r.data))
      .catch(() => setLocales([]))
      .finally(() => setCargando(false))
  }

  useEffect(() => { recargar() }, [])

  return { locales, cargando, recargar }
}
