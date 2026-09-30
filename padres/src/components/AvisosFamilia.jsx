import { useState, useEffect } from 'react'
import api from '../api/axios'
import { tarjeta, tituloTarjeta, ayuda, etiqueta, botonGuardar } from './controlEstilos'
import { Interruptor } from './ControlUI'

// Qué avisos recibe este padre (para todos sus hijos) y por qué medio
export default function AvisosFamilia({ showMsg }) {
  const [p, setP] = useState(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    api.get('/padres/notificaciones').then(r => setP({
      ...r.data,
      notif_compras_minimo: String(Number(r.data.notif_compras_minimo)),
      umbral_saldo_bajo: String(Number(r.data.umbral_saldo_bajo)),
    })).catch(() => {})
  }, [])

  if (!p) return null
  const cambiar = (k, v) => setP(prev => ({ ...prev, [k]: v }))

  const guardar = async () => {
    if (!p.notif_email && !p.notif_push) return showMsg('error', 'Elegí al menos un medio: email o notificaciones en el celular')
    setGuardando(true)
    try {
      await api.put('/padres/notificaciones', { ...p, notif_compras_minimo: Number(p.notif_compras_minimo) || 0, umbral_saldo_bajo: Number(p.umbral_saldo_bajo) || 0 })
      showMsg('ok', 'Avisos guardados')
    } catch (err) {
      showMsg('error', err.response?.data?.error || 'No se pudieron guardar los avisos')
    } finally { setGuardando(false) }
  }

  return (
    <div style={tarjeta}>
      <h2 style={tituloTarjeta}>Avisos</h2>
      <p style={ayuda}>Valen para todos tus hijos. Las devoluciones de recargas te las avisamos siempre.</p>

      <label htmlFor="notif-compras" style={{ ...etiqueta, marginTop: 4 }}>Compras</label>
      <select id="notif-compras" value={p.notif_compras} onChange={e => cambiar('notif_compras', e.target.value)}>
        <option value="todas">Avisarme cada compra</option>
        <option value="mayores">Solo compras grandes</option>
        <option value="ninguna">No avisarme compras</option>
      </select>
      {p.notif_compras === 'mayores' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
          <label htmlFor="notif-minimo">Desde $</label>
          <input id="notif-minimo" type="number" min="0" value={p.notif_compras_minimo} onChange={e => cambiar('notif_compras_minimo', e.target.value)} style={{ flex: 1 }} />
        </div>
      )}

      <div style={{ marginTop: 12 }}>
        <Interruptor id="notif-saldo" activo={p.notif_saldo_bajo} onChange={v => cambiar('notif_saldo_bajo', v)} titulo="Saldo bajo" detalle="Una vez, cuando baja del monto que elijas" />
        {p.notif_saldo_bajo && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 8px', fontSize: 13, color: 'var(--text-secondary)' }}>
            <label htmlFor="notif-umbral">Cuando quede menos de $</label>
            <input id="notif-umbral" type="number" min="0" value={p.umbral_saldo_bajo} onChange={e => cambiar('umbral_saldo_bajo', e.target.value)} style={{ flex: 1 }} />
          </div>
        )}
        <Interruptor id="notif-rechazos" activo={p.notif_rechazos} onChange={v => cambiar('notif_rechazos', v)} titulo="Compras no permitidas" detalle="Si intenta comprar algo que bloqueaste o con un alérgeno" />
        <Interruptor id="notif-bloqueos" activo={p.notif_bloqueos} onChange={v => cambiar('notif_bloqueos', v)} titulo="Credencial o tarjeta bloqueada" detalle="Si otro familiar bloquea o desbloquea algo" />
      </div>

      <span style={etiqueta}>Cómo avisarte</span>
      <Interruptor id="notif-email" activo={p.notif_email} onChange={v => cambiar('notif_email', v)} titulo="Por email" />
      <Interruptor id="notif-push" activo={p.notif_push} onChange={v => cambiar('notif_push', v)} titulo="Notificaciones en el celular" detalle="Hay que permitirlas en el navegador la primera vez" />

      <button onClick={guardar} disabled={guardando} style={{ ...botonGuardar, opacity: guardando ? 0.6 : 1 }}>{guardando ? 'Guardando...' : 'Guardar avisos'}</button>
    </div>
  )
}
