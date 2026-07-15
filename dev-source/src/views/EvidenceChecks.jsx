import { useState } from 'react'
import { makePair, LAYERS, ASK_LIST } from '../lib/schema'
import { OUTCOMES, OUTCOME_META, PROVENANCE, makeRecord, legacyGrade, LEGACY_GRADES, LEGACY_ORDER, effectiveProvenance } from '../lib/evidenceModel'
import { useStore, activeEngagement, savePair } from '../lib/store'
import { runChecks, manualHints } from '../lib/crossExam'
import { computeDerivedScore } from '../lib/derivedScoring'
import { gradeMeta } from '../lib/scoringModel'
import { PageHead, Metric, Pill, ScoreBar } from '../components/ui'

function entityLabel(registry, kind, ref) {
  const ent = (registry[kind] || []).find((e) => e.id === ref)
  return ent ? ent.label : ''
}

function layerSummary(registry, c, layerId) {
  if (!c) return '—'
  const L = c.layers[layerId] || {}
  const clli = (ref) => (registry.clli.find((e) => e.id === ref) || {}).key || ''
  const tri = (v, label) => (v && v !== 'unknown' ? `${label} ${v}` : '')
  const parts = {
    identity: [L.circuit_id, entityLabel(registry, 'carrier', L.carrier_ref), L.service_type],
    loop: [L.access_type === 'type2' ? 'Type II' : L.access_type === 'onnet' ? 'On-net' : '', entityLabel(registry, 'accessVendor', L.access_provider_ref), clli(L.wire_center_ref)],
    entrance: [L.conduit, L.demarc, L.power],
    nni: [clli(L.nni_clli_ref), entityLabel(registry, 'nniId', L.nni_id_ref)],
    route: [tri(L.kmz_received, 'KMZ'), L.overlap_segments],
    pop: [clli(L.pop_clli_ref), L.router_node, L.shelf_card_port],
    logical: [entityLabel(registry, 'asn', L.egress_asn_ref), tri(L.bgp_multihoming, 'BGP'), tri(L.traceroute_divergence, 'TR div')],
  }[layerId] || []
  return parts.filter(Boolean).join(' · ') || '—'
}

const CHECK_RESULT_META = {
  match: { pill: 'pill-red', label: 'shared-fate indicator' },
  no_match: { pill: 'pill-teal', label: 'no match' },
  insufficient_data: { pill: 'pill-gray', label: 'insufficient data' },
  not_applicable: { pill: 'pill-gray', label: 'n/a — on-net' },
}

const HINT_META = {
  review: { pill: 'pill-amber', label: 'review needed' },
  info: { pill: 'pill-blue', label: 'info' },
  insufficient: { pill: 'pill-gray', label: 'insufficient data' },
}

function recordPill(record) {
  const lg = legacyGrade(record)
  return <Pill kind={LEGACY_GRADES[lg.grade].pill}>{LEGACY_GRADES[lg.grade].label}{lg.suspected ? ' · suspected' : ''}</Pill>
}

