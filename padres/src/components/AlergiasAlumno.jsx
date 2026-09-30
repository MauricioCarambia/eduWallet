import { useState } from 'react'
import api from '../api/axios'
import { tarjeta, tituloTarjeta, ayuda, etiqueta, botonGuardar } from './controlEstilos'
import { Chip } from './ControlUI'

// Alergias del hijo: el punto de venta avisa (y el cajero tiene que
// confirmar) o directamente no deja vender productos con esos alérgenos
export default function AlergiasAlumno({ alumno, alergenos, onGuardado, showMsg }) {
  const [elegidos, setElegidos] = useState(alumno.alergenos || [])
  const [bloquear, setBloquear] = useState(!!alumno.bloquear_alergenos)
  const [guardando, setGuardando] = useState(false)

  const guardar = async () => {
    setGuardando(true)
    try {
      const res = await api.put(`/padres/alumnos/${alumno.id}/alergias`, { alergenos: elegidos, bloquear_alergenos: bloquear })
      onGuardado(res.data)
      showMsg('ok', 'Alergias guardadas')
    } catch (err) {
      showMsg('error', err.response?.data?.error || 'No se pudieron guardar las alergias')
    } finally { setGuardando(false) }
  }

  const nombre = alumno.nombre.split(' ')[0]
  const opcion = (valor, titulo, detalle) => (
    <label htmlFor={`alergia-${valor}`} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${bloquear === valor ? 'var(--brand)' : 'var(--border)'}`, cursor: 'pointer' }}>
      <input id={`alergia-${valor}`} type="radio" name="modo-alergia" checked={bloquear === valor} onChange={() => setBloquear(valor)} style={{ marginTop: 3, accentColor: 'var(--brand)' }} />
      <span>
        <span style={{ display: 'block', fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>{titulo}</span>
        <span style={{ display: 'block', fontSize: 12, color: 'var(--text-tertiary)' }}>{detalle}</span>
      </span>
    </label>
  )

  return (
    <div style={tarjeta}>
      <h2 style={tituloTarjeta}>Alergias de {nombre}</h2>
      <p style={ayuda}>El punto de venta las cruza con los productos que el colegio marcó con alérgenos.</p>
      {alumno.alergias && alumno.alergias !== 'Ninguna' && (
        <p style={{ fontSize: 12, color: 'var(--amber)', margin: '0 0 10px' }}>Registrado en el colegio: {alumno.alergias}</p>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {Object.entries(alergenos).map(([clave, texto]) => {
          const activo = elegidos.includes(clave)
          return (
            <Chip key={clave} activo={activo} tono="red" onClick={() => setElegidos(p => activo ? p.filter(x => x !== clave) : [...p, clave])}>
              {activo ? '⚠ ' : ''}{texto}
            </Chip>
          )
        })}
      </div>

      {elegidos.length > 0 && (
        <>
          <span style={etiqueta}>Si intenta comprar algo con estos alérgenos</span>
          <div style={{ display: 'grid', gap: 8 }}>
            {opcion(false, 'Avisar al cajero', 'Aparece un aviso de alergia y el cajero tiene que confirmar la venta.')}
            {opcion(true, 'No permitir la venta', 'El punto de venta no deja venderlo, y te avisamos.')}
          </div>
        </>
      )}

      <button onClick={guardar} disabled={guardando} style={{ ...botonGuardar, opacity: guardando ? 0.6 : 1 }}>{guardando ? 'Guardando...' : 'Guardar alergias'}</button>
    </div>
  )
}
