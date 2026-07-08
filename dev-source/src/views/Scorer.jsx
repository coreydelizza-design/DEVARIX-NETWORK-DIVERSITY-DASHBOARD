import { useMemo, useState } from 'react'
import { model, computeScore, defaultSelections, gradeOf, gradeMeta, barColor } from '../lib/scoringModel'
import { PageHead, Metric, Pill, ScoreBar } from '../components/ui'

export default function Scorer() {
  const [sel, setSel] = useState(defaultSelections)

  const result = useMemo(() => computeScore(sel), [sel])
  const grade = gradeOf(result.composite)

  const setOpt = (di, ci, value) => {
    setSel((prev) => prev.map((d, i) => (i === di ? d.map((v, j) => (j === ci ? Number(value) : v)) : d)))
  }

  return (
    <div>
      <PageHead
        eyebrow="Assessment"
        title="Site diversity scorer"
        sub="Score a circuit pair across six weighted domains. Unvalidated claims earn partial credit only — validated diversity is the bar."
      />

      <div className="metric-grid">
        <Metric label="Composite diversity score" value={result.composite} />
        <div className="metric">
          <p className="metric-label">Rating</p>
          <p style={{ margin: 0 }}>
            <Pill kind={gradeMeta[grade].pill}>{gradeMeta[grade].label}</Pill>
          </p>
        </div>
        <Metric label="Open risk flags" value={result.flags.length} tone={result.flags.length ? 'var(--red)' : 'var(--teal)'} />
      </div>

      <div className="bar-track" style={{ height: 10, borderRadius: 5, marginBottom: 24 }}>
        <div className="bar-fill" style={{ width: `${result.composite}%`, background: gradeMeta[grade].color }} />
      </div>

      {model.map((d, di) => (
        <div key={d.name} className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
            <p className="card-title">{d.name}</p>
            <span className="small faint mono">weight {d.weight}%</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0 12px' }}>
            <ScoreBar score={result.domainScores[di]} color={barColor(result.domainScores[di])} />
          </div>
          {d.criteria.map((c, ci) => (
            <div key={c.label} className="crit-row">
              <label className="crit-label" htmlFor={`s-${di}-${ci}`}>{c.label}</label>
              <select id={`s-${di}-${ci}`} value={sel[di][ci]} onChange={(e) => setOpt(di, ci, e.target.value)}>
                {c.opts.map((o, oi) => (
                  <option key={oi} value={oi}>{o[0]}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      ))}

      <div className="card">
        <p className="card-title danger">Risk flags</p>
        {result.flags.length === 0 ? (
          <p className="small ok" style={{ margin: 0 }}>No single points of failure detected in the assessed domains</p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: '1.2rem' }} className="small muted">
            {result.flags.map((f, i) => (
              <li key={i} style={{ marginBottom: 4 }}>
                <strong style={{ color: 'var(--ink)', fontWeight: 600 }}>{f.domain}:</strong> {f.text}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