// The unified editor: outcome (what the evidence says) x provenance
// (how good the evidence is). The legacy grade is a derived preview.
function RecordEditor({ layerLabel, existing, evidenceOptions, onSave, onCancel }) {
  const [outcome, setOutcome] = useState(existing ? existing.outcome : 'unknown')
  const [provenance, setProvenance] = useState(existing ? existing.provenance : 'declared')
  const [evidenceRef, setEvidenceRef] = useState(existing ? existing.evidence_ref : '')
  const [note, setNote] = useState(existing ? existing.confidence_note : '')
  const [notice, setNotice] = useState('')
  const listId = `evidence-${layerLabel.replace(/\W+/g, '-')}`
  const preview = legacyGrade({ outcome, provenance, verified_date: new Date().toISOString().slice(0, 10) })

  const save = () => {
    if (!evidenceRef.trim()) return setNotice('Evidence reference required — a record without evidence is an attestation, not a finding.')
    onSave(outcome, provenance, evidenceRef.trim(), note.trim())
  }

  return (
    <div style={{ background: 'var(--canvas)', borderRadius: 6, padding: '10px 12px', marginTop: 8 }}>
      <p className="small" style={{ fontWeight: 600, margin: '0 0 8px' }}>Evidence record · {layerLabel}</p>
      <div className="crit-row" style={{ margin: '0 0 6px' }}>
        <span className="crit-label" style={{ flexBasis: 90 }}>Outcome</span>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {OUTCOMES.map((o) => (
            <button
              key={o}
              className="btn"
              style={outcome === o ? { background: OUTCOME_META[o].color, borderColor: OUTCOME_META[o].color, color: '#fff' } : undefined}
              onClick={() => setOutcome(o)}
            >
              {OUTCOME_META[o].label}
            </button>
          ))}
        </div>
      </div>
      <div className="crit-row" style={{ margin: '0 0 6px' }}>
        <span className="crit-label" style={{ flexBasis: 90 }}>Provenance</span>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {PROVENANCE.map((p) => (
            <button key={p} className={`btn ${provenance === p ? 'btn-primary' : ''}`} onClick={() => setProvenance(p)}>
              {p}
            </button>
          ))}
          <span className="small faint">→ {LEGACY_GRADES[preview.grade].label}{preview.suspected ? ' (suspected)' : ''}</span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        <input type="text" list={listId} style={{ flex: 2, minWidth: 220 }} value={evidenceRef} onChange={(e) => setEvidenceRef(e.target.value)} placeholder="Evidence reference (required) — received records appear as suggestions" />
        <datalist id={listId}>
          {(evidenceOptions || []).map((o) => (
            <option key={o} value={o} />
          ))}
        </datalist>
        <input type="text" style={{ flex: 2, minWidth: 220 }} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Confidence note (optional)" />
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="btn btn-primary" onClick={save}>Save record</button>
        <button className="btn" onClick={onCancel}>Cancel</button>
        {notice && <span className="small danger">{notice}</span>}
      </div>
    </div>
  )
}

