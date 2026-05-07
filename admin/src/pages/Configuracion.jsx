import { useState, useEffect } from 'react'

const DEFAULTS = {
  nombreColegio: '',
  direccion: '',
  telefono: '',
  email: '',
  umbralSaldoBajo: '200',
  umbralStockBajo: '3',
  zonaHoraria: 'America/Argentina/Buenos_Aires',
  moneda: 'ARS',
}

function Campo({ label, hint, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#555', marginBottom: 5 }}>{label}</label>
      {children}
      {hint && <p style={{ margin: '4px 0 0', fontSize: 11, color: '#aaa' }}>{hint}</p>}
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div style={{ background: 'white', borderRadius: 12, padding: '1.25rem', border: '1px solid #F0F0F0', marginBottom: 16 }}>
      <h2 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 16px', paddingBottom: 12, borderBottom: '1px solid #F8F9FA' }}>{title}</h2>
      {children}
    </div>
  )
}

export default function Configuracion() {
  const [config, setConfig] = useState(DEFAULTS)
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    const saved = localStorage.getItem('eduwallet_config')
    if (saved) setConfig(JSON.parse(saved))
  }, [])

  const guardar = () => {
    localStorage.setItem('eduwallet_config', JSON.stringify(config))
    setMsg({ tipo: 'ok', texto: 'Configuración guardada correctamente' })
    setTimeout(() => setMsg(null), 3000)
  }

  const set = (key, val) => setConfig(prev => ({ ...prev, [key]: val }))

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, margin: '0 0 4px' }}>Configuración</h1>
        <p style={{ color: '#999', fontSize: 13, margin: 0 }}>Parámetros generales del sistema</p>
      </div>

      {msg && <div style={{ padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16, background: msg.tipo === 'ok' ? '#F0FDF4' : '#FEF2F2', color: msg.tipo === 'ok' ? '#16A34A' : '#DC2626' }}>{msg.texto}</div>}

      <Section title="Datos del colegio">
        <Campo label="Nombre del colegio">
          <input value={config.nombreColegio} onChange={e => set('nombreColegio', e.target.value)} placeholder="Ej: Colegio San Martín" style={{ width: '100%' }} />
        </Campo>
        <Campo label="Dirección">
          <input value={config.direccion} onChange={e => set('direccion', e.target.value)} placeholder="Ej: Av. Siempreviva 742" style={{ width: '100%' }} />
        </Campo>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Campo label="Teléfono">
            <input value={config.telefono} onChange={e => set('telefono', e.target.value)} placeholder="Ej: 011-4444-5555" style={{ width: '100%' }} />
          </Campo>
          <Campo label="Email">
            <input type="email" value={config.email} onChange={e => set('email', e.target.value)} placeholder="admin@colegio.edu.ar" style={{ width: '100%' }} />
          </Campo>
        </div>
      </Section>

      <Section title="Alertas">
        <Campo label="Umbral de saldo bajo" hint="Se mostrará una alerta cuando el saldo de un alumno baje de este monto">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, color: '#666' }}>$</span>
            <input type="number" value={config.umbralSaldoBajo} onChange={e => set('umbralSaldoBajo', e.target.value)} style={{ width: 120 }} />
          </div>
        </Campo>
        <Campo label="Umbral de stock bajo" hint="Se mostrará una alerta cuando el stock de un producto baje de esta cantidad">
          <input type="number" value={config.umbralStockBajo} onChange={e => set('umbralStockBajo', e.target.value)} style={{ width: 120 }} />
        </Campo>
      </Section>

      <Section title="Sistema">
        <Campo label="Zona horaria">
          <select value={config.zonaHoraria} onChange={e => set('zonaHoraria', e.target.value)} style={{ width: '100%', maxWidth: 320 }}>
            <option value="America/Argentina/Buenos_Aires">Argentina (UTC-3)</option>
            <option value="America/Santiago">Chile (UTC-4)</option>
            <option value="America/Bogota">Colombia (UTC-5)</option>
            <option value="America/Mexico_City">México (UTC-6)</option>
            <option value="Europe/Madrid">España (UTC+1)</option>
          </select>
        </Campo>
        <Campo label="Moneda">
          <select value={config.moneda} onChange={e => set('moneda', e.target.value)} style={{ width: '100%', maxWidth: 320 }}>
            <option value="ARS">Peso Argentino (ARS)</option>
            <option value="CLP">Peso Chileno (CLP)</option>
            <option value="COP">Peso Colombiano (COP)</option>
            <option value="MXN">Peso Mexicano (MXN)</option>
            <option value="USD">Dólar (USD)</option>
          </select>
        </Campo>
      </Section>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={guardar} style={{ padding: '10px 24px', border: 'none', borderRadius: 10, background: '#111', color: 'white', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
          Guardar configuración
        </button>
      </div>
    </div>
  )
}