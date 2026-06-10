import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useCaja } from '../context/CajaContext'
import api from '../api/axios'

const fmt = n => `$${Number(n).toLocaleString('es-AR')}`

export default function Caja() {
  const { sesion } = useAuth()
  const { caja, abrirCaja, cerrarCaja } = useCaja()
  const [txs, setTxs] = useState([])
  const [misCajas, setMisCajas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [msg, setMsg] = useState(null)
  const [fondoCaja, setFondoCaja] = useState('500')
  const [local, setLocal] = useState('Kiosco')

  const showMsg = (tipo, texto) => { setMsg({ tipo, texto }); setTimeout(() => setMsg(null), 3000) }

  useEffect(() => { cargar() }, [])

  const cargar = async () => {
    try {
      const [tRes, cRes] = await Promise.all([api.get('/transacciones'), api.get('/cajas')])
      setTxs(tRes.data.data ?? tRes.data)
      setMisCajas(cRes.data.filter(c => c.empleado_id === sesion.id))
    } catch (err) { console.error(err) } finally { setCargando(false) }
  }

  const handleAbrirCaja = async () => {
    try { await abrirCaja(local, fondoCaja); showMsg('ok', `Caja abierta en ${local}`); cargar() }
    catch (err) { showMsg('error', 'Error al abrir caja') }
  }

  const handleCerrarCaja = async () => {
    if (!confirm(`¿Cerrar caja? Total del turno: ${fmt(caja?.ventas || 0)}`)) return
    try { await cerrarCaja(); showMsg('ok', `Caja cerrada. Total: ${fmt(caja?.ventas || 0)}`); cargar() }
    catch (err) { showMsg('error', 'Error al cerrar caja') }
  }

  const txsCaja = caja ? txs.filter(t => {
    const inicio = new Date(caja.apertura)
    const fin = caja.cierre ? new Date(caja.cierre) : new Date()
    const fecha = new Date(t.fecha)
    return t.lugar === caja.local && fecha >= inicio && fecha <= fin
  }) : []

  const totalEfectivo = parseFloat(caja?.fondo || 0) + parseFloat(caja?.ventas || 0)

  if (cargando) return <div style={{ color: 'var(--text-tertiary)' }}>Cargando...</div>

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, margin: '0 0 4px', color: 'var(--text)' }}>Caja</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: 0 }}>Control de turno y arqueo</p>
      </div>

      {msg && <div style={{ padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16, background: msg.tipo === 'ok' ? 'var(--green-bg)' : 'var(--red-bg)', color: msg.tipo === 'ok' ? 'var(--green)' : 'var(--red)', borderLeft: `3px solid ${msg.tipo === 'ok' ? 'var(--green)' : 'var(--red)'}` }}>{msg.texto}</div>}

      {caja ? (
        <div style={{ marginBottom: 24 }}>
          <div style={{ background: 'var(--green-bg)', borderRadius: 16, padding: '1.5rem', border: '1px solid var(--green)', marginBottom: 16, opacity: 0.95 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--green)' }} />
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--green)' }}>Caja abierta — {caja.local}</span>
                </div>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--green)' }}>Apertura: {new Date(caja.apertura).toLocaleString('es-AR')}</p>
              </div>
              <button onClick={handleCerrarCaja} style={{ padding: '8px 18px', border: 'none', borderRadius: 10, background: 'var(--red)', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cerrar caja</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
              {[
                { label: 'Fondo inicial', value: fmt(caja.fondo) },
                { label: 'Ventas del turno', value: fmt(caja.ventas || 0), color: 'var(--green)' },
                { label: 'Transacciones', value: caja.tx_count || 0 },
                { label: 'Total en caja', value: fmt(totalEfectivo) },
              ].map(s => (
                <div key={s.label} style={{ background: 'var(--bg-card)', borderRadius: 10, padding: '10px 12px', border: '1px solid var(--border)' }}>
                  <p style={{ margin: '0 0 2px', fontSize: 11, color: 'var(--text-secondary)' }}>{s.label}</p>
                  <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: s.color || 'var(--text)' }}>{s.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
              <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Últimas ventas del turno</h2>
            </div>
            {txsCaja.length === 0
              ? <p style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>Sin ventas aún</p>
              : txsCaja.slice(0, 8).map(t => (
                <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 16px', borderBottom: '1px solid var(--border-light)' }}>
                  <div>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{t.alumno_nombre}</p>
                    <p style={{ margin: 0, fontSize: 11, color: 'var(--text-tertiary)' }}>{t.descripcion} · {new Date(t.fecha).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{fmt(t.monto)}</span>
                </div>
              ))}
          </div>
        </div>
      ) : (
        <div style={{ background: 'var(--bg-card)', borderRadius: 16, padding: '1.5rem', border: '1px solid var(--border)', marginBottom: 24, boxShadow: 'var(--shadow)' }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 6px', color: 'var(--text)' }}>Sin caja abierta</h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 16px' }}>Abrí una caja para empezar a cobrar.</p>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.5px' }}>Local</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {['Kiosco', 'Librería'].map(l => (
                <button key={l} onClick={() => setLocal(l)} style={{ flex: 1, padding: '10px', border: `1.5px solid ${local === l ? 'var(--brand)' : 'var(--border)'}`, borderRadius: 10, background: local === l ? 'var(--brand)' : 'var(--bg-card)', color: local === l ? 'white' : 'var(--text-secondary)', fontSize: 14, fontWeight: local === l ? 600 : 400, cursor: 'pointer' }}>{l}</button>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.5px' }}>Fondo inicial</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              {[500, 1000, 2000].map(n => (
                <button key={n} onClick={() => setFondoCaja(String(n))} style={{ flex: 1, padding: '9px', border: `1.5px solid ${fondoCaja == n ? 'var(--brand)' : 'var(--border)'}`, borderRadius: 9, background: fondoCaja == n ? 'var(--brand)' : 'var(--bg-card)', color: fondoCaja == n ? 'white' : 'var(--text-secondary)', fontSize: 13, cursor: 'pointer' }}>{fmt(n)}</button>
              ))}
            </div>
            <input type="number" value={fondoCaja} onChange={e => setFondoCaja(e.target.value)} placeholder="Otro monto" />
          </div>
          <button onClick={handleAbrirCaja} style={{ width: '100%', padding: '14px', border: 'none', borderRadius: 12, background: 'var(--green)', color: 'white', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>Abrir caja</button>
        </div>
      )}

      <div style={{ background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Mis turnos anteriores</h2>
        </div>
        {misCajas.filter(c => !c.abierta).length === 0
          ? <p style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>Sin turnos anteriores</p>
          : misCajas.filter(c => !c.abierta).map(c => (
            <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--border-light)', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <p style={{ margin: '0 0 2px', fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{c.local}</p>
                <p style={{ margin: 0, fontSize: 11, color: 'var(--text-tertiary)' }}>
                  {new Date(c.apertura).toLocaleString('es-AR')}{c.cierre && ` → ${new Date(c.cierre).toLocaleString('es-AR')}`}
                </p>
                <p style={{ margin: 0, fontSize: 11, color: 'var(--text-tertiary)' }}>Fondo: {fmt(c.fondo)} · {c.tx_count} transacciones</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{fmt(c.ventas)}</p>
                <p style={{ margin: 0, fontSize: 11, color: 'var(--text-tertiary)' }}>Total vendido</p>
              </div>
            </div>
          ))}
      </div>
    </div>
  )
}