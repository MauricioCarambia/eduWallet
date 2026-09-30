import { useState, useEffect, useRef } from 'react'
import api from '../api/axios'
import useLectorTarjeta, { nfcDisponible, escucharNfc, useLectorEscritorio } from '../hooks/useLectorTarjeta'

// Asignación de tarjetas NFC a alumnos. Se puede leer la tarjeta con un
// lector USB (en cualquier computadora) o con el NFC del celular/tablet
// (Chrome en Android). El backend reconoce el número en cualquier formato.

function Ventana({ title, onClose, children }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
      <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', width: '100%', maxWidth: 460, maxHeight: '90vh', overflowY: 'auto', border: '1.5px solid var(--border)', boxShadow: 'var(--shadow-md)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, color: 'var(--text-secondary)', cursor: 'pointer' }}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

const btn = (primario) => ({
  padding: '8px 16px', borderRadius: 'var(--radius)', fontSize: 13, fontWeight: primario ? 600 : 500, cursor: 'pointer',
  border: primario ? 'none' : '1.5px solid var(--border)', background: primario ? '#1E3A5F' : 'var(--bg-card)', color: primario ? 'white' : 'var(--text-secondary)',
})

const Aviso = ({ msg }) => msg && (
  <div style={{ padding: '10px 12px', borderRadius: 'var(--radius)', fontSize: 13, marginBottom: 12, fontWeight: 500, background: msg.tipo === 'ok' ? 'var(--green-bg)' : 'var(--red-bg)', color: msg.tipo === 'ok' ? 'var(--green)' : 'var(--red)' }}>{msg.texto}</div>
)

// Zona de lectura: escucha el lector USB y, si hay, el NFC del dispositivo
function Lector({ onLeer, ocupado }) {
  const [nfcActivo, setNfcActivo] = useState(false)
  const [errorNfc, setErrorNfc] = useState(null)
  const abortRef = useRef(null)

  useLectorTarjeta(uid => { if (!ocupado) onLeer(uid) })
  const lectorEscritorio = useLectorEscritorio()
  useEffect(() => () => abortRef.current?.abort(), [])

  const activarNfc = async () => {
    try {
      abortRef.current?.abort()
      const ctrl = new AbortController()
      abortRef.current = ctrl
      await escucharNfc(uid => onLeer(uid), ctrl.signal)
      setNfcActivo(true); setErrorNfc(null)
    } catch (err) { setErrorNfc('No se pudo activar el NFC: ' + err.message) }
  }

  return (
    <div style={{ padding: '18px 14px', border: '2px dashed var(--border)', borderRadius: 12, background: 'var(--bg)', textAlign: 'center', marginBottom: 12 }}>
      <div style={{ fontSize: 28, marginBottom: 6 }}>💳</div>
      <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{ocupado ? 'Guardando...' : 'Pasá la tarjeta por el lector'}</p>
      {lectorEscritorio.disponible
        ? <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: lectorEscritorio.conectado ? 'var(--green)' : 'var(--amber)' }}>{lectorEscritorio.conectado ? `● Lector listo: ${lectorEscritorio.lectores[0]}` : '● Conectá el lector NFC por USB'}</p>
        : <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>Lector USB: no hace falta hacer clic en ningún lado.</p>}
      {nfcDisponible() && (
        nfcActivo
          ? <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--green)', fontWeight: 600 }}>NFC activo — acercá la tarjeta al dispositivo</p>
          : <button onClick={activarNfc} style={{ ...btn(false), marginTop: 10 }}>📶 Leer con el NFC de este dispositivo</button>
      )}
      {errorNfc && <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--red)' }}>{errorNfc}</p>}
    </div>
  )
}

const errorDe = err => err.response?.data?.error || 'Error al guardar la tarjeta'

