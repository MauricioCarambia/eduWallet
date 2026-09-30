# Design system de KoleTap

Fuente de verdad visual para admin, padres, pos y landing. Versión navegable (componentes, logos, íconos):
https://claude.ai/code/artifact/dfcc9941-f153-4e9e-84a8-59d75323695a

## Reglas

- **Nunca escribas colores a mano** en JSX o CSS. Usá siempre las variables: `var(--brand)`, `var(--text)`, etc. Si falta una, agregala a los tres `index.css` (admin, padres, pos) en `:root` y en `[data-theme="dark"]`.
- **Todo color tiene valor claro y oscuro.** El tema se cambia con `data-theme` en `<html>` (guardado en `koletap_theme`). Probá cada cambio en los dos modos.
- **Un solo protagonista:** `--brand` (verde profundo) para acciones principales y estados activos. Lo que va encima de `--brand` usa `--on-brand`, nunca `white`.
- **El dorado es un detalle:** `--accent` para foco, viñetas y destacados. Nunca como color de texto sobre fondo claro (contraste 3:1).
- **Estados siempre con palabra o ícono:** `--green`/`--red`/`--amber` sobre su `-bg`, más un texto ("Activa", "Bloqueada"). El verde de éxito se parece a `--brand`.
- **Contraste mínimo:** texto 4.5:1, íconos y bordes que significan algo 3:1, en los dos modos.
- **Excepciones permitidas:** verde WhatsApp `#25D366` y celeste Mercado Pago `#009EE3` en sus botones; la credencial impresa usa hex fijos (los valores claros de la paleta) para imprimir igual en cualquier tema.

## Colores

| Variable | Claro | Oscuro | Uso |
|---|---|---|---|
| `--bg` | `#f6f7f5` | `#0e1412` | Fondo de página |
| `--bg-card` | `#ffffff` | `#161e1b` | Tarjetas, modales, botón secundario |
| `--bg-hover` | `#f0f2ef` | `#1c2521` | Hover de filas e ítems |
| `--bg-input` | `#ffffff` | `#161e1b` | Relleno de inputs |
| `--bg-subtle` | `#eef0ed` | `#1c2521` | Cajas neutras suaves (chips, tile de gasto, avisos) |
| `--text` | `#16211d` | `#e8ede9` | Texto principal |
| `--text-secondary` | `#5b6660` | `#9aa6a0` | Labels, metadatos, botón secundario |
| `--text-tertiary` | `#6b7670` | `#7a8680` | Ayudas y placeholders, solo sobre tarjetas y ≥12px |
| `--border` | `#dfe3df` | `#2a3531` | Bordes de tarjetas e inputs |
| `--border-light` | `#eceee9` | `#212b27` | Divisores entre filas |
| `--brand` | `#1d5c47` | `#6cc6a0` | Primario: botones, chips activos, nav activa, links |
| `--on-brand` | `#ffffff` | `#0e1412` | Texto/íconos sobre `brand` (oscuro en modo oscuro) |
| `--brand-light` | `#e7f0eb` | `#1b2a24` | Tinte de selección, fondo de avatares |
| `--brand-deep` | `#173f33` | `#12302a` | Paneles oscuros grandes (sidebar, sección seguridad) |
| `--accent` | `#b8871f` | `#e2b54a` | Dorado: anillo de foco, bordes de input en foco, viñetas. Nunca texto |
| `--on-accent` | `#241c00` | `#241c00` | Texto sobre relleno `accent` |
| `--green` | `#1f7a4d` | `#5cc497` | Éxito, saldo positivo |
| `--green-bg` | `#e8f3ec` | `#14271e` | Fondo de éxito |
| `--red` | `#b3372f` | `#ef7d74` | Error, saldo bajo, bloqueado |
| `--red-bg` | `#fbeceb` | `#2c1715` | Fondo de error |
| `--amber` | `#9a5b12` | `#e6a15c` | Advertencia |
| `--amber-bg` | `#fbf1e3` | `#2a1f12` | Fondo de advertencia |
| `--sidebar-bg` | `{brand-deep}` | `{brand-deep}` | Barra lateral (= `brand-deep`) |
| `--sidebar-text` | `rgba(255,255,255,.72)` | igual | Texto e íconos del menú lateral (admin, pos) |
| `--sidebar-active` | `rgba(255,255,255,.14)` | igual | Fondo del ítem activo del menú lateral |
| `--sidebar-border` | `rgba(255,255,255,.08)` | igual | Divisores y bordes de botones en el menú lateral |
| `--sidebar-ok` / `--sidebar-ok-bg` | `#5cc497` / `rgba(92,196,151,.15)` | igual | Caja abierta en el menú lateral del POS |
| `--sidebar-error` / `--sidebar-error-bg` | `#ef7d74` / `rgba(239,125,116,.15)` | igual | Caja cerrada en el menú lateral del POS |
| `--overlay` | `rgba(14,20,18,.55)` | `rgba(0,0,0,.65)` | Fondo detrás de modales y del visor |
| `--shadow-brand` | `0 4px 14px rgba(29,92,71,.3)` | `0 4px 14px rgba(0,0,0,.45)` | Resplandor del logo del login y del botón principal destacado |
| `--logo-bg` | `#ffffff` | `#ffffff` | Fondo detrás del logo que sube cada colegio (suelen venir sobre blanco) |

