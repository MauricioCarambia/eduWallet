import { useState, useEffect } from 'react'
import api from '../api/axios'

function Campo({ label, hint, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
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
  const [config, setConfig] = useState({
    nombre_colegio: '', direccion: '', telefono: '', email_admin: '',
    email_smtp: '', email_smtp_pass: '', email_smtp_host: 'smtp.gmail.com',
    email_smtp_port: 587, umbral_saldo_bajo: 200, umbral_stock_bajo: 3, moneda: 'ARS'
  })
  const [msg, setMsg] = useState(null)
  const [testEmail, setTestEmail] = useState('')
  const [enviandoTest, setEnviandoTest] = useState(false)
  const [cargando, setCargando] = useState(true)

  const showMsg = (tipo, texto) => { setMsg({ tipo, texto }); setTimeout(() => setMsg(null), 4000) }

  useEffect(() => { cargar() }, [])

  const cargar = async () => {
    try {
      const res = await api.get('/configuracion')
      if (res.data && res.data.id) setConfig(prev => ({ ...prev, ...res.data, email_smtp_pass: '' }))
    } catch (err) {
      console.error(err)
    } finally {
      setCargando(false)
    }
  }

  const guardar = async () => {
    try {
      await api.put('/configuracion', config)
      showMsg('ok', 'Configuración guardada correctamente')
    } catch (err) {
      showMsg('error', 'Error al guardar')
    }
  }

  const enviarTest = async () => {
    if (!testEmail) return
    setEnviandoTest(true)
    try {
      await api.post('/configuracion/test-email', { email: testEmail })
      showMsg('ok', `Email de prueba enviado a ${testEmail}`)
    } catch (err) {
      showMsg('error', err.response?.data?.error || 'Error al enviar email de prueba')
    } finally {
      setEnviandoTest(false)
    }
  }

  const set = (key, val) => setConfig(prev => ({ ...prev, [key]: val }))

  if (cargando) return <div style={{ color: '#999' }}>Cargando...</div>

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, margin: '0 0 4px' }}>Configuración</h1>
        <p style={{ color: '#999', fontSize: 13, margin: 0 }}>Parámetros generales del sistema</p>
      </div>

      {msg && <div style={{ padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16, background: msg.tipo === 'ok' ? '#F0FDF4' : '#FEF2F2', color: msg.tipo === 'ok' ? '#16A34A' : '#DC2626' }}>{msg.texto}</div>}

      <Section title="Datos del colegio">
        <Campo label="Nombre del colegio">
          <input value={config.nombre_colegio} onChange={e => set('nombre_colegio', e.target.value)} placeholder="Ej: Colegio San Martín" style={{ width: '100%' }} />
        </Campo>
        <Campo label="Dirección">
          <input value={config.direccion} onChange={e => set('direccion', e.target.value)} placeholder="Ej: Av. Siempreviva 742" style={{ width: '100%' }} />
        </Campo>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Campo label="Teléfono">
            <input value={config.telefono} onChange={e => set('telefono', e.target.value)} placeholder="011-4444-5555" style={{ width: '100%' }} />
          </Campo>
          <Campo label="Email de administración">
            <input type="email" value={config.email_admin} onChange={e => set('email_admin', e.target.value)} placeholder="admin@colegio.edu.ar" style={{ width: '100%' }} />
          </Campo>
        </div>
      </Section>

      <Section title="Configuración de email para notificaciones">
        <p style={{ fontSize: 13, color: '#666', margin: '0 0 16px' }}>
          Configurá el email desde el cual se enviarán las notificaciones a los padres. Podés usar Gmail, Outlook o cualquier servidor SMTP.
        </p>
        <Campo label="Email remitente (SMTP)" hint="El email desde el que se envían las notificaciones">
          <input type="email" value={config.email_smtp} onChange={e => set('email_smtp', e.target.value)} placeholder="notificaciones@colegio.edu.ar" style={{ width: '100%' }} />
        </Campo>
        <Campo label="Contraseña de aplicación" hint="Para Gmail: activá verificación en dos pasos y creá una contraseña de aplicación en myaccount.google.com">
          <input type="password" value={config.email_smtp_pass} onChange={e => set('email_smtp_pass', e.target.value)} placeholder="Dejá vacío para no cambiarla" style={{ width: '100%' }} />
        </Campo>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Campo label="Servidor SMTP">
            <input value={config.email_smtp_host} onChange={e => set('email_smtp_host', e.target.value)} placeholder="smtp.gmail.com" style={{ width: '100%' }} />
          </Campo>
          <Campo label="Puerto SMTP">
            <input type="number" value={config.email_smtp_port} onChange={e => set('email_smtp_port', e.target.value)} placeholder="587" style={{ width: '100%' }} />
          </Campo>
        </div>
        <div style={{ background: '#F8F9FA', borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
          <p style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 500, color: '#555' }}>Configuraciones comunes</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[
              { label: 'Gmail', host: 'smtp.gmail.com', port: 587 },
              { label: 'Outlook', host: 'smtp.office365.com', port: 587 },
              { label: 'Yahoo', host: 'smtp.mail.yahoo.com', port: 587 },
            ].map(p => (
              <button key={p.label} onClick={() => { set('email_smtp_host', p.host); set('email_smtp_port', p.port) }}
                style={{ padding: '4px 10px', border: '1px solid #F0F0F0', borderRadius: 6, background: 'white', fontSize: 12, cursor: 'pointer', color: '#666' }}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input type="email" placeholder="Email para probar" value={testEmail} onChange={e => setTestEmail(e.target.value)} style={{ flex: 1 }} />
          <button onClick={enviarTest} disabled={enviandoTest || !testEmail} style={{ padding: '0 16px', border: 'none', borderRadius: 8, background: '#111', color: 'white', fontSize: 13, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap', opacity: enviandoTest ? 0.7 : 1 }}>
            {enviandoTest ? 'Enviando...' : 'Probar email'}
          </button>
        </div>
      </Section>

      <Section title="Alertas">
        <Campo label="Umbral de saldo bajo" hint="Se enviará una alerta cuando el saldo baje de este monto">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, color: '#666' }}>$</span>
            <input type="number" value={config.umbral_saldo_bajo} onChange={e => set('umbral_saldo_bajo', e.target.value)} style={{ width: 120 }} />
          </div>
        </Campo>
        <Campo label="Umbral de stock bajo" hint="Se mostrará una alerta cuando el stock baje de esta cantidad">
          <input type="number" value={config.umbral_stock_bajo} onChange={e => set('umbral_stock_bajo', e.target.value)} style={{ width: 120 }} />
        </Campo>
      </Section>

      <Section title="Sistema">
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