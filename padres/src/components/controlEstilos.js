// Estilos compartidos por las secciones de Control

export const tarjeta = { background: 'var(--bg-card)', borderRadius: 16, padding: '1.25rem', border: '1px solid var(--border)', boxShadow: 'var(--shadow)' }
export const tituloTarjeta = { fontSize: 14, fontWeight: 600, margin: '0 0 4px', color: 'var(--text)' }
export const ayuda = { fontSize: 12, color: 'var(--text-secondary)', margin: '0 0 12px', lineHeight: 1.45 }
export const etiqueta = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', margin: '14px 0 6px', textTransform: 'uppercase', letterSpacing: '.5px' }
export const botonGuardar = { width: '100%', marginTop: 14, padding: '12px', border: 'none', borderRadius: 10, background: 'var(--brand)', color: 'var(--on-brand)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }

export const fmt = n => `$${Number(n).toLocaleString('es-AR')}`
