export function PageHead({ eyebrow, title, sub }) {
  return (
    <div className="page-head">
      <p className="eyebrow">{eyebrow}</p>
      <h1 className="page-title">{title}</h1>
      {sub && <p className="page-sub">{sub}</p>}
    </div>
  )
}

export function Metric({ label, value, tone }) {
  return (
    <div className="metric">
      <p className="metric-label">{label}</p>
      <p className="metric-value" style={tone ? { color: tone } : undefined}>{value}</p>
    </div>
  )
}

export function Pill({ kind, children }) {
  return <span className={`pill ${kind}`}>{children}</span>
}

export function ScoreBar({ score, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 120 }}>
      <div className="bar-track">
        <div className="bar-fill" style={{ width: `${score}%`, background: color }} />
      </div>
      <span className="mono" style={{ fontSize: 13, fontWeight: 600, minWidth: 28, textAlign: 'right' }}>{score}</span>
    </div>
  )
}
