// Piezas de interfaz compartidas por las secciones de Control


export function Chip({ activo, onClick, children, tono = 'brand' }) {
  const color = tono === 'red' ? 'var(--red)' : 'var(--brand)'
  const fondo = tono === 'red' ? 'var(--red-bg)' : 'var(--brand)'
  return (
    <button type="button" onClick={onClick} aria-pressed={activo} style={{ padding: '7px 12px', borderRadius: 20, border: `1.5px solid ${activo ? color : 'var(--border)'}`, background: activo ? fondo : 'var(--bg-card)', color: activo ? (tono === 'red' ? 'var(--red)' : 'white') : 'var(--text-secondary)', fontSize: 13, fontWeight: activo ? 600 : 400, cursor: 'pointer' }}>
      {children}
    </button>
  )
}

export function Interruptor({ id, activo, onChange, titulo, detalle }) {
  return (
    <label htmlFor={id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 0', borderTop: '1px solid var(--border-light)', cursor: 'pointer' }}>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>{titulo}</span>
        {detalle && <span style={{ display: 'block', fontSize: 12, color: 'var(--text-tertiary)' }}>{detalle}</span>}
      </span>
      <input id={id} type="checkbox" checked={activo} onChange={e => onChange(e.target.checked)} style={{ width: 20, height: 20, flexShrink: 0, accentColor: 'var(--brand)' }} />
    </label>
  )
}