El menú lateral es verde profundo en los dos temas, por eso sus variables no cambian con el tema. La pantalla de SuperAdmin es siempre oscura: su elemento raíz lleva `data-theme="dark"` y usa las mismas variables.

**Ícono de la app:** el monograma K (ver [Logo](#logo)) en `favicon.svg` de las tres apps, `padres/public/icon.svg` (app instalable) y `pos-desktop/build/icon.png` (512×512, rasterizado del mismo SVG).

La landing (`landing/index.html`) usa sus propios nombres con los mismos valores: `--papel`=`bg`, `--papel-2`=`bg-subtle`, `--tinta`=`text`, `--tinta-suave`=`text-secondary`, `--pizarron`=`brand`, `--pizarron-fondo`=`brand-deep`, `--lapiz`=`accent`, `--sobre-lapiz`=`on-accent`, `--linea`=`border`, `--tarjeta`=`bg-card`, `--bien`/`--ojo`/`--no`=`green`/`amber`/`red`.

Gráficos (Recharts): serie principal `var(--brand)`, segunda `var(--accent)`; paleta categórica en `COLORES` de `admin/src/pages/Reportes.jsx`.

## Tipografía

- **Apps:** fuente del sistema (`-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`). Cuerpo 14px/1.5 (POS 15px). Pesos 400/500/600/700. Títulos 600–700, máximo 26px (valor de StatCard).
- Labels de formulario: 12px/600, MAYÚSCULAS, `letter-spacing: .5px`, `--text-secondary`. Overline de StatCard: 11px/600.
- **Landing:** títulos en Anybody (900, `font-stretch` 78–90%), texto en Atkinson Hyperlegible, etiquetas en IBM Plex Mono (Google Fonts).
- Montos: `$` + miles es-AR, sin decimales (`$8.450`).

## Forma y espacio

- Radios: `--radius` 10px (inputs, botones), `--radius-lg` 16px (tarjetas), 8px (alertas, nav), 6px (badges), 20px (chips), 999px (pills de la landing).
- Bordes antes que sombras: tarjetas con 1–1.5px `--border` + `--shadow`; `--shadow-md` solo para login y paneles elevados.
- Espaciado frecuente: 6, 8, 10, 12, 16px; padding de tarjeta 1.25rem. Padres es una columna de 480px; admin tiene sidebar de 230px.
- Foco: `outline: var(--focus-ring)` (3px dorado) con `outline-offset: 2px`; en la sidebar el anillo es blanco.

## Componentes (patrones)

- **Botón primario:** `background: var(--brand); color: var(--on-brand); border-radius: 10px; padding: 10px 20px; font-weight: 500–600`.
- **Botón secundario:** `background: var(--bg-card); border: 1.5px solid var(--border); color: var(--text-secondary)`.
- **Alerta:** `padding: 10px 14px; border-radius: 8px; font-size: 13px; border-left: 3px solid` del color de estado, sobre su `-bg`.
- **Badge:** 11px/500, `padding: 3px 8px`, radio 6px, color de estado sobre su `-bg`.
- **Chip:** radio 20px, `1.5px solid var(--border)`; activo con `--brand` de fondo y `--on-brand`.
- **Tarjeta:** `var(--bg-card)`, radio 16px, `1px solid var(--border)`, `var(--shadow)`, padding 1.25rem.
- **Íconos:** SVG inline 24×24, trazo 2px, sin relleno, `stroke="currentColor"`; 18px en navegación, 16px en botones. En cada app, `src/components/Icono.jsx` (`<Icono nombre="alerta" />`: alerta, tarjeta, imprimir, nfc, descargar, subir, candado, candadoAbierto, prohibido, ubicacion, familia, buscar, camara).

## Tono

Español rioplatense con voseo ("Recargá", "Vinculá", "Enterate"). Frases cortas y concretas. Mayúsculas de oración en títulos y botones. Sin emojis en la interfaz.

## Logo

- Monograma **K** sobre cuadrado verde `#1D5C47` (radio 14/64): trazo blanco y pierna dorada `#E2B54A`. Wordmark **KoleTap** en Anybody 900 al 80% de ancho, "Tap" en `--brand`.
- Archivos en `brand/`: `koletap-icon.svg` (cuadrado solo), `koletap-icon-512.svg`, `koletap-logo-light.svg` / `koletap-logo-dark.svg` (logo completo), `koletap-k-on-green.svg` (K sin fondo, para usar sobre verde).
- En las apps el ícono es `/favicon.svg` (login, sidebar sin logo del colegio, pestaña). En la PWA de padres es `/icon.svg`. En la landing va inline en `.marca`.
- No recolorear la K ni ponerla sobre dorado. Debajo de 20px usá solo el ícono.
