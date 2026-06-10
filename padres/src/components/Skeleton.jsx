export function SkeletonLine({ width = '100%', height = 14, style = {} }) {
  return <div className="skeleton" style={{ width, height, ...style }} />
}

export function SkeletonCircle({ size = 40, style = {} }) {
  return <div className="skeleton" style={{ width: size, height: size, borderRadius: '50%', ...style }} />
}

export function SkeletonCard({ style = {} }) {
  return (
    <div style={{ background: 'var(--bg-card)', border: '1.5px solid var(--border)', borderRadius: 14, padding: '1.25rem', ...style }}>
      <SkeletonLine width="40%" height={12} style={{ marginBottom: 12 }} />
      <SkeletonLine width="60%" height={24} />
    </div>
  )
}

export function SkeletonCards({ count = 4 }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
      {Array.from({ length: count }).map((_, i) => <SkeletonCard key={i} />)}
    </div>
  )
}

export function SkeletonTable({ rows = 6, cols = 4 }) {
  return (
    <div style={{ background: 'var(--bg-card)', border: '1.5px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} style={{ display: 'flex', gap: 16, padding: '14px 18px', borderBottom: r < rows - 1 ? '1px solid var(--border-light)' : 'none' }}>
          {Array.from({ length: cols }).map((_, c) => (
            <SkeletonLine key={c} width={c === 0 ? '25%' : `${100 / cols}%`} height={14} />
          ))}
        </div>
      ))}
    </div>
  )
}
