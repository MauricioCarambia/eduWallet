import { precacheAndRoute } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { NetworkFirst } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'

// precache de los assets generados por el build (lo inyecta vite-plugin-pwa)
precacheAndRoute(self.__WB_MANIFEST)

// cache de la API con NetworkFirst (igual que la config anterior)
registerRoute(
  ({ url }) => /^https:\/\/eduwallet-production\.up\.railway\.app\/api\/.*/i.test(url.href),
  new NetworkFirst({
    cacheName: 'api-cache',
    plugins: [
      new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 300 })
    ]
  })
)

self.skipWaiting()
self.addEventListener('activate', () => self.clients.claim())

// ─── Notificaciones push ───────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  let data = { title: 'EduWallet', body: 'Tenés una nueva notificación', url: '/' }
  try {
    if (event.data) data = { ...data, ...event.data.json() }
  } catch {
    if (event.data) data.body = event.data.text()
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon.svg',
      badge: '/icon.svg',
      data: { url: data.url || '/' }
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsArr) => {
      const hadWindow = clientsArr.find((c) => c.url.includes(url))
      if (hadWindow) return hadWindow.focus()
      const existente = clientsArr[0]
      if (existente) {
        existente.navigate(url)
        return existente.focus()
      }
      return self.clients.openWindow(url)
    })
  )
})
