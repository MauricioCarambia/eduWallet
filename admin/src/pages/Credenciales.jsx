import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import api from '../api/axios'
import Credencial, { ESTILOS_CREDENCIAL } from '../components/Credencial'

// Hoja para imprimir las credenciales de los alumnos: tamaño tarjeta de
// crédito (85,6 × 54 mm), 10 por hoja A4. Sirven con lector de QR USB, con la
// cámara del celular, y se pueden imprimir sobre tarjetas NFC.
const estilos = `
  .cred-hoja { display: grid; grid-template-columns: repeat(auto-fill, 85.6mm); gap: 6mm; justify-content: center; }
${ESTILOS_CREDENCIAL}
  @media print {
    @page { size: A4; margin: 10mm; }
    body { background: #FFFFFF !important; }
    .no-imprimir { display: none !important; }
    /* sin el menú del panel: sólo las credenciales */
    aside { display: none !important; }
    div:has(> aside) { background: #FFFFFF !important; }
    div:has(> main) { margin-left: 0 !important; }
    main { padding: 0 !important; max-width: none !important; }
    .cred-hoja { gap: 4mm; }
  }
`

export default function Credenciales() {
  // ?alumno=ID: sólo la credencial de ese alumno (desde el botón QR); &imprimir=1 abre la impresión
  const [params] = useSearchParams()
  const alumnoId = params.get('alumno')
  const imprimirAlAbrir = params.get('imprimir') === '1'
  const [cursos, setCursos] = useState([])
  const [curso, setCurso] = useState('')
  const [impreso, setImpreso] = useState(false)
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState(null)
  const [cargada, setCargada] = useState(null) // curso ya traído

  useEffect(() => {
    api.get('/alumnos').then(r => setCursos([...new Set(r.data.filter(a => a.activo).map(a => a.curso))].sort())).catch(() => {})
  }, [])

  useEffect(() => {
    let vigente = true
    api.get('/alumnos/credenciales', { params: alumnoId ? { alumno_id: alumnoId } : curso ? { curso } : {} })
      .then(r => { if (vigente) { setDatos(r.data); setError(null) } })
      .catch(err => { if (vigente) setError(err.response?.data?.error || 'No se pudieron cargar las credenciales') })
      .finally(() => { if (vigente) setCargada(curso) })
    return () => { vigente = false }
  }, [curso, alumnoId])

  const cargando = cargada !== curso
  const cantidad = datos?.credenciales.length || 0

  // Desde el botón QR: se abre la impresión apenas carga la credencial
  useEffect(() => {
    if (!imprimirAlAbrir || impreso || cargando || !cantidad) return
    const t = setTimeout(() => { setImpreso(true); window.print() }, 400) // que carguen las imágenes
    return () => clearTimeout(t)
  }, [imprimirAlAbrir, impreso, cargando, cantidad])

  return (
    <div>
      <style>{estilos}</style>

      <div className="no-imprimir" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <div>
          <Link to="/alumnos" style={{ fontSize: 13, color: 'var(--accent)', textDecoration: 'none' }}>← Alumnos</Link>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: '4px 0 4px', color: 'var(--text)' }}>{alumnoId ? `Credencial de ${datos?.credenciales[0]?.nombre || '...'}` : 'Imprimir credenciales'}</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: 0, maxWidth: 560 }}>
            Tamaño tarjeta de crédito, 10 por hoja A4. Se usan con lector de QR USB o con la cámara del celular. También se pueden imprimir sobre tarjetas NFC.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {alumnoId
            ? <Link to="/credenciales" style={{ fontSize: 13, color: 'var(--accent)', textDecoration: 'none' }}>Ver todas</Link>
            : (
              <select value={curso} onChange={e => setCurso(e.target.value)} style={{ minWidth: 160 }} aria-label="Curso">
                <option value="">Todos los cursos</option>
                {cursos.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
          <button onClick={() => window.print()} disabled={cargando || !cantidad} style={{ padding: '9px 18px', border: 'none', borderRadius: 'var(--radius)', background: '#1E3A5F', color: 'white', fontSize: 13, fontWeight: 600, cursor: cargando || !cantidad ? 'not-allowed' : 'pointer', opacity: cargando || !cantidad ? 0.5 : 1 }}>
            🖨 Imprimir {cantidad ? `(${cantidad})` : ''}
          </button>
        </div>
      </div>

      <p className="no-imprimir" style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: '0 0 16px' }}>
        Al imprimir, elegí tamaño <b>A4</b>, escala <b>100 %</b> (sin "ajustar a la página") y activá <b>gráficos de fondo</b>. Si una credencial se pierde o la copian, generá un QR nuevo desde el botón QR del alumno: la anterior deja de funcionar.
      </p>

      {error && <div className="no-imprimir" style={{ padding: '10px 14px', borderRadius: 'var(--radius)', fontSize: 13, marginBottom: 16, background: 'var(--red-bg)', color: 'var(--red)' }}>{error}</div>}

      {cargando && !datos ? (
        <p className="no-imprimir" style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>Cargando credenciales...</p>
      ) : cantidad === 0 ? (
        <p className="no-imprimir" style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>No hay alumnos activos{curso ? ` en ${curso}` : ''}.</p>
      ) : (
        <div className="cred-hoja" style={{ opacity: cargando ? 0.5 : 1 }}>
          {datos.credenciales.map(c => (
            <Credencial key={c.id} credencial={c} colegio={datos.colegio} logo={datos.logo} />
          ))}
        </div>
      )}
    </div>
  )
}
