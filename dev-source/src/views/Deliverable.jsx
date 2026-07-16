import { useStore, activeEngagement } from '../lib/store'
import { siteConformance, conformanceRate, VERDICTS } from '../lib/graphScoring'
import { detectCollisions, detectConflicts } from '../lib/collisions'
import { legacyGrade, LEGACY_GRADES, LEGACY_ORDER } from '../lib/evidenceModel'
import { PROOF_ITEMS, DECLARED_DATES } from '../lib/proofModel'
import { computeTco, DEFAULT_TCO_INPUTS, fk } from '../lib/tcoModel'
import { MISSING_REASONS, servicesForSite } from '../lib/graph'
import { ENGAGEMENT_DOCS, DOC_STATUS } from '../lib/schema'
import { PageHead, Pill } from '../components/ui'

// Services perimeter — restated verbatim from PRODUCT-SPINE.md §1.
const PERIMETER = 'The following depend on supplied evidence, carrier cooperation, professional review, external data, or site work — the platform structures this work, it does not replace it: physical route validation; entrance-facility independence; KMZ and route-record interpretation; underground/aerial path-separation validation; currency of carrier records; reconciliation of contradictory provider evidence; investigation of unknowns; remediation-design validation.'

const COVERAGE_PILL = { 'verified by platform': 'pill-teal', 'declared by customer': 'pill-amber', 'out of scope': 'pill-gray' }

