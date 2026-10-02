import { useState, useEffect } from 'react'
import { useSuperAdmin } from '../context/SuperAdminContext'
import superadminApi from '../api/axiosSuperadmin'
import SuperMetricas from '../components/SuperMetricas'

const fmt = n => `$${Number(n || 0).toLocaleString('es-AR')}`

export default function SuperAdminDashboard() {
  const { logout } = useSuperAdmin()
  const [colegios, setColegios] = useState([])
  const [cargando, setCargando] = useState(true)
  const [vista, setVista] = useState('colegios')
  const [msg, setMsg] = useState(null)
  const [modalNuevo, setModalNuevo] = useState(false)
  const [nombreNuevo, setNombreNuevo] = useState('')
  const [comisionNueva, setComisionNueva] = useState('5')
  const [creando, setCreando] = useState(false)
  // ajuste de saldo (correcciones puntuales: los colegios no pueden cargar saldo sin Mercado Pago)
  const [ajuste, setAjuste] = useState(null) // { colegio, q, resultados, alumno, monto, motivo, guardando }

  const showMsg = (tipo, texto) => { setMsg({ tipo, texto }); setTimeout(() => setMsg(null), 4000) }

  const cargar = async () => {
    setCargando(true)
    try {
      const res = await superadminApi.get('/superadmin/colegios')
      setColegios(res.data)
    } catch (err) { showMsg('error', err.response?.data?.error || 'Error al cargar colegios') }
    finally { setCargando(false) }
  }

  useEffect(() => { cargar() }, [])

  const toggleActivo = async (colegio) => {
    try {
      await superadminApi.patch(`/superadmin/colegios/${colegio.id}`, { activo: !colegio.activo })
      cargar()
    } catch (err) { showMsg('error', err.response?.data?.error || 'Error al actualizar el colegio') }
  }

  const cambiarComision = async (colegio, valor) => {
    try {
      await superadminApi.patch(`/superadmin/colegios/${colegio.id}`, { comision_pct: valor })
      cargar()
    } catch (err) { showMsg('error', err.response?.data?.error || 'Error al actualizar la comisión') }
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

  const abrirAjuste = (colegio) => setAjuste({ colegio, q: '', resultados: [], alumno: null, monto: '', motivo: '', guardando: false })

  // Búsqueda de alumnos del colegio, medio segundo después de dejar de escribir
  const colegioAjusteId = ajuste?.colegio.id
  const qAjuste = ajuste?.q
  useEffect(() => {
    if (!colegioAjusteId) return
    const t = setTimeout(async () => {
      try {
        const res = await superadminApi.get(`/superadmin/colegios/${colegioAjusteId}/alumnos`, { params: { q: qAjuste || undefined } })
        setAjuste(a => a && { ...a, resultados: res.data })
      } catch (err) { showMsg('error', err.response?.data?.error || 'Error al buscar alumnos') }
    }, 500)
    return () => clearTimeout(t)
  }, [colegioAjusteId, qAjuste])

  const guardarAjuste = async () => {
    const monto = parseFloat(ajuste.monto)
    if (!ajuste.alumno || !(monto > 0) || !ajuste.motivo.trim()) return
    if (!confirm(`¿Sumar ${fmt(monto)} al saldo de ${ajuste.alumno.nombre}? Queda registrado como ajuste de KoleTap.`)) return
    setAjuste(a => ({ ...a, guardando: true }))
    try {
      const res = await superadminApi.post(`/superadmin/alumnos/${ajuste.alumno.id}/ajuste`, { monto, motivo: ajuste.motivo.trim() })
      showMsg('ok', `Ajuste aplicado — nuevo saldo de ${res.data.nombre}: ${fmt(res.data.saldo)}`)
      setAjuste(null)
    } catch (err) {
      showMsg('error', err.response?.data?.error || 'Error al aplicar el ajuste')
      setAjuste(a => a && { ...a, guardando: false })
    }
  }

  const totalColegios = colegios.length
  const totalAlumnos = colegios.reduce((s, c) => s + parseInt(c.alumnos_count || 0), 0)
  const totalComision = colegios.reduce((s, c) => s + parseFloat(c.comision_cobrada || 0), 0)

  return (
    <div data-theme="dark" style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', padding: '2rem' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 4px' }}>Panel de plataforma</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: 0 }}>Todos los colegios en un solo lugar</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setModalNuevo(true)} style={{ padding: '9px 16px', border: 'none', borderRadius: 8, background: 'var(--accent)', color: 'var(--bg)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>+ Nuevo colegio</button>
            <button onClick={logout} style={{ padding: '9px 16px', border: '1px solid #26322D', borderRadius: 8, background: 'transparent', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer' }}>Salir</button>
          </div>
        </div>

        {msg && <div style={{ padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16, background: msg.tipo === 'ok' ? 'var(--green-bg)' : 'var(--red-bg)', color: msg.tipo === 'ok' ? 'var(--green)' : 'var(--red)' }}>{msg.texto}</div>}

        <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)' }}>
          {[['colegios', 'Colegios'], ['metricas', 'Métricas']].map(([val, label]) => (
            <button key={val} onClick={() => setVista(val)} aria-pressed={vista === val} style={{ padding: '8px 16px', border: 'none', borderBottom: `2px solid ${vista === val ? 'var(--brand)' : 'transparent'}`, background: 'transparent', fontSize: 14, fontWeight: vista === val ? 600 : 400, color: vista === val ? 'var(--brand)' : 'var(--text-secondary)', cursor: 'pointer', marginBottom: -1 }}>{label}</button>
          ))}
        </div>

        {vista === 'metricas' && <SuperMetricas colegios={colegios} />}

        {vista === 'colegios' && <>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Colegios', valor: totalColegios },
            { label: 'Alumnos totales', valor: totalAlumnos },
            { label: 'Comisión cobrada acumulada', valor: fmt(totalComision) },
          ].map(k => (
            <div key={k.label} style={{ background: 'var(--bg-card)', borderRadius: 12, padding: '1rem 1.25rem', border: '1px solid #26322D' }}>
              <p style={{ margin: '0 0 6px', fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.5px' }}>{k.label}</p>
              <p style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>{k.valor}</p>
            </div>
          ))}
        </div>

        <div style={{ background: 'var(--bg-card)', borderRadius: 12, border: '1px solid #26322D', overflow: 'hidden' }}>
          {cargando ? (
            <p style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Cargando...</p>
          ) : colegios.length === 0 ? (
            <p style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Todavía no hay colegios cargados.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #26322D' }}>
                  {['Colegio', 'Código', 'Plan', 'Alumnos', 'Volumen recargas', 'Comisión %', 'Comisión cobrada', 'Mercado Pago', 'Estado', ''].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.4px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {colegios.map(c => (
                  <tr key={c.id} style={{ borderBottom: '1px solid #18221E' }}>
                    <td style={{ padding: '10px 14px', fontWeight: 600 }}>{c.nombre}</td>
                    <td style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{c.slug}</td>
                    <td style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>{c.plan}</td>
                    <td style={{ padding: '10px 14px' }}>{c.alumnos_count}</td>
                    <td style={{ padding: '10px 14px' }}>{fmt(c.volumen_recargas)}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <input type="number" defaultValue={c.comision_pct} onBlur={e => e.target.value !== String(c.comision_pct) && cambiarComision(c, e.target.value)}
                        style={{ width: 56, padding: '4px 6px', borderRadius: 6, border: '1px solid #26322D', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }} />
                    </td>
                    <td style={{ padding: '10px 14px', fontWeight: 600 }}>{fmt(c.comision_cobrada)}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, background: c.mp_conectado ? 'var(--green-bg)' : 'var(--amber-bg)', color: c.mp_conectado ? 'var(--green)' : 'var(--amber)' }}>
                        {c.mp_conectado ? 'Conectado' : 'Sin conectar'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, background: c.activo ? 'var(--green-bg)' : 'var(--red-bg)', color: c.activo ? 'var(--green)' : 'var(--red)' }}>
                        {c.activo ? 'Activo' : 'Suspendido'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => abrirAjuste(c)} style={{ padding: '5px 12px', border: '1px solid #26322D', borderRadius: 6, background: 'transparent', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                          Ajustar saldo
                        </button>
                        <button onClick={() => toggleActivo(c)} style={{ padding: '5px 12px', border: '1px solid #26322D', borderRadius: 6, background: 'transparent', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer' }}>
                          {c.activo ? 'Suspender' : 'Reactivar'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        </>}
      </div>

      {ajuste && (
        <div style={{ position: 'fixed', inset: 0, background: 'var(--overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid #26322D', borderRadius: 14, padding: '1.5rem', width: '100%', maxWidth: 440, maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700 }}>Ajustar saldo — {ajuste.colegio.nombre}</h2>
            <p style={{ margin: '0 0 16px', fontSize: 12, color: 'var(--text-secondary)' }}>Sólo para correcciones puntuales (ej. devolver un cobro duplicado). Suma saldo sin pasar por Mercado Pago y queda registrado con el motivo en los movimientos del alumno y en la auditoría del colegio.</p>

            {!ajuste.alumno ? (
              <>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase' }}>Alumno</label>
                <input autoFocus value={ajuste.q} onChange={e => { const q = e.target.value; setAjuste(a => ({ ...a, q })) }} placeholder="Buscar por nombre o curso..." style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #26322D', background: 'var(--bg)', color: 'var(--text)', fontSize: 14, marginBottom: 14, boxSizing: 'border-box' }} />
                <div style={{ border: '1px solid #26322D', borderRadius: 8, overflow: 'hidden', marginBottom: 16 }}>
                  {ajuste.resultados.length === 0 ? (
                    <p style={{ margin: 0, padding: 12, fontSize: 13, color: 'var(--text-secondary)' }}>Sin resultados</p>
                  ) : ajuste.resultados.map(a => (
                    <button key={a.id} onClick={() => setAjuste(x => ({ ...x, alumno: a }))} style={{ display: 'flex', justifyContent: 'space-between', width: '100%', padding: '10px 12px', border: 'none', borderBottom: '1px solid #18221E', background: 'transparent', color: 'var(--text)', fontSize: 13, cursor: 'pointer', textAlign: 'left' }}>
                      <span>{a.nombre} <span style={{ color: 'var(--text-secondary)' }}>· {a.curso}</span></span>
                      <span style={{ color: 'var(--text-secondary)' }}>{fmt(a.saldo)}</span>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', border: '1px solid #26322D', borderRadius: 8, marginBottom: 14, fontSize: 13 }}>
                  <span>{ajuste.alumno.nombre} <span style={{ color: 'var(--text-secondary)' }}>· saldo {fmt(ajuste.alumno.saldo)}</span></span>
                  <button onClick={() => setAjuste(a => ({ ...a, alumno: null }))} style={{ border: 'none', background: 'transparent', color: 'var(--brand)', fontSize: 12, cursor: 'pointer' }}>Cambiar</button>
                </div>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase' }}>Monto a sumar</label>
                <input type="number" min="1" value={ajuste.monto} onChange={e => { const monto = e.target.value; setAjuste(a => ({ ...a, monto })) }} placeholder="500" style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #26322D', background: 'var(--bg)', color: 'var(--text)', fontSize: 14, marginBottom: 14, boxSizing: 'border-box' }} />
                <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase' }}>Motivo (obligatorio)</label>
                <input value={ajuste.motivo} maxLength={200} onChange={e => { const motivo = e.target.value; setAjuste(a => ({ ...a, motivo })) }} placeholder="Devolución por cobro duplicado del 27/09" style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #26322D', background: 'var(--bg)', color: 'var(--text)', fontSize: 14, marginBottom: 14, boxSizing: 'border-box' }} />
              </>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setAjuste(null)} style={{ padding: '9px 16px', border: '1px solid #26322D', borderRadius: 8, background: 'transparent', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
              {ajuste.alumno && (
                <button onClick={guardarAjuste} disabled={ajuste.guardando || !(parseFloat(ajuste.monto) > 0) || !ajuste.motivo.trim()} style={{ padding: '9px 16px', border: 'none', borderRadius: 8, background: 'var(--accent)', color: 'var(--bg)', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: ajuste.guardando || !(parseFloat(ajuste.monto) > 0) || !ajuste.motivo.trim() ? 0.5 : 1 }}>
                  {ajuste.guardando ? 'Aplicando...' : 'Aplicar ajuste'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {modalNuevo && (
        <div style={{ position: 'fixed', inset: 0, background: 'var(--overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid #26322D', borderRadius: 14, padding: '1.5rem', width: '100%', maxWidth: 380 }}>
            <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>Nuevo colegio</h2>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase' }}>Nombre</label>
            <input value={nombreNuevo} onChange={e => setNombreNuevo(e.target.value)} placeholder="Colegio San Martín"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #26322D', background: 'var(--bg)', color: 'var(--text)', fontSize: 14, marginBottom: 14 }} />
            <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase' }}>Comisión %</label>
            <input type="number" value={comisionNueva} onChange={e => setComisionNueva(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #26322D', background: 'var(--bg)', color: 'var(--text)', fontSize: 14, marginBottom: 18 }} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setModalNuevo(false)} style={{ padding: '9px 16px', border: '1px solid #26322D', borderRadius: 8, background: 'transparent', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={crearColegio} disabled={creando || !nombreNuevo.trim()} style={{ padding: '9px 16px', border: 'none', borderRadius: 8, background: 'var(--accent)', color: 'var(--bg)', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: creando ? 0.7 : 1 }}>
                {creando ? 'Creando...' : 'Crear'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
