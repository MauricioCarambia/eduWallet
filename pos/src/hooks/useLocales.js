import { useState, useEffect } from 'react'
import api from '../api/axios'

export function useLocales() {
  const [locales, setLocales] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    api.get('/locales')
      .then(r => setLocales(r.data.map(l => l.nombre)))
      .catch(() => setLocales([]))
      .finally(() => setCargando(false))
  }, [])

  return { locales, cargando }
}
