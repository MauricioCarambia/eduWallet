import { useState, useEffect } from 'react'
import { useSuperAdmin } from '../context/SuperAdminContext'
import superadminApi from '../api/axiosSuperadmin'

const fmt = n => `$${Number(n || 0).toLocaleString('es-AR')}`

export default function SuperAdminDashboard() {
  const { logout } = useSuperAdmin()
  const [colegios, setColegios] = useState([])
  const [cargando, setCargando] = useState(true)
  const [msg, setMsg] = useState(null)
  const [modalNuevo, setModalNuevo] = useState(false)
  const [nombreNuevo, setNombreNuevo] = useState('')
  const [comisionNueva, setComisionNueva] = useState('5')
  const [creando, setCreando] = useState(false)

  const showMsg = (tipo, texto) => { setMsg({ tipo, texto }); setTimeout(() => setMsg(null), 4000) }

  const cargar = async () => {
    setCargando(true)
    try {
      const res = await superadminApi.get('/superadmin/colegios')
      setColegios(res.data)
    } catch { showMsg('error', 'Error al cargar colegios') }
    finally { setCargando(false) }
  }

  useEffect(() => { cargar() }, [])

  const toggleActivo = async (colegio) => {
    try {
      await superadminApi.patch(`/superadmin/colegios/${colegio.id}`, { activo: !colegio.activo })
      cargar()
    } catch { showMsg('error', 'Error al actualizar el colegio') }
  }

  const cambiarComision = async (colegio, valor) => {
    try {
      await superadminApi.patch(`/superadmin/colegios/${colegio.id}`, { comision_pct: valor })
      cargar()
    } catch { showMsg('error', 'Error al actualizar la comisión') }
  }

  const crearColegio = async () => {
    if (!nombreNuevo.trim()) return
    setCreando(true)
    try {
      const res = await superadminApi.post('/superadmin/colegios', { nombre: nombreNuevo.trim(), comision_pct: comisionNueva })
      showMsg('ok', `Colegio creado — código: ${res.data.slug}`)
      setModalNuevo(false); setNombreNuevo(''); setComisionNueva('5')
      cargar()
    } catch (err) { showMsg('error', err.response?.data?.error || 'Error al crear el colegio') }
    finally { setCreando(false) }
  }

  const totalColegios = colegios.length
  const totalAlumnos = colegios.reduce((s, c) => s + parseInt(c.alumnos_count || 0), 0)
  const totalComision = colegios.reduce((s, c) => s + parseFloat(c.comision_estimada || 0), 0)

  return (
    <div style={{ minHeight: '100vh', background: '#0B1220', color: 'white', padding: '2rem' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 4px' }}>Panel de plataforma</h1>
            <p style={{ color: '#8B95A8', fontSize: 13, margin: 0 }}>Todos los colegios en un solo lugar</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setModalNuevo(true)} style={{ padding: '9px 16px', border: 'none', borderRadius: 8, background: '#F59E0B', color: '#0B1220', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>+ Nuevo colegio</button>
            <button onClick={logout} style={{ padding: '9px 16px', border: '1px solid #223049', borderRadius: 8, background: 'transparent', color: '#8B95A8', fontSize: 13, cursor: 'pointer' }}>Salir</button>
          </div>
        </div>

        {msg && <div style={{ padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16, background: msg.tipo === 'ok' ? 'rgba(22,163,74,0.15)' : 'rgba(220,38,38,0.15)', color: msg.tipo === 'ok' ? '#4ADE80' : '#F87171' }}>{msg.texto}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Colegios', valor: totalColegios },
            { label: 'Alumnos totales', valor: totalAlumnos },
            { label: 'Comisión estimada acumulada', valor: fmt(totalComision) },
          ].map(k => (
            <div key={k.label} style={{ background: '#131C2E', borderRadius: 12, padding: '1rem 1.25rem', border: '1px solid #223049' }}>
              <p style={{ margin: '0 0 6px', fontSize: 11, color: '#8B95A8', textTransform: 'uppercase', letterSpacing: '.5px' }}>{k.label}</p>
              <p style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>{k.valor}</p>
            </div>
          ))}
        </div>

        <div style={{ background: '#131C2E', borderRadius: 12, border: '1px solid #223049', overflow: 'hidden' }}>
          {cargando ? (
            <p style={{ padding: '2rem', textAlign: 'center', color: '#8B95A8' }}>Cargando...</p>
          ) : colegios.length === 0 ? (
            <p style={{ padding: '2rem', textAlign: 'center', color: '#8B95A8' }}>Todavía no hay colegios cargados.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #223049' }}>
                  {['Colegio', 'Código', 'Plan', 'Alumnos', 'Volumen recargas', 'Comisión %', 'Comisión $', 'Mercado Pago', 'Estado', ''].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '10px 14px', color: '#8B95A8', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.4px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {colegios.map(c => (
                  <tr key={c.id} style={{ borderBottom: '1px solid #1A2436' }}>
                    <td style={{ padding: '10px 14px', fontWeight: 600 }}>{c.nombre}</td>
                    <td style={{ padding: '10px 14px', color: '#8B95A8', fontFamily: 'monospace' }}>{c.slug}</td>
                    <td style={{ padding: '10px 14px', color: '#8B95A8' }}>{c.plan}</td>
                    <td style={{ padding: '10px 14px' }}>{c.alumnos_count}</td>
                    <td style={{ padding: '10px 14px' }}>{fmt(c.volumen_recargas)}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <input type="number" defaultValue={c.comision_pct} onBlur={e => e.target.value !== String(c.comision_pct) && cambiarComision(c, e.target.value)}
                        style={{ width: 56, padding: '4px 6px', borderRadius: 6, border: '1px solid #223049', background: '#0B1220', color: 'white', fontSize: 13 }} />
                    </td>
                    <td style={{ padding: '10px 14px', fontWeight: 600 }}>{fmt(c.comision_estimada)}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, background: c.mp_conectado ? 'rgba(22,163,74,0.15)' : 'rgba(245,158,11,0.15)', color: c.mp_conectado ? '#4ADE80' : '#FBBF24' }}>
                        {c.mp_conectado ? 'Conectado' : 'Sin conectar'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, background: c.activo ? 'rgba(22,163,74,0.15)' : 'rgba(220,38,38,0.15)', color: c.activo ? '#4ADE80' : '#F87171' }}>
                        {c.activo ? 'Activo' : 'Suspendido'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <button onClick={() => toggleActivo(c)} style={{ padding: '5px 12px', border: '1px solid #223049', borderRadius: 6, background: 'transparent', color: '#8B95A8', fontSize: 12, cursor: 'pointer' }}>
                        {c.activo ? 'Suspender' : 'Reactivar'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {modalNuevo && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#131C2E', border: '1px solid #223049', borderRadius: 14, padding: '1.5rem', width: '100%', maxWidth: 380 }}>
            <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>Nuevo colegio</h2>
            <label style={{ display: 'block', fontSize: 11, color: '#8B95A8', marginBottom: 6, textTransform: 'uppercase' }}>Nombre</label>
            <input value={nombreNuevo} onChange={e => setNombreNuevo(e.target.value)} placeholder="Colegio San Martín"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #223049', background: '#0B1220', color: 'white', fontSize: 14, marginBottom: 14 }} />
            <label style={{ display: 'block', fontSize: 11, color: '#8B95A8', marginBottom: 6, textTransform: 'uppercase' }}>Comisión %</label>
            <input type="number" value={comisionNueva} onChange={e => setComisionNueva(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #223049', background: '#0B1220', color: 'white', fontSize: 14, marginBottom: 18 }} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setModalNuevo(false)} style={{ padding: '9px 16px', border: '1px solid #223049', borderRadius: 8, background: 'transparent', color: '#8B95A8', fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={crearColegio} disabled={creando || !nombreNuevo.trim()} style={{ padding: '9px 16px', border: 'none', borderRadius: 8, background: '#F59E0B', color: '#0B1220', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: creando ? 0.7 : 1 }}>
                {creando ? 'Creando...' : 'Crear'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
