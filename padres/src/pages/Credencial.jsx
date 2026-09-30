import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../api/axios'
import Credencial, { ESTILOS_CREDENCIAL } from '../components/Credencial'
import { imagenCredencial } from '../utils/imagenCredencial'
import Icono from '../components/Icono'

// Al imprimir sale sólo la credencial, en tamaño real (85,6 × 54 mm)
const ESTILOS_IMPRESION = `
  @media print {
    @page { size: A4; margin: 15mm; }
    body * { visibility: hidden !important; }
    .cred-imprimir, .cred-imprimir * { visibility: visible !important; }
    .cred-imprimir { position: absolute; left: 0; top: 0; }
  }
`

const boton = primario => ({
  width: '100%', padding: '12px', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer',
  border: primario ? 'none' : '1.5px solid var(--border)', background: primario ? 'var(--brand)' : 'var(--bg-card)', color: primario ? 'var(--on-brand)' : 'var(--text)',
})

export default function CredencialPagina() {
  const { alumnoId } = useParams()
  const navigate = useNavigate()
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState(null)
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    let vigente = true
    api.get(`/padres/alumnos/${alumnoId}/credencial`)
      .then(r => { if (vigente) setDatos(r.data) })
      .catch(err => { if (vigente) setError(err.response?.data?.error || 'No se pudo cargar la credencial') })
    return () => { vigente = false }
  }, [alumnoId])

  const aviso = texto => { setMsg(texto); setTimeout(() => setMsg(null), 5000) }

  // En el celular abre el menú de compartir (guardar en la galería, mandar
  // por WhatsApp, etc.); si no se puede, descarga la imagen
  const guardarImagen = async () => {
    try {
      const blob = await imagenCredencial(datos)
      const nombre = `Credencial ${datos.credencial.nombre}.png`.replace(/[\\/:*?"<>|]/g, '')
      const archivo = new File([blob], nombre, { type: 'image/png' })
      if (navigator.canShare?.({ files: [archivo] })) {
        try { await navigator.share({ files: [archivo], title: 'Credencial KoleTap' }) }
        catch (err) { if (err?.name !== 'AbortError') throw err }
        return
      }
      const url = URL.createObjectURL(archivo)
      const a = document.createElement('a')
      a.href = url; a.download = nombre; a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      aviso('Imagen descargada')
    } catch { aviso('No se pudo generar la imagen') }
  }

  return (
    <div>
      <style>{ESTILOS_CREDENCIAL + ESTILOS_IMPRESION}</style>
      <button onClick={() => navigate('/inicio')} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--brand)', fontSize: 14, cursor: 'pointer', marginBottom: 8 }}>← Volver</button>
      <h1 style={{ fontSize: 20, fontWeight: 600, margin: '0 0 4px', color: 'var(--text)' }}>Credencial</h1>
      <p style={{ fontSize: 13, color: 'var(--text)', margin: '0 0 16px' }}>
        Se muestra donde corresponda para pagar con el saldo. Podés usarla desde el celular, guardarla como imagen o imprimirla.
      </p>

      {error && <div style={{ padding: '10px 14px', borderRadius: 10, fontSize: 13, background: 'var(--red-bg)', color: 'var(--red)' }}>{error}</div>}

      {!datos && !error && <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Cargando...</p>}

      {datos && (
        <>
          <div className="cred-imprimir" style={{ display: 'flex', justifyContent: 'center', marginBottom: 20, overflowX: 'auto' }}>
            <Credencial credencial={datos.credencial} colegio={datos.colegio} logo={datos.logo} />
          </div>

          {msg && <div style={{ padding: '10px 14px', borderRadius: 10, fontSize: 13, marginBottom: 12, background: 'var(--green-bg)', color: 'var(--green)' }}>{msg}</div>}

          <div style={{ display: 'grid', gap: 10 }}>
            <button onClick={guardarImagen} style={boton(true)}><Icono nombre="descargar" />Guardar imagen</button>
            <button onClick={() => window.print()} style={boton(false)}><Icono nombre="imprimir" />Imprimir</button>
          </div>

          <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '16px 0 0' }}>
            Para imprimirla en tamaño real elegí escala 100 % y activá los gráficos de fondo. Si se pierde o alguien la copia, pedile al colegio que genere una nueva: la anterior deja de funcionar.
          </p>
        </>
      )}
    </div>
  )
}
