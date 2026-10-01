import { useState, useMemo } from 'react'
import api from '../api/axios'
import { tarjeta, tituloTarjeta, ayuda, etiqueta, botonGuardar, fmt } from './controlEstilos'
import { Chip } from './ControlUI'

const NOMBRE_CATEGORIA = { comida: 'Comida', bebida: 'Bebidas', golosina: 'Golosinas', 'útil': 'Útiles escolares', otro: 'Otros' }
const OPCIONES = [
  ['libre', 'Sin límite'],
  ['1', 'Máximo 1 por día'],
  ['2', 'Máximo 2 por día'],
  ['3', 'Máximo 3 por día'],
  ['5', 'Máximo 5 por día'],
  ['bloq', 'No permitido'],
]

// Reglas de la familia para un hijo: qué categorías, productos y zonas puede
// usar, cuántas unidades por día y cuánto puede gastar en cada zona. Las aplica el POS.
export default function ReglasCompra({ alumno, catalogo, onGuardado, showMsg }) {
  const r = alumno.restricciones || {}
  const [categorias, setCategorias] = useState(() => Object.fromEntries(catalogo.categorias.map(c => [c,
    (r.categorias_bloqueadas || []).includes(c) ? 'bloq' : r.maximos?.[c] != null ? String(r.maximos[c]) : 'libre'])))
  const [zonasBloq, setZonasBloq] = useState(r.zonas_bloqueadas || [])
  // { Kiosco: { monto: '5000', periodo: 'semana' } }; monto vacío = sin límite
  const [limitesZona, setLimitesZona] = useState(() => Object.fromEntries(catalogo.zonas.map(z => [z, {
    monto: r.limites_zona?.[z] ? String(r.limites_zona[z].monto) : '',
    periodo: r.limites_zona?.[z]?.periodo || 'semana',
  }])))
  const cambiarLimite = (zona, cambio) => setLimitesZona(p => ({ ...p, [zona]: { ...p[zona], ...cambio } }))
  const [productosBloq, setProductosBloq] = useState(r.productos_bloqueados || [])
  const [busq, setBusq] = useState('')
  const [guardando, setGuardando] = useState(false)

  const porId = useMemo(() => new Map(catalogo.productos.map(p => [p.id, p])), [catalogo])
  const resultados = busq.trim().length < 2 ? [] : catalogo.productos
    .filter(p => !productosBloq.includes(p.id) && p.nombre.toLowerCase().includes(busq.trim().toLowerCase()))
    .slice(0, 8)

  const guardar = async () => {
    setGuardando(true)
    try {
      const categorias_bloqueadas = Object.entries(categorias).filter(([, v]) => v === 'bloq').map(([c]) => c)
      const maximos = Object.fromEntries(Object.entries(categorias).filter(([, v]) => v !== 'bloq' && v !== 'libre').map(([c, v]) => [c, Number(v)]))
      const res = await api.put(`/padres/alumnos/${alumno.id}/restricciones`, {
        categorias_bloqueadas, maximos, zonas_bloqueadas: zonasBloq, productos_bloqueados: productosBloq,
        limites_zona: Object.fromEntries(Object.entries(limitesZona)
          .filter(([z, l]) => !zonasBloq.includes(z) && String(l.monto).trim() !== '')
          .map(([z, l]) => [z, { monto: Number(l.monto), periodo: l.periodo }])),
      })
      onGuardado(res.data)
      showMsg('ok', 'Reglas guardadas: ya las aplica el colegio')
    } catch (err) {
      showMsg('error', err.response?.data?.error || 'No se pudieron guardar las reglas')
    } finally { setGuardando(false) }
  }

  const nombre = alumno.nombre.split(' ')[0]

  return (
    <div style={tarjeta}>
      <h2 style={tituloTarjeta}>Qué puede comprar {nombre}</h2>
      <p style={ayuda}>El punto de venta del colegio no deja vender lo que no esté permitido, y te avisamos si lo intenta.</p>

      <span style={etiqueta}>Por categoría</span>
      <div style={{ display: 'grid', gap: 8 }}>
        {catalogo.categorias.map(c => (
          <label key={c} htmlFor={`cat-${c}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, fontSize: 14, color: 'var(--text)' }}>
            {NOMBRE_CATEGORIA[c] || c}
            <select id={`cat-${c}`} value={categorias[c] || 'libre'} onChange={e => setCategorias(p => ({ ...p, [c]: e.target.value }))}
              style={{ width: 'auto', minWidth: 160, color: categorias[c] === 'bloq' ? 'var(--red)' : undefined }}>
              {OPCIONES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
            </select>
          </label>
        ))}
      </div>

      {catalogo.zonas.length > 1 && (
        <>
          <span style={etiqueta}>Dónde puede comprar</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {catalogo.zonas.map(z => {
              const permitida = !zonasBloq.includes(z)
              return (
                <Chip key={z} activo={permitida} onClick={() => setZonasBloq(p => permitida ? [...p, z] : p.filter(x => x !== z))}>
                  {permitida ? '✓' : '✕'} {z}
                </Chip>
              )
            })}
          </div>
        </>
      )}

      {catalogo.zonas.some(z => !zonasBloq.includes(z)) && (
        <>
          <span style={etiqueta}>Cuánto puede gastar en cada lugar</span>
          <p style={{ ...ayuda, margin: '0 0 8px' }}>Opcional. Por ejemplo, hasta $5.000 por semana en el kiosco. Además del límite diario y semanal.</p>
          <div style={{ display: 'grid', gap: 10 }}>
            {catalogo.zonas.filter(z => !zonasBloq.includes(z)).map(z => {
              const l = limitesZona[z] || { monto: '', periodo: 'semana' }
              const gastado = catalogo.gasto_zona?.[z]?.[l.periodo === 'dia' ? 'hoy' : 'semana'] || 0
              return (
                <div key={z}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <label htmlFor={`limite-${z}`} style={{ flex: 1, minWidth: 0, fontSize: 14, color: 'var(--text)' }}>{z}</label>
                    <input id={`limite-${z}`} type="number" min="0" inputMode="numeric" placeholder="Sin límite" value={l.monto}
                      onChange={e => cambiarLimite(z, { monto: e.target.value })} style={{ width: 120 }} />
                    <select aria-label={`Período del límite de ${z}`} value={l.periodo} onChange={e => cambiarLimite(z, { periodo: e.target.value })} style={{ width: 'auto' }}>
                      <option value="dia">por día</option>
                      <option value="semana">por semana</option>
                    </select>
                  </div>
                  {String(l.monto).trim() !== '' && (
                    <p style={{ margin: '4px 0 0', fontSize: 12, color: Number(gastado) >= Number(l.monto) ? 'var(--red)' : 'var(--text-secondary)' }}>
                      {l.periodo === 'dia' ? 'Hoy' : 'Esta semana'} gastó {fmt(gastado)} en {z}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      <span style={etiqueta}>Productos que no puede comprar</span>
      {productosBloq.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          {productosBloq.map(id => (
            <Chip key={id} activo tono="red" onClick={() => setProductosBloq(p => p.filter(x => x !== id))}>
              {porId.get(id)?.nombre || `Producto #${id}`} ✕
            </Chip>
          ))}
        </div>
      )}
      <input placeholder="Buscar un producto (ej.: energizante)" value={busq} onChange={e => setBusq(e.target.value)} />
      {resultados.length > 0 && (
        <div style={{ border: '1px solid var(--border)', borderRadius: 10, marginTop: 6, overflow: 'hidden' }}>
          {resultados.map(p => (
            <button key={p.id} type="button" onClick={() => { setProductosBloq(x => [...x, p.id]); setBusq('') }}
              style={{ display: 'flex', width: '100%', justifyContent: 'space-between', gap: 10, padding: '10px 12px', border: 'none', borderBottom: '1px solid var(--border-light)', background: 'var(--bg-card)', color: 'var(--text)', fontSize: 13, cursor: 'pointer', textAlign: 'left' }}>
              <span>{p.nombre} <span style={{ color: 'var(--text-secondary)' }}>· {p.local}</span></span>
              <span style={{ color: 'var(--red)', fontWeight: 600, flexShrink: 0 }}>Bloquear</span>
            </button>
          ))}
        </div>
      )}

      <button onClick={guardar} disabled={guardando} style={{ ...botonGuardar, opacity: guardando ? 0.6 : 1 }}>{guardando ? 'Guardando...' : 'Guardar reglas'}</button>
    </div>
  )
}
