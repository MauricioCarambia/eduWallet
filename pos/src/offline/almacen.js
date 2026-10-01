// Almacenamiento del modo offline en IndexedDB (sobrevive a recargas y a
// reinicios de la app de escritorio):
//   - "datos": la copia para vender sin internet (clave "copia")
//   - "cola":  las ventas hechas sin internet, hasta que se sincronizan
const NOMBRE = 'koletap-pos-offline'
const VERSION = 1

let conexion = null
const abrir = () => {
  conexion ??= new Promise((resolve, reject) => {
    const pedido = indexedDB.open(NOMBRE, VERSION)
    pedido.onupgradeneeded = () => {
      const db = pedido.result
      if (!db.objectStoreNames.contains('datos')) db.createObjectStore('datos')
      if (!db.objectStoreNames.contains('cola')) db.createObjectStore('cola', { keyPath: 'id_venta' })
    }
    pedido.onsuccess = () => resolve(pedido.result)
    pedido.onerror = () => { conexion = null; reject(pedido.error) }
  })
  return conexion
}

const operar = async (almacen, modo, accion) => {
  const db = await abrir()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(almacen, modo)
    const pedido = accion(tx.objectStore(almacen))
    tx.oncomplete = () => resolve(pedido?.result)
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

export const leerDato = clave => operar('datos', 'readonly', s => s.get(clave))
export const guardarDato = (clave, valor) => operar('datos', 'readwrite', s => s.put(valor, clave))

export const encolar = venta => operar('cola', 'readwrite', s => s.put(venta))
export const leerCola = async () => ((await operar('cola', 'readonly', s => s.getAll())) || []).sort((a, b) => a.fecha.localeCompare(b.fecha))
export const quitarDeCola = ids => operar('cola', 'readwrite', s => { ids.forEach(id => s.delete(id)) })
