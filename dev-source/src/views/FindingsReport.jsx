import { GRADES, LAYERS, ENGAGEMENT_DOCS, DOC_STATUS } from '../lib/schema'
import { useStore, activeEngagement } from '../lib/store'
import { computeDerivedScore } from '../lib/derivedScoring'
import { computeTco, DEFAULT_TCO_INPUTS, fk } from '../lib/tcoModel'
import { gradeMeta } from '../lib/scoringModel'
import { PageHead, Metric, Pill } from '../components/ui'

const GRADE_ORDER = ['VERIFIED_DIVERSE', 'CLAIMED_UNVERIFIED', 'UNKNOWN', 'SHARED_FATE_CONFIRMED']

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

export default function FindingsReport() {
  const s = useStore()
  const eng = activeEngagement(s)
  const registry = s.registry

  if (!eng || eng.pairs.length === 0) {
    return (
      <div>
        <PageHead
          eyebrow="Deliverable"
          title="Findings report"
          sub="The evidence-graded findings report is generated from the active engagement's graded circuit pairs."
        />
        <div className="card" style={{ borderColor: 'var(--teal)' }}>
          <p className="small muted" style={{ margin: 0 }}>
            {eng
              ? `No graded pairs in ${eng.name} yet. Define circuit pairs and grade them in Intake & validation — the report generates itself from those grades.`
              : 'No active engagement. Create or select one in the Engagements view, capture circuits, and grade pairs — the report generates itself from those grades.'}
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
  GRADE_ORDER.forEach((g) => { counts[g] = 0 })
  let gradedDates = []
  results.forEach(({ pair, res }) => {
    res.layers.forEach((l) => {
      if (l.grade) {
        counts[l.grade]++
        gradedDates.push(pair.grades[l.id].verified_date)
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

  const bySite = eng.sites
    .map((site) => ({ site, pairs: results.filter((r) => r.pair.site_id === site.id) }))
    .filter((g) => g.pairs.length > 0)

  return (
    <div>
      <div className="no-print">
        <PageHead
          eyebrow="Deliverable"
          title={`Findings report · ${eng.name}`}
          sub="Generated live from the engagement's evidence grades. Print to PDF for the client deliverable — the sidebar and controls are excluded automatically."
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
          {GRADE_ORDER.map((g) => (
            <Pill key={g} kind={GRADES[g].pill}>{counts[g]} {GRADES[g].label.toLowerCase()}</Pill>
          ))}
          <Pill kind="pill-gray">{counts.ungraded} ungraded</Pill>
        </div>
        <p className="small muted" style={{ margin: '0 0 6px' }}>
          A finding of UNKNOWN is a first-class result: it records that no party could produce evidence of separation.
          Ungraded layers carry no assertion and are excluded from the findings body.
        </p>
        <p className="small muted" style={{ margin: 0 }}>
          Engagement documents:{' '}
          {ENGAGEMENT_DOCS.map((d) => `${d.label} ${DOC_STATUS[((docs[d.id] || {}).status || 'missing')].label.toLowerCase()}`).join(' · ')}
        </p>

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
                        {g ? <Pill kind={GRADES[g.grade].pill}>{GRADES[g.grade].label}</Pill> : <span className="small faint">ungraded — no assertion</span>}
                      </div>
                      {g && (
                        <p className="small faint mono" style={{ margin: '3px 0 0', fontSize: 12 }}>
                          evidence: {g.evidence_ref} · verified {g.verified_date}{g.confidence_note ? ` · ${g.confidence_note}` : ''}
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
            Adjust assumptions in the Outage TCO view; the same model computes both.
          </p>
          <p className="small muted" style={{ margin: 0 }}>
            Findings expire: carrier re-grooms, access-vendor changes, and M&amp;A silently invalidate verified separation.
            Each grade above carries its verification date; re-verification on a recurring cycle keeps this report defensible.
          </p>
        </div>
      </div>
    </div>
  )
}