export default function Deliverable() {
  const s = useStore()
  const eng = activeEngagement(s)
  if (!eng) return <div><PageHead eyebrow="Deliverable" title="Deliverable" sub="Select an engagement." /></div>
  const elements = s.registry.elements || {}
  const generated = new Date().toISOString().slice(0, 10)

  const perSite = eng.sites.map((site) => ({ site, c: siteConformance(eng, elements, site), collisions: detectCollisions(eng, elements, site.id) }))
  const rate = conformanceRate(eng, elements, eng.sites)
  const avg = Math.round(perSite.filter((x) => x.c.score != null).reduce((n, x) => n + x.c.score, 0) / Math.max(1, perSite.filter((x) => x.c.score != null).length))
  const avgCov = Math.round(perSite.reduce((n, x) => n + x.c.coverage, 0) / Math.max(1, perSite.length))

  // derived-grade counts from all service facts
  const gcounts = { ungraded: 0 }
  LEGACY_ORDER.forEach((g) => { gcounts[g] = 0 })
  ;(eng.facts || []).filter((f) => f.subjectType === 'service' && f.outcome).forEach((f) => { gcounts[legacyGrade(f).grade]++ })

  const allCollisions = perSite.flatMap((x) => x.collisions.map((c) => ({ ...c, siteName: x.site.name })))
  const byLayer = {}
  allCollisions.forEach((c) => { (byLayer[c.layer] = byLayer[c.layer] || []).push(c) })
  const conflicts = detectConflicts(eng)
  const missing = (eng.facts || []).filter((f) => f.missingReason)
  const tco = computeTco(DEFAULT_TCO_INPUTS)
  const docs = eng.documents || {}

  const proofLine = (id) => ({
    'map-services': `${eng.sites.length} sites, ${eng.services.length} services, ${Object.keys(elements).length} elements mapped`,
    'validate-providers': `providers referenced by canonical registry id across ${eng.services.length} services`,
    'identify-spof': `${allCollisions.length} shared-fate collisions detected across the graph`,
    'gap-reporting': `${missing.length} unknowns with reasons; ${conflicts.length} conflicts logged`,
    'evidence-retained': `${(eng.facts || []).length} facts retained, each with source, provenance, and date`,
  }[id])

  return (
    <div>
      <div className="no-print">
        <PageHead eyebrow="Deliverable" title={`Deliverable · ${eng.name}`} sub="Generated live from the engagement graph. Print to PDF for the client deliverable." />
        <div style={{ marginBottom: 16 }}><button className="btn btn-primary" onClick={() => window.print()}>Print / export PDF</button></div>
      </div>

      <div className="report-doc" id="deliverable">
        {eng.sample && <div className="sample-watermark">SAMPLE</div>}
        <h4>Diversity Assurance Audit — Evidence-Graded Findings</h4>
        <p className="doc-meta">{eng.client.name || 'Client'} · {eng.name} · generated {generated}{eng.sample ? ' · SAMPLE (synthetic, not a real engagement)' : ''}</p>

        <p style={{ fontWeight: 600, margin: '0 0 4px' }}>Methodology &amp; perimeter</p>
        <p className="small muted" style={{ margin: '0 0 12px' }}>{PERIMETER} Findings are point-in-time verification with defined validity windows, evidence-graded with source attribution; unknowns are enumerated.</p>
        <hr />

        <p style={{ fontWeight: 600, margin: '0 0 8px' }}>Executive summary</p>
        <p style={{ margin: '0 0 8px' }}>{eng.sites.length} sites assessed. Conformance rate <span className="mono" style={{ fontWeight: 600 }}>{rate}%</span>; average diversity score <span className="mono" style={{ fontWeight: 600 }}>{avg}</span>; average evidence coverage <span className="mono" style={{ fontWeight: 600 }}>{avgCov}%</span>.</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '0 0 8px' }}>
          {LEGACY_ORDER.map((g) => <Pill key={g} kind={LEGACY_GRADES[g].pill}>{gcounts[g]} {LEGACY_GRADES[g].label.toLowerCase()}</Pill>)}
        </div>
        <p className="small muted" style={{ margin: 0 }}>Documents: {ENGAGEMENT_DOCS.map((d) => `${d.label} ${DOC_STATUS[(docs[d.id] || {}).status || 'missing'].label.toLowerCase()}`).join(' · ')}</p>
        <hr />

        <p style={{ fontWeight: 600, margin: '0 0 8px' }}>Resilience proof ledger</p>
        {PROOF_ITEMS.map((it, i) => (
          <div key={it.id} style={{ borderTop: '1px solid var(--line)', padding: '6px 0', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <span className="small" style={{ flex: 1, minWidth: 240, fontWeight: 600 }}><span className="mono faint">{String(i + 1).padStart(2, '0')}</span> {it.label}</span>
            <Pill kind={COVERAGE_PILL[it.coverage]}>{it.coverage}</Pill>
            <span className="small muted" style={{ flexBasis: '100%' }}>{it.coverage === 'verified by platform' ? proofLine(it.id) : it.coverage === 'declared by customer' ? `customer attestation dated ${DECLARED_DATES[it.id]}` : it.note}</span>
          </div>
        ))}
        <hr />

        <p style={{ fontWeight: 600, margin: '0 0 8px' }}>Shared-fate findings by layer</p>
        {['L1', 'L2', 'L3', 'adjacent'].filter((l) => byLayer[l]).map((l) => (
          <div key={l} className="print-section" style={{ marginBottom: 8 }}>
            <p className="small" style={{ fontWeight: 600, margin: '0 0 3px' }}>{l} ({byLayer[l].length})</p>
            {byLayer[l].slice(0, 12).map((c, i) => <p key={i} className="small muted" style={{ margin: '2px 0' }}>{c.siteName}: {c.note}</p>)}
          </div>
        ))}
        {allCollisions.length === 0 && <p className="small muted">No shared-fate collisions.</p>}
        <hr />

        <p style={{ fontWeight: 600, margin: '0 0 8px' }}>Per-site element tables</p>
        {perSite.filter((x) => x.collisions.length || x.c.verdict === 'Nonconformant').slice(0, 8).map((x) => (
          <div key={x.site.id} className="print-section" style={{ marginBottom: 10 }}>
            <p className="small" style={{ margin: '0 0 2px' }}><strong>{x.site.name}</strong> — {x.site.tier} · <Pill kind={VERDICTS[x.c.verdict].pill}>{x.c.verdict}</Pill> score {x.c.score} · coverage {x.c.coverage}%</p>
            {servicesForSite(eng, x.site.id).map((svc) => (
              <p key={svc.id} className="small muted mono" style={{ margin: '1px 0' }}>{svc.name}: {(eng.facts || []).filter((f) => f.subjectType === 'service' && f.subjectId === svc.id && f.outcome).map((f) => `${f.dimension}=${f.outcome}`).join(' · ') || '—'}</p>
            ))}
          </div>
        ))}
        <hr />

        <p style={{ fontWeight: 600, margin: '0 0 8px' }}>Cost of inertia</p>
        <p className="small muted" style={{ margin: '0 0 8px' }}>At reference assumptions, unremediated shared fate carries an annual outage exposure of <span className="mono" style={{ fontWeight: 600 }}>{fk(tco.exposure)}</span>; remediation avoids <span className="mono" style={{ fontWeight: 600 }}>{fk(tco.avoided)}</span>/yr{tco.months !== null && `, payback ${tco.months < 1 ? '<1' : Math.round(tco.months)} months`}.</p>
        <hr />

        <p style={{ fontWeight: 600, margin: '0 0 8px' }}>Unknowns — with reasons (annex)</p>
        {missing.length === 0 ? <p className="small muted">No unknowns.</p> : missing.map((f) => <p key={f.id} className="small muted" style={{ margin: '2px 0' }}>{f.dimension}: <Pill kind="pill-gray">{MISSING_REASONS[f.missingReason]}</Pill> (requested {f.capturedDate})</p>)}
      </div>
    </div>
  )
}
