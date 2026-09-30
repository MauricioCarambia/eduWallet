// Puente entre la app de escritorio y la página (POS o panel admin): expone
// sólo lo necesario para recibir las tarjetas que lee el lector NFC.
const { contextBridge, ipcRenderer } = require('electron');

// Sólo para el POS y el panel admin de EduPass. (La ventana además bloquea
// cualquier otra URL: ver main.js.) En modo sandbox no hay process.env, así
// que para probar contra otras URLs se agregan acá.
const ORIGENES = ['https://edu-wallet-qm2q.vercel.app', 'https://edu-wallet-tkw2.vercel.app'];
const permitido = ORIGENES.includes(location.origin) || location.hostname === 'localhost';

if (permitido) {
  const suscribir = (canal, cb) => {
    const handler = (_e, dato) => cb(dato);
    ipcRenderer.on(canal, handler);
    return () => ipcRenderer.removeListener(canal, handler);
  };

  contextBridge.exposeInMainWorld('edupassEscritorio', {
    // cb(uid) cada vez que se apoya una tarjeta; devuelve una función para desuscribirse
    onTarjeta: cb => suscribir('edupass:tarjeta', uid => cb(String(uid))),
    // cb({ conectado, lectores, error }) cuando cambia el estado del lector
    onLector: cb => suscribir('edupass:lector', estado => cb(estado)),
    estadoLector: () => ipcRenderer.invoke('edupass:estado-lector'),
  });
}
