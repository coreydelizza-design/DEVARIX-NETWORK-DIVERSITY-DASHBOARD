import { LAYERS, ENGAGEMENT_DOCS, DOC_STATUS } from '../lib/schema'
import { legacyGrade, LEGACY_GRADES, LEGACY_ORDER, effectiveProvenance } from '../lib/evidenceModel'
import { PROOF_ITEMS, DECLARED_DATES } from '../lib/proofModel'
import { useStore, activeEngagement } from '../lib/store'
import { computeDerivedScore } from '../lib/derivedScoring'
import { computeTco, DEFAULT_TCO_INPUTS, fk } from '../lib/tcoModel'
import { gradeMeta } from '../lib/scoringModel'
import { PageHead, Pill } from '../components/ui'

const COVERAGE_PILL = {
  'verified by platform': 'pill-teal',
  'declared by customer': 'pill-amber',
  'out of scope': 'pill-gray',
}

function layerValue(registry, c, layerId) {
  if (!c) return '—'
  const L = c.layers[layerId] || {}
  const clli = (ref) => (registry.clli.find((e) => e.id === ref) || {}).key || ''
  const ent = (kind, ref) => ((registry[kind] || []).find((e) => e.id === ref) || {}).label || ''
  const tri = (v, label) => (v && v !== 'unknown' ? `${label} ${v}` : '')
  const parts = {
    identity: [L.circuit_id, ent('carrier', L.carrier_ref), L.service_type],
    loop: [L.access_type === 'type2' ? 'Type II' : L.access_type === 'onnet' ? 'On-net' : '', ent('accessVendor', L.access_provider_ref), clli(L.wire_center_ref)],
    entrance: [L.conduit, L.demarc, L.power],
    nni: [clli(L.nni_clli_ref), ent('nniId', L.nni_id_ref)],
    route: [tri(L.kmz_received, 'KMZ'), L.overlap_segments],
    pop: [clli(L.pop_clli_ref), L.router_node, L.shelf_card_port],
    logical: [ent('asn', L.egress_asn_ref), tri(L.bgp_multihoming, 'BGP'), tri(L.traceroute_divergence, 'TR div')],
  }[layerId] || []
  return parts.filter(Boolean).join(' · ') || '—'
}

function recordPill(record) {
  const lg = legacyGrade(record)
  return <Pill kind={LEGACY_GRADES[lg.grade].pill}>{LEGACY_GRADES[lg.grade].label}{lg.suspected ? ' · suspected' : ''}</Pill>
}

