// Service worker del POS (modo offline): guarda la app en el equipo para que
// abra sin internet. Sólo maneja archivos del propio POS; la API (otro dominio)
// pasa directo y el POS decide qué hacer si no contesta.
//   - páginas: primero internet (para tomar cada versión nueva); sin internet, la guardada
//   - /assets/*: tienen el hash en el nombre, así que una vez guardados no cambian
//   - el resto (íconos, logo): la guardada al instante y se renueva por detrás
const CACHE = 'koletap-pos-v1'

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(c => c.add('/index.html')).catch(() => {}))
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const nombre of await caches.keys()) if (nombre !== CACHE) await caches.delete(nombre)
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', event => {
  const pedido = event.request
  if (pedido.method !== 'GET') return
  const url = new URL(pedido.url)
  if (url.origin !== self.location.origin || url.pathname === '/sw.js') return

  if (pedido.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const respuesta = await fetch(pedido)
        if (respuesta.ok) (await caches.open(CACHE)).put('/index.html', respuesta.clone())
        return respuesta
      } catch {
        return (await caches.match('/index.html')) || Response.error()
      }
    })())
    return
  }

  if (url.pathname.startsWith('/assets/')) {
    event.respondWith((async () => {
      const guardada = await caches.match(pedido)
      if (guardada) return guardada
      const respuesta = await fetch(pedido)
      if (respuesta.ok) (await caches.open(CACHE)).put(pedido, respuesta.clone())
      return respuesta
    })())
    return
  }

  event.respondWith((async () => {
    const guardada = await caches.match(pedido)
    const deRed = fetch(pedido).then(async respuesta => {
      if (respuesta.ok) (await caches.open(CACHE)).put(pedido, respuesta.clone())
      return respuesta
    }).catch(() => null)
    return guardada || (await deRed) || Response.error()
  })())
})
