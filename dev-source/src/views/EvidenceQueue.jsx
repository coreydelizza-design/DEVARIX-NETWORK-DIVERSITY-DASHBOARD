import { useStore, activeEngagement } from '../lib/store'
import { detectCollisions, detectConflicts } from '../lib/collisions'
import { MISSING_REASONS } from '../lib/graph'
import { ageInDays } from '../lib/provenance'
import { PageHead, Metric, Pill } from '../components/ui'

// Absorbs RefreshQueue: the engagement's open work — missing-by-reason,
// conflicts awaiting adjudication, expiring evidence, open collision
// proposals. Every row deep-links to the owning site.
export default function EvidenceQueue({ openSiteTab }) {
  const s = useStore()
  const eng = activeEngagement(s)
  if (!eng) return <div><PageHead eyebrow="Evidence queue" title="Evidence queue" sub="Select an engagement." /></div>
  const elements = s.registry.elements || {}
  const siteOf = (svcId) => (eng.services.find((x) => x.id === svcId) || {}).site_id
  const siteName = (siteId) => (eng.sites.find((x) => x.id === siteId) || {}).name || siteId

  const missing = (eng.facts || []).filter((f) => f.missingReason).map((f) => ({ f, siteId: siteOf(f.subjectId) }))
  const conflicts = detectConflicts(eng).map((c) => ({ c, siteId: siteOf(c.subjectId) }))
  const expiring = (eng.facts || []).filter((f) => f.outcome && ageInDays(f.capturedDate) > (f.validityDays || 365) - 60).map((f) => ({ f, siteId: siteOf(f.subjectId), over: ageInDays(f.capturedDate) - (f.validityDays || 365) }))
  const proposals = eng.sites.flatMap((site) => detectCollisions(eng, elements, site.id).map((c) => ({ c, siteId: site.id })))

  const Row = ({ siteId, tab, children }) => (
    <div className="row-item" style={{ cursor: 'pointer' }} onClick={() => openSiteTab(siteId, tab)}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>{children}<span className="small faint" style={{ marginLeft: 'auto' }}>{siteName(siteId)} →</span></div>
    </div>
  )

  return (
    <div>
      <PageHead eyebrow="Evidence queue" title={`Evidence queue · ${eng.name}`} sub="The engagement's open work. Rows deep-link to the owning site." />
      <div className="metric-grid">
        <Metric label="Missing (by reason)" value={missing.length} />
        <Metric label="Conflicts" value={conflicts.length} tone={conflicts.length ? 'var(--red)' : undefined} />
        <Metric label="Expiring / expired" value={expiring.length} tone="var(--amber, #c07f16)" />
        <Metric label="Collision proposals" value={proposals.length} tone="var(--red)" />
      </div>

      <div className="card">
        <p className="card-title">Missing — pending against the carrier clock</p>
        {missing.length === 0 ? <p className="small muted" style={{ margin: 0 }}>Nothing missing.</p> : missing.map(({ f, siteId }) => (
          <Row key={f.id} siteId={siteId} tab="infra"><Pill kind="pill-gray">{MISSING_REASONS[f.missingReason]}</Pill><span className="small">{f.dimension}</span><span className="small faint mono">requested {f.capturedDate} · {ageInDays(f.capturedDate)}d ago</span></Row>
        ))}
      </div>

      <div className="card">
        <p className="card-title">Conflicts awaiting adjudication</p>
        {conflicts.length === 0 ? <p className="small muted" style={{ margin: 0 }}>No open conflicts.</p> : conflicts.map(({ c, siteId }) => (
          <Row key={c.id} siteId={siteId} tab="infra"><Pill kind={c.adjudicated ? 'pill-teal' : 'pill-red'}>{c.adjudicated ? 'adjudicated' : 'conflict'}</Pill><span className="small">{c.dimension} — {c.facts.length} sources disagree</span></Row>
        ))}
      </div>

      <div className="card">
        <p className="card-title">Expiring evidence</p>
        {expiring.length === 0 ? <p className="small muted" style={{ margin: 0 }}>All evidence within its validity window.</p> : expiring.slice(0, 20).map(({ f, siteId, over }) => (
          <Row key={f.id} siteId={siteId} tab="infra"><Pill kind={over > 0 ? 'pill-red' : 'pill-amber'}>{over > 0 ? `expired ${over}d` : 'expiring'}</Pill><span className="small">{f.dimension}</span><span className="small faint mono">captured {f.capturedDate}</span></Row>
        ))}
        {expiring.length > 20 && <p className="small faint" style={{ margin: '6px 0 0' }}>+{expiring.length - 20} more</p>}
      </div>

      <div className="card">
        <p className="card-title">Open collision proposals</p>
        {proposals.length === 0 ? <p className="small muted" style={{ margin: 0 }}>No shared-fate collisions.</p> : proposals.slice(0, 20).map(({ c, siteId }) => (
          <Row key={`${siteId}-${c.id}`} siteId={siteId} tab="infra"><Pill kind={c.severity === 'high' ? 'pill-red' : 'pill-amber'}>{c.layer}</Pill><span className="small">{c.note}</span></Row>
        ))}
        {proposals.length > 20 && <p className="small faint" style={{ margin: '6px 0 0' }}>+{proposals.length - 20} more</p>}
      </div>
    </div>
  )
}
