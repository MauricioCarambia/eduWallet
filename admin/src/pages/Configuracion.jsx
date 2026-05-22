import { useState, useEffect } from 'react'
import api from '../api/axios'

function Campo({ label, hint, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.5px' }}>{label}</label>
      {children}
      {hint && <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--text-tertiary)' }}>{hint}</p>}
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: '1.25rem', border: '1.5px solid var(--border)', marginBottom: 16, boxShadow: 'var(--shadow)' }}>
      <h2 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 16px', paddingBottom: 12, borderBottom: '1px solid var(--border-light)', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.5px' }}>{title}</h2>
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
  const [haciendoBackup, setHaciendoBackup] = useState(false)

  const showMsg = (tipo, texto) => { setMsg({ tipo, texto }); setTimeout(() => setMsg(null), 4000) }

  useEffect(() => { cargar() }, [])

  const cargar = async () => {
    try {
      const res = await api.get('/configuracion')
      if (res.data?.id) setConfig(p => ({ ...p, ...res.data, email_smtp_pass: '' }))
    } catch (err) { console.error(err) }
    finally { setCargando(false) }
  }

  const guardar = async () => {
    try {
      await api.put('/configuracion', config)
      showMsg('ok', 'Configuración guardada correctamente')
    } catch { showMsg('error', 'Error al guardar') }
  }

  const enviarTest = async () => {
    if (!testEmail) return
    setEnviandoTest(true)
    try {
      await api.post('/configuracion/test-email', { email: testEmail })
      showMsg('ok', `Email de prueba enviado a ${testEmail}`)
    } catch (err) { showMsg('error', err.response?.data?.error || 'Error al enviar') }
    finally { setEnviandoTest(false) }
  }

  const descargarBackup = async () => {
    setHaciendoBackup(true)
    try {
      const res = await api.get('/backup/descargar', { responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a'); a.href = url; a.download = `eduwallet-backup-${new Date().toISOString().slice(0, 10)}.sql`; a.click()
      URL.revokeObjectURL(url)
      showMsg('ok', 'Backup descargado correctamente')
    } catch { showMsg('error', 'Error al descargar backup') }
    finally { setHaciendoBackup(false) }
  }

  const enviarBackupEmail = async () => {
    setHaciendoBackup(true)
    try {
      await api.post('/backup/email')
      showMsg('ok', 'Backup enviado por email correctamente')
    } catch (err) { showMsg('error', err.response?.data?.error || 'Error al enviar backup') }
    finally { setHaciendoBackup(false) }
  }

  const set = (key, val) => setConfig(p => ({ ...p, [key]: val }))

  if (cargando) return <div style={{ color: 'var(--text-tertiary)' }}>Cargando...</div>

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 4px', color: 'var(--text)' }}>Configuración</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: 0 }}>Parámetros generales del sistema</p>
      </div>

      {msg && <div style={{ padding: '10px 14px', borderRadius: 'var(--radius)', fontSize: 13, marginBottom: 16, background: msg.tipo === 'ok' ? 'var(--green-bg)' : 'var(--red-bg)', color: msg.tipo === 'ok' ? 'var(--green)' : 'var(--red)', borderLeft: `3px solid ${msg.tipo === 'ok' ? 'var(--green)' : 'var(--red)'}` }}>{msg.texto}</div>}

      <Section title="Datos del colegio">
        <Campo label="Nombre del colegio">
          <input value={config.nombre_colegio} onChange={e => set('nombre_colegio', e.target.value)} placeholder="Ej: Colegio San Martín" />
        </Campo>
        <Campo label="Dirección">
          <input value={config.direccion} onChange={e => set('direccion', e.target.value)} placeholder="Av. Siempreviva 742" />
        </Campo>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Campo label="Teléfono"><input value={config.telefono} onChange={e => set('telefono', e.target.value)} placeholder="011-4444-5555" /></Campo>
          <Campo label="Email de administración"><input type="email" value={config.email_admin} onChange={e => set('email_admin', e.target.value)} placeholder="admin@colegio.edu.ar" /></Campo>
        </div>
      </Section>

      <Section title="Notificaciones por email">
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 16px' }}>
          Configurá el servidor SMTP para enviar notificaciones a los padres. Para Gmail activá la verificación en dos pasos y creá una contraseña de aplicación en <b>myaccount.google.com</b>.
        </p>
        <Campo label="Email remitente">
          <input type="email" value={config.email_smtp} onChange={e => set('email_smtp', e.target.value)} placeholder="notificaciones@colegio.edu.ar" />
        </Campo>
        <Campo label="Contraseña de aplicación" hint="Dejá vacío para no cambiarla">
          <input type="password" value={config.email_smtp_pass} onChange={e => set('email_smtp_pass', e.target.value)} placeholder="••••••••••••••••" />
        </Campo>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Campo label="Servidor SMTP"><input value={config.email_smtp_host} onChange={e => set('email_smtp_host', e.target.value)} placeholder="smtp.gmail.com" /></Campo>
          <Campo label="Puerto SMTP"><input type="number" value={config.email_smtp_port} onChange={e => set('email_smtp_port', e.target.value)} /></Campo>
        </div>
        <div style={{ background: 'var(--bg)', borderRadius: 'var(--radius)', padding: '10px 14px', marginBottom: 14, border: '1px solid var(--border)' }}>
          <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.5px' }}>Configuraciones rápidas</p>
          <div style={{ display: 'flex', gap: 6 }}>
            {[{ label: 'Gmail', host: 'smtp.gmail.com', port: 587 }, { label: 'Outlook', host: 'smtp.office365.com', port: 587 }, { label: 'Mailtrap', host: 'sandbox.smtp.mailtrap.io', port: 587 }].map(p => (
              <button key={p.label} onClick={() => { set('email_smtp_host', p.host); set('email_smtp_port', p.port) }}
                style={{ padding: '4px 12px', border: '1.5px solid var(--border)', borderRadius: 6, background: 'var(--bg-card)', fontSize: 12, cursor: 'pointer', color: 'var(--text-secondary)', fontWeight: 500 }}>{p.label}</button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input type="email" placeholder="Email para probar" value={testEmail} onChange={e => setTestEmail(e.target.value)} style={{ flex: 1 }} />
          <button onClick={enviarTest} disabled={enviandoTest || !testEmail} style={{ padding: '0 16px', border: 'none', borderRadius: 'var(--radius)', background: '#1E3A5F', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: enviandoTest ? 0.7 : 1, whiteSpace: 'nowrap' }}>
            {enviandoTest ? 'Enviando...' : 'Probar email'}
          </button>
        </div>
      </Section>

      <Section title="Alertas">
        <Campo label="Umbral de saldo bajo" hint="Se enviará una alerta cuando el saldo baje de este monto">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>$</span>
            <input type="number" value={config.umbral_saldo_bajo} onChange={e => set('umbral_saldo_bajo', e.target.value)} style={{ width: 120 }} />
          </div>
        </Campo>
        <Campo label="Umbral de stock bajo" hint="Alerta cuando el stock baje de esta cantidad">
          <input type="number" value={config.umbral_stock_bajo} onChange={e => set('umbral_stock_bajo', e.target.value)} style={{ width: 120 }} />
        </Campo>
      </Section>

      <Section title="Backup de base de datos">
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 14px' }}>El sistema hace un backup automático todos los días a las 3am y lo envía al email de administración.</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={descargarBackup} disabled={haciendoBackup} style={{ padding: '8px 16px', border: 'none', borderRadius: 'var(--radius)', background: '#1E3A5F', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: haciendoBackup ? 0.7 : 1 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Descargar backup
          </button>
          <button onClick={enviarBackupEmail} disabled={haciendoBackup} style={{ padding: '8px 16px', border: '1.5px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--bg-card)', fontSize: 13, cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
            Enviar por email
          </button>
        </div>
        <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--text-tertiary)' }}>El backup se envía al email de administración configurado arriba.</p>
      </Section>

      <Section title="Sistema">
        <Campo label="Moneda">
          <select value={config.moneda} onChange={e => set('moneda', e.target.value)} style={{ maxWidth: 320 }}>
            <option value="ARS">Peso Argentino (ARS)</option>
            <option value="CLP">Peso Chileno (CLP)</option>
            <option value="COP">Peso Colombiano (COP)</option>
            <option value="MXN">Peso Mexicano (MXN)</option>
            <option value="USD">Dólar (USD)</option>
          </select>
        </Campo>
      </Section>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={guardar} style={{ padding: '10px 28px', border: 'none', borderRadius: 'var(--radius)', background: '#1E3A5F', color: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer', boxShadow: '0 2px 8px rgba(30,58,95,0.3)' }}>
          Guardar configuración
        </button>
      </div>
    </div>
  )
}