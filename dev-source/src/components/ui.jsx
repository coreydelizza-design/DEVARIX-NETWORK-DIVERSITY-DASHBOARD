import { ageInDays, effectiveStatus, agingBand } from '../lib/provenance'

export function AgeBadge({ fact }) {
  const band = agingBand(fact)
  const pill = band === 'fresh' ? 'pill-teal' : band === 'aging' ? 'pill-amber' : 'pill-red'
  const text = band === 'expired' ? `${effectiveStatus(fact)} · expired` : `${effectiveStatus(fact)} · ${ageInDays(fact.evidenceDate)}d`
  return <span className={`pill ${pill}`}>{text}</span>
}

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
