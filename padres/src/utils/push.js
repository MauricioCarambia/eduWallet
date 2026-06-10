import api from '../api/axios'

const urlBase64ToUint8Array = (base64String) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)))
}

export const pushSoportado = () =>
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

export const obtenerSuscripcionActual = async () => {
  if (!pushSoportado()) return null
  const reg = await navigator.serviceWorker.ready
  return reg.pushManager.getSubscription()
}

export const activarPush = async () => {
  if (!pushSoportado()) throw new Error('Este navegador no soporta notificaciones push')

  const permiso = await Notification.requestPermission()
  if (permiso !== 'granted') throw new Error('Permiso de notificaciones denegado')

  const { data } = await api.get('/padres/push/clave-publica')
  const reg = await navigator.serviceWorker.ready

  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(data.publicKey)
    })
  }

  await api.post('/padres/push/suscribir', sub.toJSON())
  return sub
}

export const desactivarPush = async () => {
  const sub = await obtenerSuscripcionActual()
  if (sub) {
    await api.post('/padres/push/desuscribir', { endpoint: sub.endpoint })
    await sub.unsubscribe()
  }
}
