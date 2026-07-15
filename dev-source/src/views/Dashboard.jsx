import { useMemo, useState } from 'react'
import { sites, remediationPrograms, factBands } from '../lib/syntheticData'
import { gradeMeta } from '../lib/scoringModel'
import { computeConformance, conformanceRate, VERDICTS, VERDICT_ORDER } from '../lib/conformance'
import SiteCard from '../components/SiteCard'
import { PageHead, Metric } from '../components/ui'

const gradeOrder = ['crit', 'exp', 'part', 'res']
// The measurement distribution renders neutrally — color encodes the
// verdict, never the raw score.
const GRADE_NEUTRALS = { crit: '#3f4650', exp: '#6b7280', part: '#9aa1a9', res: '#cdd2d8' }
const VERDICT_DISPLAY = ['Conformant', 'Conformant · at risk', 'Nonconformant', 'Over-provisioned', 'Not assessed']

export default function Dashboard({ openSite }) {
  const judged = useMemo(() => sites.map((site) => ({ site, c: computeConformance(site) })), [])
  const rate = useMemo(() => conformanceRate(sites), [])
  const bands = useMemo(() => factBands(), [])
  const [region, setRegion] = useState('all')
  const [verdict, setVerdict] = useState('all')
  const [fn, setFn] = useState('all')

  const counts = {}
  VERDICT_DISPLAY.forEach((v) => { counts[v] = 0 })
  judged.forEach(({ c }) => { counts[c.verdict]++ })
  const assessedCount = sites.length - counts['Not assessed']
  const factTotal = bands.fresh + bands.aging + bands.expired
  const freshPct = Math.round((bands.fresh / factTotal) * 100)

  const gradeCounts = { crit: 0, exp: 0, part: 0, res: 0 }
  sites.forEach((s) => { gradeCounts[s.grade]++ })

  const programs = useMemo(() => remediationPrograms(5), [])
  const maxImpact = programs.length ? programs[0].impact : 1

  const filtered = judged
    .filter(({ site, c }) =>
      (region === 'all' || site.region === region) &&
      (fn === 'all' || site.tier === fn) &&
      (verdict === 'all' || c.verdict === verdict)
    )
    .sort((a, b) => {
      const d = VERDICT_ORDER.indexOf(a.c.verdict) - VERDICT_ORDER.indexOf(b.c.verdict)
      if (d !== 0) return d
      if (a.c.verdict === 'Conformant · at risk') {
        const ea = a.c.soonestExpiry ? a.c.soonestExpiry.days : 1e9
        const eb = b.c.soonestExpiry ? b.c.soonestExpiry.days : 1e9
        return ea - eb
      }
      return a.site.score - b.site.score
    })

  return (
    <div>
      <PageHead
        eyebrow="Portfolio review"
        title="Portfolio conformance"
        sub="Every site is measured on the same weighted model, then judged against its resilience tier. The score is the measurement; the verdict is the judgment."
      />

      <div className="metric-grid">
        <Metric label="Conformance rate" value={`${rate}%`} />
        <Metric label="Sites assessed" value={assessedCount} />
        <Metric label="Nonconformant sites" value={counts.Nonconformant} tone="var(--red)" />
        <Metric label="Evidence fresh %" value={`${freshPct}%`} />
      </div>

      <div style={{ marginBottom: 16 }}>
        <div className="dist">
          {VERDICT_DISPLAY.map((v) => (
            <div key={v} style={{ width: `${(counts[v] / sites.length) * 100}%`, background: VERDICTS[v].color }} title={`${v}: ${counts[v]}`} />
          ))}
        </div>
        <div className="legend">
          {VERDICT_DISPLAY.map((v) => (
            <span key={v}>
              <span className="legend-swatch" style={{ background: VERDICTS[v].color }} />
              {v} ({counts[v]})
            </span>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 24 }}>
        <div className="dist" style={{ height: 8 }}>
          {gradeOrder.map((g) => (
            <div key={g} style={{ width: `${(gradeCounts[g] / sites.length) * 100}%`, background: GRADE_NEUTRALS[g] }} title={`${gradeMeta[g].label}: ${gradeCounts[g]}`} />
          ))}
        </div>
        <div className="legend">
          <span style={{ fontWeight: 600 }}>Measurement distribution (diversity score)</span>
          {gradeOrder.map((g) => (
            <span key={g}>
              <span className="legend-swatch" style={{ background: GRADE_NEUTRALS[g] }} />
              {gradeMeta[g].label} ({gradeCounts[g]})
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
        <select value={verdict} onChange={(e) => setVerdict(e.target.value)}>
          <option value="all">All verdicts</option>
          {VERDICT_DISPLAY.map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>
        <select value={fn} onChange={(e) => setFn(e.target.value)}>
          <option value="all">All site functions</option>
          <option>Data center</option>
          <option>Regional hub</option>
          <option>Plant</option>
          <option>Branch</option>
        </select>
        <span className="small faint">Showing {filtered.length} of {sites.length} sites</span>
      </div>

      <div className="site-grid">
        {filtered.map(({ site, c }) => (
          <SiteCard key={site.id} site={site} conformance={c} onOpen={() => openSite(site)} />
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
