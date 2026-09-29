// EduWallet POS para Windows: abre el POS publicado (se actualiza solo) y le
// pasa las tarjetas que lee el ACR122U (o cualquier lector PC/SC).
const path = require('path');
const fs = require('fs');
const { app, BrowserWindow, Menu, ipcMain, shell } = require('electron');
const { iniciarLector } = require('./lector');

const POS_URL = process.env.EDUWALLET_POS_URL || 'https://edu-wallet-qm2q.vercel.app';
const ADMIN_URL = process.env.EDUWALLET_ADMIN_URL || 'https://edu-wallet-tkw2.vercel.app';
const ORIGENES_PERMITIDOS = [new URL(POS_URL).origin, new URL(ADMIN_URL).origin];

let ventanaPos = null;
let ventanaAdmin = null;
let estadoLector = { conectado: false, lectores: [], error: null };

if (!app.requestSingleInstanceLock()) {
  app.quit();
}

const ventanas = () => [ventanaPos, ventanaAdmin].filter(v => v && !v.isDestroyed());

const esPermitida = url => {
  try { return ORIGENES_PERMITIDOS.includes(new URL(url).origin); } catch { return false; }
};

function crearVentana(url, titulo) {
  const v = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: titulo,
    backgroundColor: '#F0F4F8',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });
  v.once('ready-to-show', () => { v.maximize(); v.show(); });

  // Sólo el POS y el panel admin se abren adentro; cualquier otro link
  // (ej. conectar Mercado Pago) se abre en el navegador de la PC
  v.webContents.setWindowOpenHandler(({ url }) => {
    if (!esPermitida(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  v.webContents.on('will-navigate', (e, url) => {
    if (!esPermitida(url)) { e.preventDefault(); shell.openExternal(url); }
  });

  // Sin internet: pantalla propia con botón para reintentar
  v.webContents.on('did-fail-load', (_e, codigo, _desc, urlFallida, esPrincipal) => {
    if (!esPrincipal || codigo === -3) return; // -3: navegación cancelada
    v.loadFile(path.join(__dirname, 'sin-conexion.html'), { query: { volver: urlFallida } });
  });

  v.webContents.on('did-finish-load', () => v.webContents.send('eduwallet:lector', estadoLector));
  v.loadURL(url);
  return v;
}

function abrirPos() {
  if (ventanaPos && !ventanaPos.isDestroyed()) { ventanaPos.focus(); return; }
  ventanaPos = crearVentana(POS_URL, 'EduWallet POS');
  ventanaPos.on('closed', () => { ventanaPos = null; });
}

function abrirAdmin() {
  if (ventanaAdmin && !ventanaAdmin.isDestroyed()) { ventanaAdmin.focus(); return; }
  ventanaAdmin = crearVentana(ADMIN_URL, 'EduWallet — Panel admin');
  ventanaAdmin.on('closed', () => { ventanaAdmin = null; });
}

// Arrancar con Windows: activado la primera vez (es la PC de cobro)
function configurarInicioConWindows() {
  const marca = path.join(app.getPath('userData'), 'primer-inicio');
  if (!fs.existsSync(marca)) {
    if (app.isPackaged) app.setLoginItemSettings({ openAtLogin: true });
    try { fs.writeFileSync(marca, new Date().toISOString()); } catch { /* sin permisos: se vuelve a intentar */ }
  }
}

function armarMenu() {
  const iniciaConWindows = app.getLoginItemSettings().openAtLogin;
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {
      label: 'EduWallet',
      submenu: [
        { label: 'Punto de venta', accelerator: 'CmdOrCtrl+1', click: abrirPos },
        { label: 'Panel admin (asignar tarjetas)', accelerator: 'CmdOrCtrl+2', click: abrirAdmin },
        { type: 'separator' },
        { label: 'Iniciar con Windows', type: 'checkbox', checked: iniciaConWindows, enabled: app.isPackaged,
          click: item => app.setLoginItemSettings({ openAtLogin: item.checked }) },
        { type: 'separator' },
        { role: 'quit', label: 'Salir' },
      ],
    },
    {
      label: 'Ver',
      submenu: [
        { role: 'reload', label: 'Recargar' },
        { role: 'togglefullscreen', label: 'Pantalla completa' },
        { type: 'separator' },
        { role: 'zoomIn', label: 'Agrandar' },
        { role: 'zoomOut', label: 'Achicar' },
        { role: 'resetZoom', label: 'Tamaño normal' },
      ],
    },
    {
      label: 'Lector',
      submenu: [
        { label: 'Estado del lector', click: () => {
          const texto = estadoLector.conectado
            ? `Conectado: ${estadoLector.lectores.join(', ')}`
            : estadoLector.error || 'No hay ningún lector conectado. Enchufá el lector NFC por USB.';
          const { dialog } = require('electron');
          dialog.showMessageBox({ type: 'info', title: 'Lector NFC', message: texto });
        } },
      ],
    },
  ]));
}

ipcMain.handle('eduwallet:estado-lector', () => estadoLector);

app.whenReady().then(() => {
  configurarInicioConWindows();
  armarMenu();
  abrirPos();

  const enviarTarjeta = uid => ventanas().forEach(v => v.webContents.send('eduwallet:tarjeta', uid));
  const enviarEstado = estado => {
    estadoLector = estado;
    ventanas().forEach(v => v.webContents.send('eduwallet:lector', estado));
  };

  // Modo simulación (sin lector, para probar o hacer demos):
  //   EDUWALLET_SIMULAR_TARJETA=04A23F1B  -> "apoya" esa tarjeta cada 8 segundos
  if (process.env.EDUWALLET_SIMULAR_TARJETA) {
    enviarEstado({ conectado: true, lectores: ['Lector simulado'], error: null });
    const t = setInterval(() => enviarTarjeta(process.env.EDUWALLET_SIMULAR_TARJETA), 8000);
    app.on('before-quit', () => clearInterval(t));
    return;
  }

  const lector = iniciarLector({ onTarjeta: enviarTarjeta, onEstado: enviarEstado });
  app.on('before-quit', () => lector.detener());
});

app.on('second-instance', () => {
  const v = ventanaPos || ventanaAdmin;
  if (v) { if (v.isMinimized()) v.restore(); v.focus(); } else abrirPos();
});

app.on('window-all-closed', () => app.quit());