export default function FindingsReport() {
  const s = useStore()
  const eng = activeEngagement(s)
  const registry = s.registry

  if (!eng || eng.pairs.length === 0) {
    return (
      <div>
        <PageHead
          eyebrow="Deliverable"
          title="Deliverable"
          sub="The evidence-graded findings report is generated from the active engagement's graded circuit pairs."
        />
        <div className="card" style={{ borderColor: 'var(--teal)' }}>
          <p className="small muted" style={{ margin: 0 }}>
            {eng
              ? `No graded pairs in ${eng.name} yet. Define and grade circuit pairs in the Evidence & checks step — the report generates itself from those records.`
              : 'No active engagement. Create or select one in the Engagement step, capture circuits, and grade pairs — the report generates itself from those records.'}
          </p>
        </div>
      </div>
    )
  }

  const results = eng.pairs.map((pair) => ({
    pair,
    site: eng.sites.find((x) => x.id === pair.site_id),
    a: eng.circuits.find((c) => c.id === pair.circuit_a_id),
    b: eng.circuits.find((c) => c.id === pair.circuit_b_id),
    res: computeDerivedScore(pair, eng.circuits),
  }))

  const counts = { ungraded: 0 }
  LEGACY_ORDER.forEach((g) => { counts[g] = 0 })
  let suspectedCount = 0
  let sharedTotal = 0
  let recordTotal = 0
  let gradedDates = []
  const decayedRecords = []
  results.forEach(({ pair, site, a, b, res }) => {
    res.layers.forEach((l) => {
      const g = pair.grades[l.id]
      if (g) {
        recordTotal++
        const lg = legacyGrade(g)
        counts[lg.grade]++
        if (lg.suspected) suspectedCount++
        if (g.outcome === 'shared') sharedTotal++
        gradedDates.push(g.verified_date)
        if (effectiveProvenance(g) !== g.provenance) {
          decayedRecords.push({
            layer: l.label,
            pairLabel: `${(a && a.layers.identity.circuit_id) || '?'} × ${(b && b.layers.identity.circuit_id) || '?'}`,
            siteName: site ? site.name : 'Unknown site',
            stored: g.provenance,
            effective: effectiveProvenance(g),
            verified: g.verified_date,
          })
        }
      } else counts.ungraded++
    })
  })
  gradedDates = gradedDates.sort()
  const avg = Math.round(results.reduce((n, r) => n + r.res.composite, 0) / results.length)
  const avgCoverage = Math.round(results.reduce((n, r) => n + r.res.coverage, 0) / results.length)
  const generated = new Date().toISOString().slice(0, 10)
  const tco = computeTco(DEFAULT_TCO_INPUTS)
  const docs = eng.documents || {}
  const cid = (c) => (c && c.layers.identity.circuit_id) || '?'
  const carriersUsed = new Set(eng.circuits.map((c) => c.layers.identity.carrier_ref).filter(Boolean))

  const bySite = eng.sites
    .map((site) => ({ site, pairs: results.filter((r) => r.pair.site_id === site.id) }))
    .filter((g) => g.pairs.length > 0)

  // Resilience proof ledger, computed from engagement data where the
  // platform can prove it; declared/out-of-scope items render honestly.
  const proofLines = {
    'map-services': `${eng.sites.length} sites, ${eng.circuits.length} circuits, ${eng.pairs.length} pairs mapped across seven layers`,
    'validate-providers': `${carriersUsed.size} carriers referenced by canonical registry id across ${eng.circuits.length} circuits`,
    'identify-spof': `${sharedTotal} shared-fate finding${sharedTotal === 1 ? '' : 's'}${suspectedCount ? ` (${suspectedCount} suspected)` : ''} confirmed against structured records`,
    'gap-reporting': decayedRecords.length ? `${decayedRecords.length} evidence record${decayedRecords.length === 1 ? '' : 's'} degraded past their validity window (see gap register)` : 'no degraded evidence at generation time',
    'evidence-retained': `${recordTotal} evidence records retained, every one carrying an evidence reference and verification date`,
  }

  return (
    <div>
      <div className="no-print">
        <PageHead
          eyebrow="Deliverable"
          title={`Deliverable · ${eng.name}`}
          sub="Generated live from the engagement's evidence records. Print to PDF for the client deliverable — the sidebar and controls are excluded automatically."
        />
        <div style={{ marginBottom: 16 }}>
          <button className="btn btn-primary" onClick={() => window.print()}>Print / export PDF</button>
        </div>
      </div>

      <div className="report-doc" id="findings-report">
        <h4>Diversity Assurance Audit — Evidence-Graded Findings</h4>
        <p className="doc-meta">
          {eng.client.name || 'Client'} · {eng.name} · generated {generated} · evidence graded {gradedDates[0] || '—'}
          {gradedDates.length > 1 && gradedDates[0] !== gradedDates[gradedDates.length - 1] ? ` to ${gradedDates[gradedDates.length - 1]}` : ''}
        </p>

        <p style={{ fontWeight: 600, margin: '0 0 8px' }}>Executive summary</p>
        <p style={{ margin: '0 0 10px' }}>
          {eng.sites.length} sites, {eng.circuits.length} circuits, and {eng.pairs.length} circuit pair{eng.pairs.length > 1 ? 's' : ''} were
          examined across seven infrastructure layers. Average derived diversity score{' '}
          <span className="mono" style={{ fontWeight: 600 }}>{avg}</span>, average evidence coverage{' '}
          <span className="mono" style={{ fontWeight: 600 }}>{avgCoverage}%</span>.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '0 0 10px' }}>
          {LEGACY_ORDER.map((g) => (
            <Pill key={g} kind={LEGACY_GRADES[g].pill}>{counts[g]} {LEGACY_GRADES[g].label.toLowerCase()}</Pill>
          ))}
          <Pill kind="pill-gray">{counts.ungraded} ungraded</Pill>
        </div>
        <p className="small muted" style={{ margin: '0 0 6px' }}>
          Every finding stores an outcome (diverse / shared / unknown) and its evidence provenance; the labels above derive
          from that pair. A finding of unknown is a first-class result. Ungraded layers carry no assertion and are excluded.
        </p>
        <p className="small muted" style={{ margin: 0 }}>
          Engagement documents:{' '}
          {ENGAGEMENT_DOCS.map((d) => `${d.label} ${DOC_STATUS[((docs[d.id] || {}).status || 'missing')].label.toLowerCase()}`).join(' · ')}
        </p>

        <hr />

        <div className="print-section">
          <p style={{ fontWeight: 600, margin: '0 0 8px' }}>Resilience proof ledger</p>
          {PROOF_ITEMS.map((item, i) => (
            <div key={item.id} style={{ borderTop: '1px solid var(--line)', padding: '7px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontWeight: 600, fontSize: 13.5, flex: 1, minWidth: 240 }}>
                  <span className="mono faint" style={{ marginRight: 8, fontWeight: 400 }}>{String(i + 1).padStart(2, '0')}</span>
                  {item.label}
                </span>
                <Pill kind={COVERAGE_PILL[item.coverage]}>{item.coverage}</Pill>
              </div>
              <p className="small muted" style={{ margin: '3px 0 0' }}>
                {item.coverage === 'verified by platform' && `${proofLines[item.id]}${item.note ? ` — ${item.note}` : ''}`}
                {item.coverage === 'declared by customer' && `customer attestation dated ${DECLARED_DATES[item.id]}${item.note ? ` — ${item.note}` : ''}`}
                {item.coverage === 'out of scope' && item.note}
              </p>
            </div>
          ))}
        </div>

        <hr />

        {bySite.map(({ site, pairs }) => (
          <div key={site.id} className="print-section">
            <p style={{ fontWeight: 600, margin: '0 0 2px' }}>Site · {site.name}</p>
            <p className="small muted" style={{ margin: '0 0 10px' }}>
              {site.address || 'No address recorded'}{site.coords ? ` · ${site.coords}` : ''}
            </p>
            {pairs.map(({ pair, a, b, res }) => (
              <div key={pair.id} style={{ margin: '0 0 18px' }}>
                <p style={{ margin: '0 0 6px' }}>
                  <span className="mono" style={{ fontWeight: 600 }}>{cid(a)} × {cid(b)}</span>{' '}
                  — derived score <span className="mono" style={{ fontWeight: 600 }}>{res.composite}</span>{' '}
                  <Pill kind={gradeMeta[res.grade].pill}>{gradeMeta[res.grade].label}</Pill>{' '}
                  <span className="small muted">evidence coverage {res.coverage}% · {res.graded}/{res.applicable} layers graded</span>
                </p>
                {LAYERS.filter((l) => res.layers.some((x) => x.id === l.id)).map((l) => {
                  const g = pair.grades[l.id]
                  return (
                    <div key={l.id} style={{ borderTop: '1px solid var(--line)', padding: '6px 0' }}>
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                        <span style={{ flex: '0 0 120px', fontWeight: 600, fontSize: 13 }}>{l.label}</span>
                        <span className="small muted" style={{ flex: 1, minWidth: 150 }}>A: {layerValue(registry, a, l.id)}</span>
                        <span className="small muted" style={{ flex: 1, minWidth: 150 }}>B: {layerValue(registry, b, l.id)}</span>
                        {g ? recordPill(g) : <span className="small faint">ungraded — no assertion</span>}
                      </div>
                      {g && (
                        <p className="small faint mono" style={{ margin: '3px 0 0', fontSize: 12 }}>
                          {g.outcome} × {g.provenance} · evidence: {g.evidence_ref} · verified {g.verified_date}{g.confidence_note ? ` · ${g.confidence_note}` : ''}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        ))}

        <hr />

        <div className="print-section">
          <p style={{ fontWeight: 600, margin: '0 0 8px' }}>Cost of inertia</p>
          <p style={{ margin: '0 0 10px' }}>
            At reference assumptions ({DEFAULT_TCO_INPUTS.inc} incidents/yr × {DEFAULT_TCO_INPUTS.dur} hrs ×{' '}
            {fk(DEFAULT_TCO_INPUTS.rev)}/hr revenue at risk, {DEFAULT_TCO_INPUTS.emp} employees idled), unremediated
            shared fate carries an annual outage exposure of <span className="mono" style={{ fontWeight: 600 }}>{fk(tco.exposure)}</span>.
            Remediation at {fk(DEFAULT_TCO_INPUTS.capex)} one-time / {fk(DEFAULT_TCO_INPUTS.opex)}/yr avoids{' '}
            <span className="mono" style={{ fontWeight: 600 }}>{fk(tco.avoided)}</span> per year
            {tco.months !== null && <> — payback in <span className="mono" style={{ fontWeight: 600 }}>{tco.months < 1 ? '<1' : Math.round(tco.months)} month{Math.round(tco.months) === 1 ? '' : 's'}</span></>},
            with a three-year net benefit of <span className="mono" style={{ fontWeight: 600 }}>{fk(Math.abs(tco.net3))}</span>.
            Adjust assumptions in the demo Outage TCO view; the same model computes both.
          </p>
          <p className="small muted" style={{ margin: 0 }}>
            Findings expire: carrier re-grooms, access-vendor changes, and M&amp;A silently invalidate verified separation.
            Each record above carries its verification date; re-verification on a recurring cycle keeps this report defensible.
          </p>
        </div>

        {decayedRecords.length > 0 && (
          <>
            <hr />
            <div className="print-section">
              <p style={{ fontWeight: 600, margin: '0 0 8px' }}>Gap register — degraded evidence</p>
              <p className="small muted" style={{ margin: '0 0 8px' }}>
                Records whose provenance has decayed past the validity window since verification. Each is a re-verification
                gap; the outcome on file is unchanged but its support has weakened.
              </p>
              {decayedRecords.map((d, i) => (
                <div key={i} style={{ borderTop: '1px solid var(--line)', padding: '6px 0', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ flex: '0 0 120px', fontWeight: 600, fontSize: 13 }}>{d.layer}</span>
                  <span className="small muted" style={{ flex: 1, minWidth: 180 }}>{d.siteName} · <span className="mono">{d.pairLabel}</span></span>
                  <span className="small mono muted">{d.stored} → {d.effective} · verified {d.verified}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
