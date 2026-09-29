import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/axios'

// Hoja para imprimir las credenciales de los alumnos: tamaño tarjeta de
// crédito (85,6 × 54 mm), 10 por hoja A4. Sirven con lector de QR USB, con la
// cámara del celular, y se pueden imprimir sobre tarjetas NFC.
const estilos = `
  .cred-hoja { display: grid; grid-template-columns: repeat(auto-fill, 85.6mm); gap: 6mm; justify-content: center; }
  .cred { width: 85.6mm; height: 54mm; box-sizing: border-box; border: 0.3mm dashed #B8C2CF; border-radius: 3.5mm;
          background: #FFFFFF; color: #13233A; padding: 4mm; display: grid; grid-template-columns: 1fr 34mm; gap: 3mm;
          break-inside: avoid; page-break-inside: avoid; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; }
  .cred-datos { display: flex; flex-direction: column; min-width: 0; }
  .cred-colegio { display: flex; align-items: center; gap: 2mm; font-size: 2.6mm; font-weight: 700; color: #1E3A5F; text-transform: uppercase; letter-spacing: .2mm; }
  .cred-colegio img { width: 6mm; height: 6mm; object-fit: contain; }
  .cred-nombre { margin-top: auto; font-size: 4.6mm; font-weight: 800; line-height: 1.15; overflow-wrap: anywhere; }
  .cred-curso { font-size: 3.2mm; color: #4A5A70; margin-top: 1mm; }
  .cred-pie { margin-top: auto; font-size: 2.2mm; color: #7A8799; }
  .cred-qr { width: 34mm; height: 34mm; align-self: center; image-rendering: pixelated; }
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
  const [cursos, setCursos] = useState([])
  const [curso, setCurso] = useState('')
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState(null)
  const [cargada, setCargada] = useState(null) // curso ya traído

  useEffect(() => {
    api.get('/alumnos').then(r => setCursos([...new Set(r.data.filter(a => a.activo).map(a => a.curso))].sort())).catch(() => {})
  }, [])

  useEffect(() => {
    let vigente = true
    api.get('/alumnos/credenciales', { params: curso ? { curso } : {} })
      .then(r => { if (vigente) { setDatos(r.data); setError(null) } })
      .catch(err => { if (vigente) setError(err.response?.data?.error || 'No se pudieron cargar las credenciales') })
      .finally(() => { if (vigente) setCargada(curso) })
    return () => { vigente = false }
  }, [curso])

  const cargando = cargada !== curso
  const cantidad = datos?.credenciales.length || 0

  return (
    <div>
      <style>{estilos}</style>

      <div className="no-imprimir" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <div>
          <Link to="/alumnos" style={{ fontSize: 13, color: 'var(--accent)', textDecoration: 'none' }}>← Alumnos</Link>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: '4px 0 4px', color: 'var(--text)' }}>Imprimir credenciales</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: 0, maxWidth: 560 }}>
            Tamaño tarjeta de crédito, 10 por hoja A4. Se usan con lector de QR USB o con la cámara del celular. También se pueden imprimir sobre tarjetas NFC.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select value={curso} onChange={e => setCurso(e.target.value)} style={{ minWidth: 160 }} aria-label="Curso">
            <option value="">Todos los cursos</option>
            {cursos.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
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
            <div className="cred" key={c.id}>
              <div className="cred-datos">
                <div className="cred-colegio">
                  {datos.logo && <img src={datos.logo} alt="" />}
                  <span>{datos.colegio || 'EduWallet'}</span>
                </div>
                <div className="cred-nombre">{c.nombre}</div>
                <div className="cred-curso">{c.curso}</div>
                <div className="cred-pie">Credencial EduWallet · personal e intransferible</div>
              </div>
              <img className="cred-qr" src={c.qr_img} alt={`QR de ${c.nombre}`} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
