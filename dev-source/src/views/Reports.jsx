import { portfolioStats, remediationPrograms } from '../lib/syntheticData'
import { PageHead, Pill } from '../components/ui'

const catalog = [
  ['Executive portfolio scorecard', 'Quarterly trend, grade distribution, critical-site count, top remediation programs with aggregate payback. One page, board-ready.'],
  ['Site validation report', 'Address, circuit inventory with validation status, entry points, path topology, and the assumption ledger with evidence dates. The artifact for auditors, insurers, and regulators.'],
  ['Remediation business case', 'One per program: affected sites, score lift, outage TCO math, payback. Pre-formatted for a funding decision.'],
  ['Evidence audit / exceptions', 'Everything unvalidated, expired, or mismatched, sorted by risk weight. The working queue that drives the next review cycle.'],
]

export default function Reports() {
  const stats = portfolioStats()
  const programs = remediationPrograms(3)

  return (
    <div>
      <PageHead
        eyebrow="Reporting"
        title="Standardized reports"
        sub="Reports are generated views over the same data model, not separately authored documents — that is what keeps them consistent across hundreds of sites."
      />

      <div className="two-col" style={{ marginBottom: 24 }}>
        {catalog.map(([title, desc]) => (
          <div key={title} className="card" style={{ margin: 0 }}>
            <p className="card-title">{title}</p>
            <p className="small muted" style={{ margin: 0 }}>{desc}</p>
          </div>
        ))}
      </div>

      <p className="card-sub" style={{ marginBottom: 10 }}>Preview · executive portfolio scorecard</p>
      <div className="report-doc">
        <h4>Network diversity portfolio scorecard</h4>
        <p className="doc-meta">Q3 2026 · generated from live assessment data · {stats.total} sites in scope</p>
        <p>
          The portfolio averages a diversity score of <span className="mono" style={{ fontWeight: 600 }}>{stats.avg}</span> across {stats.total} assessed
          sites. <span className="danger" style={{ fontWeight: 600 }}>{stats.critical} sites remain in critical status</span>, carrying {stats.flags} open
          risk flags portfolio-wide. Critical sites share a common profile: logical carrier diversity purchased at contract level,
          undermined by physical convergence at entrance facilities, carrier hotels, and NNIs.
        </p>
        <hr />
        <p style={{ fontWeight: 600, margin: '0 0 8px' }}>Top remediation programs by weighted score recovery</p>
        {programs.map((p, i) => (
          <p key={p.text} style={{ margin: '0 0 6px' }}>
            <span className="mono" style={{ fontWeight: 600 }}>{i + 1}.</span> {p.text}{' '}
            <span className="muted small">— {p.domain}, {p.count} sites, +{Math.round(p.impact)} pts recoverable</span>
          </p>
        ))}
        <hr />
        <p style={{ fontWeight: 600, margin: '0 0 8px' }}>Recommendation</p>
        <p style={{ margin: 0 }}>
          Fund programs 1 and 2 this quarter. Both concentrate in the local loop and backbone domains where a single carrier-side
          engagement remediates dozens of sites simultaneously. Evidence older than 12 months degrades to unvalidated at the next
          review cycle; 41 assumptions are scheduled to expire before Q4.
        </p>
        <div style={{ marginTop: 16 }}>
          <Pill kind="pill-gray">Generated document · export to PDF in a full build</Pill>
        </div>
      </div>
    </div>
  )
}
