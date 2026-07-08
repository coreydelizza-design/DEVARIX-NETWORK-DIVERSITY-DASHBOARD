import { useMemo, useState } from 'react'
import { sites, portfolioStats, remediationPrograms } from '../lib/syntheticData'
import { gradeMeta } from '../lib/scoringModel'
import { PageHead, Metric, Pill, ScoreBar } from '../components/ui'

const gradeOrder = ['crit', 'exp', 'part', 'res']

export default function Dashboard({ openSite }) {
  const stats = useMemo(() => portfolioStats(), [])
  const programs = useMemo(() => remediationPrograms(5), [])
  const [region, setRegion] = useState('all')
  const [grade, setGrade] = useState('all')
  const [tier, setTier] = useState('all')

  const filtered = useMemo(() => {
    return sites
      .filter(
        (s) =>
          (region === 'all' || s.region === region) &&
          (grade === 'all' || s.grade === grade) &&
          (tier === 'all' || s.tier === tier)
      )
      .sort((a, b) => a.score - b.score)
  }, [region, grade, tier])

  const shown = filtered.slice(0, 12)
  const maxImpact = programs.length ? programs[0].impact : 1

  return (
    <div>
      <PageHead
        eyebrow="Portfolio review"
        title="Global diversity portfolio"
        sub="Every site scored on the same weighted model. Review runs worst-first; remediation rolls up into fundable programs."
      />

      <div className="metric-grid">
        <Metric label="Sites assessed" value={stats.total} />
        <Metric label="Portfolio avg score" value={stats.avg} />
        <Metric label="Critical sites" value={stats.critical} tone="var(--red)" />
        <Metric label="Open risk flags" value={stats.flags} />
      </div>

      <div style={{ marginBottom: 24 }}>
        <div className="dist">
          {gradeOrder.map((g) => (
            <div
              key={g}
              style={{ width: `${(stats.counts[g] / stats.total) * 100}%`, background: gradeMeta[g].color }}
              title={`${gradeMeta[g].label}: ${stats.counts[g]}`}
            />
          ))}
        </div>
        <div className="legend">
          {gradeOrder.map((g) => (
            <span key={g}>
              <span className="legend-swatch" style={{ background: gradeMeta[g].color }} />
              {gradeMeta[g].label} ({stats.counts[g]})
            </span>
          ))}
        </div>
      </div>

      <div className="filters">
        <select value={region} onChange={(e) => setRegion(e.target.value)}>
          <option value="all">All regions</option>
          <option>AMER</option>
          <option>EMEA</option>
          <option>APAC</option>
          <option>LATAM</option>
        </select>
        <select value={grade} onChange={(e) => setGrade(e.target.value)}>
          <option value="all">All ratings</option>
          <option value="crit">Critical only</option>
          <option value="exp">Exposed only</option>
          <option value="part">Partially diverse</option>
          <option value="res">Resilient</option>
        </select>
        <select value={tier} onChange={(e) => setTier(e.target.value)}>
          <option value="all">All site tiers</option>
          <option>Data center</option>
          <option>Regional hub</option>
          <option>Plant</option>
          <option>Branch</option>
        </select>
        <span className="small faint">Showing worst {shown.length} of {filtered.length} sites</span>
      </div>

      <div className="row-list" style={{ marginBottom: 28 }}>
        {shown.map((s) => (
          <div key={s.id} className="row-item">
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <div style={{ flex: '0 0 170px' }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>
                  {s.city} <span className="mono faint" style={{ fontWeight: 400, fontSize: 12 }}>{s.id}</span>
                </div>
                <div className="small muted">{s.region} · {s.tier}</div>
              </div>
              <ScoreBar score={s.score} color={gradeMeta[s.grade].color} />
              <Pill kind={gradeMeta[s.grade].pill}>{gradeMeta[s.grade].label}</Pill>
              <button className="btn" style={{ padding: '5px 10px', fontSize: 13 }} onClick={() => openSite(s)}>
                Open
              </button>
            </div>
            <div className="small muted" style={{ marginTop: 6 }}>
              {s.flags.length} flags · top risk: {s.flags[0] ? s.flags[0][0] : 'none'}
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <p className="card-title">Remediation program queue</p>
        <p className="card-sub">Identical flags rolled up portfolio-wide, ranked by weighted score recovery</p>
        {programs.map((p, i) => (
          <div key={p.text} style={{ margin: '0 0 14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>{i + 1}. {p.text}</span>
              <span className="small muted">{p.domain} · {p.count} sites</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
              <div className="bar-track">
                <div className="bar-fill" style={{ width: `${Math.round((p.impact / maxImpact) * 100)}%`, background: 'var(--violet)' }} />
              </div>
              <span className="mono small" style={{ fontWeight: 600, color: 'var(--muted)' }}>+{Math.round(p.impact)} pts recoverable</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
