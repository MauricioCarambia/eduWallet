import { useEffect, useState } from 'react'

// Banner para instalar la app en el celular, la tablet o la PC (el mismo archivo
// en admin, padres y POS). Según el navegador:
//  - Chrome / Edge: botón "Instalar" (el navegador muestra su ventana)
//  - iPhone / iPad: cómo agregarla a la pantalla de inicio desde Compartir
//  - Android con otro navegador: abrirla en Chrome e instalarla desde ahí (sólo
//    Chrome lee el NFC del celular y deja instalarla bien)
// No aparece si ya está instalada, en la app de escritorio, ni por 7 días si se cierra.
const CLAVE = 'koletap_instalar_cerrado'
const SIETE_DIAS = 7 * 24 * 60 * 60 * 1000

const ua = () => (typeof navigator === 'undefined' ? '' : navigator.userAgent)
const esIOS = () => /iPad|iPhone|iPod/.test(ua()) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
const esAndroidOtroNavegador = () => /Android/i.test(ua()) && /SamsungBrowser|Firefox|OPR|EdgA|MiuiBrowser|UCBrowser|YaBrowser|DuckDuckGo/i.test(ua())
const instalada = () => window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true
const escritorio = () => !!(window.koletapEscritorio || window.edupassEscritorio || window.eduwalletEscritorio)
const cerradoHace = () => { try { return Date.now() - Number(localStorage.getItem(CLAVE) || 0) } catch { return Infinity } }

// abajo: fijo al pie de la pantalla (POS y admin, que tienen el menú al costado);
// si no, arriba de todo (padres, que tiene el menú abajo)
export default function AvisoInstalar({ nombre = 'la app', abajo = false }) {
  const [evento, setEvento] = useState(null)
  const [oculto, setOculto] = useState(() => instalada() || escritorio() || cerradoHace() < SIETE_DIAS)

  useEffect(() => {
    const alOfrecer = e => { e.preventDefault(); setEvento(e) } // se guarda para mostrarlo con nuestro botón
    const alInstalar = () => { setEvento(null); setOculto(true) }
    window.addEventListener('beforeinstallprompt', alOfrecer)
    window.addEventListener('appinstalled', alInstalar)
    return () => { window.removeEventListener('beforeinstallprompt', alOfrecer); window.removeEventListener('appinstalled', alInstalar) }
  }, [])

  const cerrar = () => { setOculto(true); try { localStorage.setItem(CLAVE, String(Date.now())) } catch { /* sin almacenamiento */ } }
  const instalar = async () => {
    if (!evento) return
    evento.prompt()
    const { outcome } = await evento.userChoice
    if (outcome === 'accepted') setOculto(true)
    setEvento(null)
  }

  if (oculto) return null
  const otroNavegador = esAndroidOtroNavegador()
  const ios = esIOS()
  if (!evento && !ios && !otroNavegador) return null // navegador sin instalación (ej. Firefox de PC)

  const texto = otroNavegador
    ? <>Para instalar {nombre}, abrí esta página en <b>Chrome</b> y tocá el menú ⋮ → <b>Instalar app</b>.</>
    : ios
      ? <>Para instalar {nombre}: tocá <b>Compartir</b> <span aria-hidden="true">(□↑)</span> y después <b>Agregar a inicio</b>.</>
      : <>Instalá {nombre}: abre más rápido, a pantalla completa y desde un ícono.</>

  return (
    <div role="region" aria-label="Instalar la app" style={{
      background: 'var(--brand)', color: 'var(--on-brand)', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10,
      ...(abajo ? { position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 200, paddingBottom: 'max(10px, env(safe-area-inset-bottom))', boxShadow: 'var(--shadow-md)' } : {}),
    }}>
      <img src="/favicon.svg" alt="" width="30" height="30" style={{ display: 'block', flexShrink: 0, borderRadius: 7 }} />
      <p style={{ flex: 1, minWidth: 0, margin: 0, fontSize: 13, lineHeight: 1.4 }}>{texto}</p>
      {evento && !otroNavegador && (
        <button onClick={instalar} style={{ padding: '7px 14px', border: 'none', borderRadius: 8, background: 'var(--on-brand)', color: 'var(--brand)', fontSize: 13, fontWeight: 600, flexShrink: 0 }}>Instalar</button>
      )}
      <button onClick={cerrar} aria-label="Cerrar" style={{ background: 'none', border: 'none', color: 'var(--on-brand)', opacity: 0.85, fontSize: 20, lineHeight: 1, padding: '0 2px', flexShrink: 0 }}>×</button>
    </div>
  )
}
