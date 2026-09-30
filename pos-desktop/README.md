# EduPass POS para Windows

App de escritorio del punto de venta. Abre el POS publicado (así cada cambio
del POS llega solo, sin reinstalar) y le pasa las tarjetas que lee un lector
NFC **PC/SC**, como el **ACR122U**, que el navegador no puede usar.

Desde el menú **EduPass → Panel admin (asignar tarjetas)** se abre el panel
admin en la misma app, para asignar las tarjetas con el mismo lector.

## Instalar en la PC de cobro

1. Ejecutá `EduPass POS Setup 1.0.0.exe`.
   - Como el instalador todavía no está firmado, Windows puede mostrar
     *"Windows protegió su PC"*: tocá **Más información → Ejecutar de todas formas**.
2. Enchufá el lector ACR122U por USB. Windows instala el driver solo (es un
   lector estándar) y el lector hace un *bip* al apoyar una tarjeta.
3. Abrí **EduPass POS** (queda un acceso directo en el escritorio). La app
   se inicia sola con Windows; se puede desactivar en
   **EduPass → Iniciar con Windows**.
4. En la pantalla de Venta tiene que decir **"● Lector listo: ACS ACR122…"**.
   El estado también se ve en **Lector → Estado del lector**.

Atajos: **F11** pantalla completa, **Ctrl+1** POS, **Ctrl+2** panel admin,
**Ctrl + / Ctrl -** agrandar / achicar.

## Desarrollo

```bash
npm install
npm start            # abre la app contra el POS publicado
npm test             # tests del lector (con la API de Windows simulada)
npm run dist         # genera dist/EduPass POS Setup x.y.z.exe
```

Variables de entorno útiles:

- `EDUPASS_POS_URL` / `EDUPASS_ADMIN_URL`: abrir otra URL (por ejemplo el
  POS local `http://localhost:5173`).
- `EDUPASS_SIMULAR_TARJETA=04A23F1B`: sin lector, "apoya" esa tarjeta cada
  8 segundos (para probar o hacer demos).

## Cómo funciona

- `src/lector.js`: lee el lector con la API PC/SC de Windows (`winscard.dll`)
  vía [koffi](https://koffi.dev) (sin compilar nada). Cada ~300 ms pide el
  número de la tarjeta (`FF CA 00 00 00`) y avisa una vez por apoyo.
- `src/preload.js`: expone a la página `window.edupassEscritorio`
  (`onTarjeta`, `onLector`, `estadoLector`). El POS y el panel admin lo usan
  desde `useLectorTarjeta` / `useLectorEscritorio`.
- `src/main.js`: ventanas, menú, inicio con Windows y bloqueo de cualquier URL
  que no sea el POS o el panel admin (los demás links se abren en el
  navegador).
