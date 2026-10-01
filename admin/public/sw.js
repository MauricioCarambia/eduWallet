// Service worker del panel admin: lo necesita el navegador para ofrecer
// instalarlo. Las páginas van siempre por internet (el admin no trabaja sin
// conexión); si no hay, abre la última versión guardada.
const CACHE = 'koletap-admin-v1'

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const nombre of await caches.keys()) if (nombre !== CACHE) await caches.delete(nombre)
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', event => {
  if (event.request.mode !== 'navigate') return
  event.respondWith((async () => {
    try {
      const respuesta = await fetch(event.request)
      if (respuesta.ok) (await caches.open(CACHE)).put('/index.html', respuesta.clone())
      return respuesta
    } catch {
      return (await caches.match('/index.html')) || Response.error()
    }
  })())
})
