import { sites } from '../lib/syntheticData'
import { ageInDays, agingBand } from '../lib/provenance'
import { PageHead, Metric, Pill, AgeBadge } from '../components/ui'

const allFacts = sites.flatMap((s) => s.facts.map((f) => ({ ...f, siteId: s.id, city: s.city })))

// Queue membership: expired, or expiring within 60 days of the
// validity window's end. Exported so other surfaces (e.g. the
// Deliverable) can reference expiring evidence; the view itself is out
// of the nav until the monitoring phase.
export function queueState(f) {
  if (agingBand(f) === 'expired') return 'expired'
  if (f.validityDays - ageInDays(f.evidenceDate) <= 60) return 'expiring'
  return 'ok'
}

export default function RefreshQueue() {
  const expired = allFacts.filter((f) => queueState(f) === 'expired')
  const expiring = allFacts.filter((f) => queueState(f) === 'expiring')

  const carrierTotals = {}
  allFacts.forEach((f) => {
    carrierTotals[f.carrier] = (carrierTotals[f.carrier] || 0) + 1
  })

  const groups = {}
  ;[...expired, ...expiring].forEach((f) => {
    if (!groups[f.carrier]) groups[f.carrier] = []
    groups[f.carrier].push(f)
  })
  const rows = Object.entries(groups)
    .map(([carrier, facts]) => ({
      carrier,
      facts,
      siteCount: new Set(facts.map((f) => f.siteId)).size,
      expiredCount: facts.filter((f) => queueState(f) === 'expired').length,
      tier: facts.length / carrierTotals[carrier] < 0.3 ? 'delta refresh' : 'full refresh',
    }))
    .sort((a, b) => b.facts.length - a.facts.length)

  return (
    <div>
      <PageHead
        eyebrow="Refresh planning"
        title="Refresh queue"
        sub="Derived entirely from evidence expiry: everything expired or expiring within 60 days, grouped by carrier — refresh cost is driven by LOA cycles per carrier."
      />

      <div className="metric-grid">
        <Metric label="Facts expired" value={expired.length} tone="var(--red)" />
        <Metric label="Expiring within 60 days" value={expiring.length} />
        <Metric label="Carriers involved" value={rows.length} />
      </div>

      {rows.map((g) => (
        <div key={g.carrier} className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <div>
              <p className="card-title" style={{ margin: 0 }}>{g.carrier}</p>
              <p className="small muted" style={{ margin: '2px 0 0' }}>
                {g.expiredCount} expired · {g.facts.length - g.expiredCount} expiring · {g.siteCount} sites affected
              </p>
            </div>
            <Pill kind={g.tier === 'full refresh' ? 'pill-red' : 'pill-blue'}>{g.tier}</Pill>
          </div>
          <div className="row-list" style={{ marginTop: 10 }}>
            {g.facts.slice(0, 5).map((f, i) => (
              <div key={`${f.siteId}-${f.label}-${i}`} className="row-item">
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontSize: 13.5 }}>
                    {f.label} <span className="mono faint" style={{ fontSize: 12 }}>{f.siteId} · {f.city}</span>
                  </span>
                  <AgeBadge fact={f} />
                </div>
              </div>
            ))}
          </div>
          {g.facts.length > 5 && (
            <p className="small faint" style={{ margin: '8px 0 0' }}>+{g.facts.length - 5} more</p>
          )}
        </div>
      ))}

      <p className="small muted" style={{ margin: 0 }}>
        Refresh scope is derived from evidence expiry. Standing LOA assumed in force.
      </p>
    </div>
  )
}
