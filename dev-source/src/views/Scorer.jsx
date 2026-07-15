import { useMemo, useState } from 'react'
import { model, computeScore, defaultSelections, gradeOf, gradeMeta, barColor } from '../lib/scoringModel'
import { transportMediums, accessTechOptionIndex } from '../lib/transportMediums'
import { computeDerivedScore } from '../lib/derivedScoring'
import { GRADES } from '../lib/schema'
import { useStore, activeEngagement } from '../lib/store'
import { PageHead, Metric, Pill, ScoreBar } from '../components/ui'

export default function Scorer() {
  const s = useStore()
  const eng = activeEngagement(s)
  if (eng && eng.pairs.length > 0) return <DerivedScorer eng={eng} />
  return <ManualScorer eng={eng} />
}

// --- derived read-out: score computed FROM evidence grades ---

function DerivedScorer({ eng }) {
  const results = eng.pairs.map((pair) => {
    const site = eng.sites.find((x) => x.id === pair.site_id)
    const a = eng.circuits.find((c) => c.id === pair.circuit_a_id)
    const b = eng.circuits.find((c) => c.id === pair.circuit_b_id)
    const cid = (c) => (c && c.layers.identity.circuit_id) || '?'
    return { pair, res: computeDerivedScore(pair, eng.circuits), title: `${site ? site.name : 'Unknown site'} · ${cid(a)} × ${cid(b)}` }
  })
  const avg = Math.round(results.reduce((n, r) => n + r.res.composite, 0) / results.length)
  const avgCoverage = Math.round(results.reduce((n, r) => n + r.res.coverage, 0) / results.length)

  return (
    <div>
      <PageHead
        eyebrow="Assessment"
        title={`Derived diversity scores · ${eng.name}`}
        sub="The composite is computed FROM the evidence grades — grades are the data, the score is a view. Grade layers in Intake & validation and the numbers here update automatically."
      />

      <div className="metric-grid">
        <Metric label="Graded pairs" value={results.length} />
        <Metric label="Average composite" value={avg} />
        <Metric label="Avg evidence coverage" value={`${avgCoverage}%`} tone={avgCoverage < 50 ? 'var(--red)' : undefined} />
      </div>

      {results.map(({ pair, res, title }) => (
        <div key={pair.id} className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <p className="card-title" style={{ margin: 0 }}>{title}</p>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <Pill kind={gradeMeta[res.grade].pill}>{gradeMeta[res.grade].label}</Pill>
              {res.sharedFate > 0 && <Pill kind="pill-red">{res.sharedFate} shared fate</Pill>}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '10px 0 4px' }}>
            <ScoreBar score={res.composite} color={gradeMeta[res.grade].color} />
          </div>
          <p className="small muted" style={{ margin: '0 0 10px' }}>
            Evidence coverage: <strong style={{ color: res.coverage < 50 ? 'var(--red)' : 'var(--ink)' }}>{res.coverage}%</strong> of
            applicable layers carry an evidence reference · {res.graded}/{res.applicable} layers graded
            {res.graded < res.applicable && ' · ungraded layers score as unknown (0.5 of 2)'}
          </p>
          {res.layers.map((l) => (
            <div key={l.id} className="crit-row" style={{ borderTop: '1px solid var(--line)', margin: 0, padding: '7px 0' }}>
              <span className="crit-label" style={{ flexBasis: 150 }}>{l.label} <span className="mono faint" style={{ fontSize: 11 }}>w{l.weight}</span></span>
              <span style={{ flex: 1, minWidth: 160 }}>
                {l.grade
                  ? <Pill kind={GRADES[l.grade].pill}>{GRADES[l.grade].label}</Pill>
                  : <span className="small faint">ungraded — scored as unknown</span>}
              </span>
              <span className="small mono muted" style={{ flex: '0 0 90px', textAlign: 'right' }}>{l.points} / 2 pts</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

// --- manual demo scorer (empty state: no engagement or no pairs) ---

const accessDi = model.findIndex((d) => d.name === 'Local loop / last mile')
const accessCi = model[accessDi].criteria.findIndex((c) => c.label === 'Access technology')

function ManualScorer({ eng }) {
  const [sel, setSel] = useState(defaultSelections)
  const [mediums, setMediums] = useState({ a: '', b: '' })

  const result = useMemo(() => computeScore(sel), [sel])
  const grade = gradeOf(result.composite)

  const setOpt = (di, ci, value) => {
    setSel((prev) => prev.map((d, i) => (i === di ? d.map((v, j) => (j === ci ? Number(value) : v)) : d)))
  }

  const setMedium = (side, id) => {
    const next = { ...mediums, [side]: id }
    setMediums(next)
    const oi = accessTechOptionIndex(next.a, next.b)
    if (oi !== null) setOpt(accessDi, accessCi, oi)
  }

  return (
    <div>
      <PageHead
        eyebrow="Assessment"
        title="Site diversity scorer"
        sub="Score a circuit pair across six weighted domains. Unvalidated claims earn partial credit only — validated diversity is the bar."
      />

      <div className="card" style={{ borderColor: 'var(--teal)' }}>
        <p className="small muted" style={{ margin: 0 }}>
          <strong style={{ color: 'var(--ink)' }}>Manual demo scorer.</strong>{' '}
          {eng
            ? `No graded pairs in ${eng.name} yet — define circuit pairs and grade them in Intake & validation, and this view becomes a derived read-out.`
            : 'Create an engagement and grade circuit pairs in Intake & validation, and this view becomes a derived read-out computed from evidence grades.'}
        </p>
      </div>

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
          {di === accessDi && (
            <>
              {[['a', 'Circuit A access medium'], ['b', 'Circuit B access medium']].map(([side, label]) => (
                <div key={side} className="crit-row">
                  <label className="crit-label" htmlFor={`medium-${side}`}>{label}</label>
                  <select id={`medium-${side}`} value={mediums[side]} onChange={(e) => setMedium(side, e.target.value)}>
                    <option value="">Select medium…</option>
                    {transportMediums.map((m) => (
                      <option key={m.id} value={m.id}>{m.label}</option>
                    ))}
                  </select>
                </div>
              ))}
              <p className="small faint" style={{ margin: '0 0 12px' }}>
                Picking both mediums sets the access-technology criterion below automatically.
              </p>
            </>
          )}
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
