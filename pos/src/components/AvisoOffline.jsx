import { useEffect, useState } from 'react'
import Icono from './Icono'
import { offlineHabilitado, faltaInstalarEnIOS, useOffline } from '../offline/estado'
import { sincronizar } from '../offline/sync'
import useAncho, { ANCHO_CELULAR } from '../hooks/useAncho'

// Barra del modo offline arriba del contenido: sin internet, subiendo ventas,
// ventas con error o "se sincronizaron N ventas" (unos segundos)
export default function AvisoOffline() {
  const { online, pendientes, conError, sincronizando, ultimaSync } = useOffline()
  const movil = useAncho() < ANCHO_CELULAR
  // El aviso de "se subieron" se ve 8 segundos; el timer sólo fuerza a redibujar
  const [ahora, setAhora] = useState(() => Date.now())
  useEffect(() => {
    if (!ultimaSync) return
    const t = setTimeout(() => setAhora(Date.now()), 8100)
    return () => clearTimeout(t)
  }, [ultimaSync])
  const verListo = !!ultimaSync && Date.parse(ultimaSync.cuando) + 8000 > ahora

  if (!offlineHabilitado()) {
    // iPhone/iPad sin instalar: sin internet no puede cobrar; se le dice cómo instalarlo
    if (!online && faltaInstalarEnIOS()) {
      return <div role="status" style={{ margin: movil ? '10px 16px 0' : '14px 24px 0', padding: '10px 14px', borderRadius: 8, background: 'var(--red-bg)', color: 'var(--red)', borderLeft: '3px solid var(--red)', fontSize: 13 }}>
        <Icono nombre="alerta" /><b>Sin internet.</b> Para cobrar sin conexión en iPhone o iPad, instalá el POS: botón Compartir → <b>Agregar a inicio</b>, y abrilo desde ese ícono.
      </div>
    }
    return null
  }

  const barra = (fondo, color, contenido, extra) => (
    <div role="status" style={{ margin: movil ? '10px 16px 0' : '14px 24px 0', padding: '10px 14px', borderRadius: 8, background: fondo, color, borderLeft: `3px solid ${color}`, fontSize: 13, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <span style={{ flex: 1, minWidth: 200 }}>{contenido}</span>
      {extra}
    </div>
  )
  const s = n => (n === 1 ? '' : 's')

  return <>
    {!online && barra('var(--amber-bg)', 'var(--amber)', <>
      <Icono nombre="alerta" /><b>Sin internet.</b> Podés seguir cobrando: las ventas quedan guardadas en esta caja y se suben solas cuando vuelva la conexión
      {pendientes > 0 && <> · <b>{pendientes} venta{s(pendientes)} sin subir</b></>}.
    </>)}
    {online && pendientes > 0 && barra('var(--brand-light)', 'var(--brand)', <>
      {sincronizando ? 'Subiendo' : 'Por subir'} <b>{pendientes} venta{s(pendientes)}</b> hecha{s(pendientes)} sin internet…
    </>, !sincronizando && (
      <button onClick={() => sincronizar()} style={{ padding: '6px 12px', border: 'none', borderRadius: 8, background: 'var(--brand)', color: 'var(--on-brand)', fontSize: 12, fontWeight: 600 }}>Subir ahora</button>
    ))}
    {conError > 0 && barra('var(--red-bg)', 'var(--red)', <>
      <Icono nombre="alerta" /><b>{conError} venta{s(conError)} sin conexión no se pudo registrar.</b> Quedaron guardadas en esta caja: avisá al administrador.
    </>)}
    {online && pendientes === 0 && verListo && ultimaSync && barra('var(--green-bg)', 'var(--green)', <>
      ✓ Se subieron <b>{ultimaSync.cantidad} venta{s(ultimaSync.cantidad)}</b> hecha{s(ultimaSync.cantidad)} sin internet: saldos, stock y caja ya están al día.
    </>)}
  </>
}