function PairCard({ registry, pair, circuits, requests }) {
  const [editingLayer, setEditingLayer] = useState(null)
  const [proposal, setProposal] = useState(null)
  const [exam, setExam] = useState(null)
  const [dismissed, setDismissed] = useState(new Set())
  const a = circuits.find((c) => c.id === pair.circuit_a_id)
  const b = circuits.find((c) => c.id === pair.circuit_b_id)
  const cid = (c) => (c && c.layers.identity.circuit_id) || 'missing circuit'
  const res = computeDerivedScore(pair, circuits)

  const pairCarrierRefs = new Set([a, b].filter(Boolean).map((c) => c.layers.identity.carrier_ref).filter(Boolean))
  const askLabel = (id) => (ASK_LIST.find((x) => x.id === id) || {}).label || id
  const evidenceOptions = (requests || [])
    .filter((r) => pairCarrierRefs.has(r.carrier_ref))
    .flatMap((r) =>
      Object.entries(r.items)
        .filter(([, item]) => item.status === 'received')
        .map(([itemId, item]) => `${entityLabel(registry, 'carrier', r.carrier_ref)} — ${askLabel(itemId)} (received ${item.received_date})`)
    )

  const counts = { ungraded: 0 }
  LEGACY_ORDER.forEach((g) => { counts[g] = 0 })
  LAYERS.forEach((l) => {
    const g = pair.grades[l.id]
    if (g) counts[legacyGrade(g).grade]++
    else counts.ungraded++
  })

  const saveRecord = (layerId, outcome, provenance, evidenceRef, note) => {
    savePair({ ...pair, grades: { ...pair.grades, [layerId]: makeRecord(outcome, provenance, evidenceRef, note) } })
    setEditingLayer(null)
    setProposal(null)
  }

  const accept = (chk) => {
    setProposal({ layerId: chk.layer, outcome: chk.proposal.outcome, provenance: chk.proposal.provenance, evidence_ref: chk.evidence, confidence_note: '' })
    setEditingLayer(chk.layer)
  }

  return (
    <div className="row-item">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <span className="mono" style={{ fontWeight: 600, fontSize: 13.5 }}>{cid(a)} × {cid(b)}</span>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {LEGACY_ORDER.filter((g) => counts[g] > 0).map((g) => (
            <Pill key={g} kind={LEGACY_GRADES[g].pill}>{counts[g]} {LEGACY_GRADES[g].label.toLowerCase()}</Pill>
          ))}
          {counts.ungraded > 0 && <span className="small faint">{counts.ungraded} ungraded</span>}
          <button className="btn" style={{ padding: '4px 10px', fontSize: 13 }} onClick={() => setExam(exam ? null : { checks: runChecks(registry, pair, circuits), hints: manualHints(pair, circuits) })}>
            {exam ? 'Hide cross-exam' : 'Run cross-exam'}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '8px 0 2px' }}>
        <ScoreBar score={res.composite} color={gradeMeta[res.grade].color} />
        <Pill kind={gradeMeta[res.grade].pill}>{gradeMeta[res.grade].label}</Pill>
      </div>
      <p className="small muted" style={{ margin: '0 0 8px' }}>
        Derived score from evidence records · coverage {res.coverage}% · {res.graded}/{res.applicable} layers graded
        {res.sharedFate > 0 && <span className="danger"> · {res.sharedFate} shared fate</span>}
      </p>

      {exam && (
        <div style={{ background: 'var(--canvas)', borderRadius: 6, padding: '10px 12px', marginBottom: 8 }}>
          <p className="small" style={{ fontWeight: 600, margin: '0 0 6px' }}>Cross-examination · automated checks on structured fields</p>
          {exam.checks.filter((chk) => !dismissed.has(chk.num)).map((chk) => (
            <div key={chk.num} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', padding: '5px 0', borderTop: '1px solid var(--line)' }}>
              <span className="small" style={{ flex: '0 0 190px', fontWeight: 600 }}>{chk.num}. {chk.name}</span>
              <span className="small muted mono" style={{ flex: 1, minWidth: 160 }}>
                {chk.result === 'not_applicable' ? '—' : `A: ${chk.a || '—'} · B: ${chk.b || '—'}`}
              </span>
              <Pill kind={CHECK_RESULT_META[chk.result].pill}>{CHECK_RESULT_META[chk.result].label}</Pill>
              {chk.result === 'match' && (
                <>
                  <button className="btn" style={{ padding: '4px 10px', fontSize: 13 }} onClick={() => accept(chk)}>Accept</button>
                  <button className="btn" style={{ padding: '4px 10px', fontSize: 13 }} onClick={() => setDismissed(new Set([...dismissed, chk.num]))}>Dismiss</button>
                </>
              )}
            </div>
          ))}
          {exam.hints.map((h) => (
            <div key={h.num} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', padding: '5px 0', borderTop: '1px solid var(--line)' }}>
              <span className="small" style={{ flex: '0 0 190px', fontWeight: 600 }}>{h.num}. {h.name}</span>
              <span className="small muted" style={{ flex: 1, minWidth: 160 }}>{h.text}</span>
              <Pill kind={HINT_META[h.status].pill}>{HINT_META[h.status].label}</Pill>
            </div>
          ))}
          <p className="small faint" style={{ margin: '6px 0 0' }}>
            The engine proposes; the auditor saves. Accepting a match pre-fills a shared-fate record — nothing is graded automatically.
          </p>
        </div>
      )}

      <div>
        {LAYERS.map((l) => {
          const g = pair.grades[l.id]
          return (
            <div key={l.id} style={{ borderTop: '1px solid var(--line)', padding: '8px 0' }}>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ flex: '0 0 120px', fontWeight: 600, fontSize: 13 }}>{l.label}</span>
                <span className="small muted" style={{ flex: 1, minWidth: 160 }}>A: {layerSummary(registry, a, l.id)}</span>
                <span className="small muted" style={{ flex: 1, minWidth: 160 }}>B: {layerSummary(registry, b, l.id)}</span>
                {g ? recordPill(g) : <span className="small faint">ungraded</span>}
                <button className="btn" style={{ padding: '4px 10px', fontSize: 13 }} onClick={() => setEditingLayer(editingLayer === l.id ? null : l.id)}>
                  {g ? 'Regrade' : 'Grade'}
                </button>
              </div>
              {g && (
                <p className="small faint mono" style={{ margin: '4px 0 0', fontSize: 12 }}>
                  {g.outcome} × {g.provenance}{effectiveProvenance(g) !== g.provenance ? ` (decayed to ${effectiveProvenance(g)})` : ''} · evidence: {g.evidence_ref} · verified {g.verified_date}{g.confidence_note ? ` · ${g.confidence_note}` : ''}
                </p>
              )}
              {editingLayer === l.id && (
                <RecordEditor
                  layerLabel={l.label}
                  existing={proposal && proposal.layerId === l.id ? proposal : g}
                  evidenceOptions={evidenceOptions}
                  onSave={(o, p, ev, nt) => saveRecord(l.id, o, p, ev, nt)}
                  onCancel={() => { setEditingLayer(null); setProposal(null) }}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function EvidenceChecks() {
  const s = useStore()
  const eng = activeEngagement(s)
  const [pairSel, setPairSel] = useState({})

  if (!eng) {
    return (
      <div>
        <PageHead eyebrow="Evidence & checks" title="Evidence & checks" sub="Pair circuits, grade each layer with a unified evidence record, and run the cross-examination checks." />
        <div className="card" style={{ borderColor: 'var(--teal)' }}>
          <p className="small muted" style={{ margin: 0 }}>No active engagement. Create or select one in the Engagement step.</p>
        </div>
      </div>
    )
  }

  const sitesWithCircuits = eng.sites.map((site) => ({
    site,
    circuits: eng.circuits.filter((c) => c.site_id === site.id),
    pairs: eng.pairs.filter((p) => p.site_id === site.id),
  })).filter((g) => g.circuits.length >= 2 || g.pairs.length > 0)

  const cidOf = (c) => c.layers.identity.circuit_id || c.id
  const totalGraded = eng.pairs.reduce((n, p) => n + Object.keys(p.grades).length, 0)

  const definePair = (siteId, circuits) => {
    const sel = pairSel[siteId] || {}
    if (!sel.a || !sel.b || sel.a === sel.b) return
    savePair(makePair(siteId, sel.a, sel.b))
    setPairSel({ ...pairSel, [siteId]: {} })
  }

  return (
    <div>
      <PageHead
        eyebrow="Evidence & checks"
        title={`Evidence & checks · ${eng.name}`}
        sub="Every layer stores one unified record: outcome (diverse / shared / unknown) × provenance (inferred → verified). Legacy grades derive from that pair. The engine proposes; the auditor saves."
      />

      <div className="metric-grid">
        <Metric label="Circuit pairs" value={eng.pairs.length} />
        <Metric label="Evidence records" value={totalGraded} />
        <Metric label="Sites in scope" value={eng.sites.length} />
      </div>

      {sitesWithCircuits.length === 0 ? (
        <p className="small muted">No site has two or more circuits yet — capture circuits in the Intake step first.</p>
      ) : (
        sitesWithCircuits.map(({ site, circuits, pairs }) => (
          <div key={site.id} className="card">
            <p className="card-title">{site.name}</p>
            {pairs.length > 0 && (
              <div className="row-list" style={{ marginBottom: 10 }}>
                {pairs.map((p) => (
                  <PairCard key={p.id} registry={s.registry} pair={p} circuits={circuits} requests={eng.requests || []} />
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <select value={(pairSel[site.id] || {}).a || ''} onChange={(e) => setPairSel({ ...pairSel, [site.id]: { ...(pairSel[site.id] || {}), a: e.target.value } })}>
                <option value="">Circuit A…</option>
                {circuits.map((c) => (
                  <option key={c.id} value={c.id}>{cidOf(c)}</option>
                ))}
              </select>
              <select value={(pairSel[site.id] || {}).b || ''} onChange={(e) => setPairSel({ ...pairSel, [site.id]: { ...(pairSel[site.id] || {}), b: e.target.value } })}>
                <option value="">Circuit B…</option>
                {circuits.filter((c) => c.id !== (pairSel[site.id] || {}).a).map((c) => (
                  <option key={c.id} value={c.id}>{cidOf(c)}</option>
                ))}
              </select>
              <button className="btn btn-primary" onClick={() => definePair(site.id, circuits)} disabled={!(pairSel[site.id] || {}).a || !(pairSel[site.id] || {}).b}>
                Define pair
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  )
}