// Tarjeta de un alumno: asignar, reemplazar o quitar
export function ModalTarjeta({ alumno, onClose, onActualizado }) {
  const [guardando, setGuardando] = useState(false)
  const [msg, setMsg] = useState(null)

  const asignar = async uid => {
    setGuardando(true); setMsg(null)
    try {
      const res = await api.put(`/alumnos/${alumno.id}/tarjeta`, { uid })
      onActualizado(res.data)
      setMsg({ tipo: 'ok', texto: `✓ Tarjeta asignada a ${alumno.nombre}` })
      setTimeout(onClose, 1200)
    } catch (err) { setMsg({ tipo: 'error', texto: errorDe(err) }) }
    finally { setGuardando(false) }
  }

  const quitar = async () => {
    if (!confirm(`¿Quitar la tarjeta de ${alumno.nombre}? Deja de funcionar en el acto (el saldo no se pierde).`)) return
    try {
      const res = await api.delete(`/alumnos/${alumno.id}/tarjeta`)
      onActualizado(res.data)
      setMsg({ tipo: 'ok', texto: 'Tarjeta quitada' })
    } catch (err) { setMsg({ tipo: 'error', texto: errorDe(err) }) }
  }

  return (
    <Ventana title={`Tarjeta — ${alumno.nombre}`} onClose={onClose}>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 12px' }}>
        {alumno.nfc_uid
          ? <>Tiene la tarjeta <b style={{ fontFamily: 'monospace', color: 'var(--text)' }}>{alumno.nfc_uid}</b>. Si pasás otra, reemplaza a la anterior.</>
          : 'Todavía no tiene tarjeta asignada.'}
      </p>
      <Aviso msg={msg} />
      <Lector onLeer={asignar} ocupado={guardando} />
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        {alumno.nfc_uid && <button onClick={quitar} style={{ ...btn(false), color: 'var(--red)', borderColor: 'var(--red)' }}>Quitar tarjeta</button>}
        <button onClick={onClose} style={btn(false)}>Cerrar</button>
      </div>
    </Ventana>
  )
}

// Asignación rápida: recorre los alumnos de un curso y se va pasando una tarjeta por alumno
export function ModalAsignarTarjetas({ alumnos, onClose, onActualizado }) {
  const cursos = ['Todos', ...new Set(alumnos.map(a => a.curso))]
  const [curso, setCurso] = useState('Todos')
  const [soloSinTarjeta, setSoloSinTarjeta] = useState(true)
  const [cola, setCola] = useState(null) // ids a recorrer (se fija al empezar)
  const [indice, setIndice] = useState(0)
  const [asignadas, setAsignadas] = useState(0)
  const [guardando, setGuardando] = useState(false)
  const [msg, setMsg] = useState(null)

  const candidatos = alumnos.filter(a => a.activo && (curso === 'Todos' || a.curso === curso) && (!soloSinTarjeta || !a.nfc_uid))
  const actual = cola && alumnos.find(a => a.id === cola[indice])
  const terminado = cola && indice >= cola.length

  const empezar = () => { setCola(candidatos.map(a => a.id)); setIndice(0); setAsignadas(0); setMsg(null) }

  const asignar = async uid => {
    if (!actual) return
    setGuardando(true)
    try {
      const res = await api.put(`/alumnos/${actual.id}/tarjeta`, { uid })
      onActualizado(res.data)
      setMsg({ tipo: 'ok', texto: `✓ ${actual.nombre}` })
      setAsignadas(n => n + 1)
      setIndice(i => i + 1)
    } catch (err) { setMsg({ tipo: 'error', texto: errorDe(err) }) }
    finally { setGuardando(false) }
  }

  return (
    <Ventana title="Asignar tarjetas" onClose={onClose}>
      {!cola ? (
        <>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 14px' }}>
            El sistema te va mostrando los alumnos de a uno: pasá una tarjeta nueva por el lector y pasa solo al siguiente.
          </p>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.5px' }}>Curso</label>
          <select value={curso} onChange={e => setCurso(e.target.value)} style={{ width: '100%', marginBottom: 12 }}>
            {cursos.map(c => <option key={c}>{c}</option>)}
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16, cursor: 'pointer' }}>
            <input type="checkbox" checked={soloSinTarjeta} onChange={e => setSoloSinTarjeta(e.target.checked)} />
            Sólo alumnos sin tarjeta
          </label>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginRight: 'auto' }}>{candidatos.length} alumnos</span>
            <button onClick={onClose} style={btn(false)}>Cancelar</button>
            <button onClick={empezar} disabled={candidatos.length === 0} style={{ ...btn(true), opacity: candidatos.length ? 1 : 0.5 }}>Empezar</button>
          </div>
        </>
      ) : terminado ? (
        <>
          <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', margin: '0 0 6px' }}>¡Listo!</p>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 16px' }}>Se asignaron {asignadas} de {cola.length} tarjetas.</p>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button onClick={onClose} style={btn(true)}>Cerrar</button></div>
        </>
      ) : (
        <>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '0 0 6px' }}>Alumno {indice + 1} de {cola.length}</p>
          <div style={{ padding: '12px 14px', borderRadius: 'var(--radius)', background: 'var(--brand-light)', marginBottom: 12 }}>
            <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{actual?.nombre}</p>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>{actual?.curso}{actual?.nfc_uid ? ' · ya tiene tarjeta (se reemplaza)' : ''}</p>
          </div>
          <Aviso msg={msg} />
          <Lector onLeer={asignar} ocupado={guardando} />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => { setIndice(i => i + 1); setMsg(null) }} style={btn(false)}>Saltear</button>
            <button onClick={onClose} style={btn(false)}>Terminar</button>
          </div>
        </>
      )}
    </Ventana>
  )
}
