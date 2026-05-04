import { useState, useEffect } from 'react'
import api from '../api/axios'

export function useAlumnos() {
  const [alumnos, setAlumnos] = useState([])
  const [cargando, setCargando] = useState(true)

  const cargar = async () => {
    try {
      const res = await api.get('/alumnos')
      setAlumnos(res.data)
    } catch (err) {
      console.error(err)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => { cargar() }, [])
  return { alumnos, setAlumnos, cargando, recargar: cargar }
}

export function useProductos() {
  const [productos, setProductos] = useState([])
  const [cargando, setCargando] = useState(true)

  const cargar = async () => {
    try {
      const res = await api.get('/productos')
      setProductos(res.data)
    } catch (err) {
      console.error(err)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => { cargar() }, [])
  return { productos, setProductos, cargando, recargar: cargar }
}

export function useTransacciones() {
  const [transacciones, setTransacciones] = useState([])
  const [cargando, setCargando] = useState(true)

  const cargar = async () => {
    try {
      const res = await api.get('/transacciones')
      setTransacciones(res.data)
    } catch (err) {
      console.error(err)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => { cargar() }, [])
  return { transacciones, setTransacciones, cargando, recargar: cargar }
}

export function useEmpleados() {
  const [empleados, setEmpleados] = useState([])

  const cargar = async () => {
    try {
      const res = await api.get('/empleados')
      setEmpleados(res.data)
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => { cargar() }, [])
  return { empleados, setEmpleados, recargar: cargar }
}