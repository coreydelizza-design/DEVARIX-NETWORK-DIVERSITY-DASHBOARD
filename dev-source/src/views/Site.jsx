import { useMemo, useState } from 'react'
import { useStore, activeEngagement, captureFact, adjudicateFact, acceptCollision, isSampleActive } from '../lib/store'
import { siteConformance, siteFreshness, VERDICTS } from '../lib/graphScoring'
import { detectCollisions, detectConflicts } from '../lib/collisions'
import { OUTCOMES, OUTCOME_META, PROVENANCE, SOURCE_KINDS, MISSING_REASONS, servicesForSite } from '../lib/graph'
import { legacyGrade, effectiveProvenance } from '../lib/evidenceModel'
import { tierMisassigned, TIER_META } from '../lib/tierModel'
import { computeTco, DEFAULT_TCO_INPUTS, fk } from '../lib/tcoModel'
import { AgeBadge } from '../components/ui'
import { PageHead, Metric, Pill } from '../components/ui'

const DIMS = [
  ['wire_center', 'Serving wire center'], ['conduit', 'Conduit'], ['pop_hotel', 'Carrier hotel'],
  ['access_provider', 'Access provider'], ['underlying_provider', 'Underlying provider'], ['nni', 'NNI'], ['asn', 'ASN / egress'],
]

function factFor(eng, svcId, dim) {
  return (eng.facts || []).filter((f) => f.subjectType === 'service' && f.subjectId === svcId && f.dimension === dim).slice(-1)[0]
}

function CaptureForm({ onSave, onCancel }) {
  const [outcome, setOutcome] = useState('diverse')
  const [provenance, setProvenance] = useState('documented')
  const [sourceKind, setSourceKind] = useState('carrier_response')
  const [label, setLabel] = useState('')
  const [missing, setMissing] = useState('')
  const [notice, setNotice] = useState('')
  const save = () => {
    const payload = missing
      ? { value: null, missingReason: missing, provenance: 'inferred', sourceRef: { kind: sourceKind, label: label || SOURCE_KINDS[sourceKind] }, capturedDate: new Date().toISOString().slice(0, 10), validityDays: 365 }
      : { value: outcome, outcome, provenance, sourceRef: label ? { kind: sourceKind, label } : null, capturedDate: new Date().toISOString().slice(0, 10), validityDays: 365 }
    try { onSave(payload) } catch (e) { setNotice(e.message) }
  }
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 6, padding: 10, marginTop: 6 }}>
      <div className="crit-row" style={{ margin: '0 0 6px' }}><span className="crit-label" style={{ flexBasis: 80 }}>Outcome</span>
        <div style={{ display: 'flex', gap: 4 }}>{OUTCOMES.map((o) => <button key={o} className="btn" style={outcome === o && !missing ? { background: OUTCOME_META[o].color, borderColor: OUTCOME_META[o].color, color: '#fff' } : undefined} onClick={() => { setOutcome(o); setMissing('') }}>{OUTCOME_META[o].label}</button>)}</div>
      </div>
      <div className="crit-row" style={{ margin: '0 0 6px' }}><span className="crit-label" style={{ flexBasis: 80 }}>Provenance</span>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>{PROVENANCE.map((p) => <button key={p} className={`btn ${provenance === p ? 'btn-primary' : ''}`} onClick={() => setProvenance(p)}>{p}</button>)}</div>
      </div>
      <div className="crit-row" style={{ margin: '0 0 6px' }}><span className="crit-label" style={{ flexBasis: 80 }}>Source</span>
        <select value={sourceKind} onChange={(e) => setSourceKind(e.target.value)}>{Object.entries(SOURCE_KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <input type="text" placeholder="reference (required)" value={label} onChange={(e) => setLabel(e.target.value)} style={{ flex: 1, minWidth: 140 }} />
      </div>
      <div className="crit-row" style={{ margin: '0 0 6px' }}><span className="crit-label" style={{ flexBasis: 80 }}>Or missing</span>
        <select value={missing} onChange={(e) => setMissing(e.target.value)}><option value="">— captured value —</option>{Object.entries(MISSING_REASONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button className="btn btn-primary" onClick={save}>Save fact</button>
        <button className="btn" onClick={onCancel}>Cancel</button>
        {notice && <span className="small danger">{notice}</span>}
      </div>
    </div>
  )
}

function InfraTab({ eng, elements, site, readOnly }) {
  const services = servicesForSite(eng, site.id)
  const [capturing, setCapturing] = useState(null) // `${svcId}:${dim}`
  const collisions = detectCollisions(eng, elements, site.id)
  const conflicts = detectConflicts(eng).filter((c) => services.some((s) => s.id === c.subjectId))
  const [dismissed, setDismissed] = useState(new Set())
  const [notice, setNotice] = useState('')

  const doCapture = (svcId, dim, payload) => {
    if (readOnly) { setNotice('Sample engagement is read-only.'); throw new Error('read-only') }
    captureFact('service', svcId, dim, payload)
    setCapturing(null)
  }

  return (
    <div>
      {collisions.filter((c) => !dismissed.has(c.id)).length > 0 && (
        <div className="card">
          <p className="card-title">Shared-fate proposals</p>
          {collisions.filter((c) => !dismissed.has(c.id)).map((c) => (
            <div key={c.id} className="row-item">
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <Pill kind={c.severity === 'high' ? 'pill-red' : 'pill-amber'}>{c.layer}</Pill>
                <span className="small" style={{ flex: 1, minWidth: 200 }}>{c.note}</span>
                <button className="btn" onClick={() => { const r = acceptCollision(c, `${c.typeName} shared across ${c.services.length} services`); setNotice(r ? 'Shared-fate relation written to registry.' : 'Sample is read-only.') }}>Accept</button>
                <button className="btn" onClick={() => setDismissed(new Set([...dismissed, c.id]))}>Dismiss</button>
              </div>
            </div>
          ))}
          {notice && <p className="small muted" style={{ margin: '6px 0 0' }}>{notice}</p>}
        </div>
      )}

      {conflicts.length > 0 && (
        <div className="card">
          <p className="card-title">Conflicts awaiting adjudication</p>
          {conflicts.map((c) => (
            <div key={c.id} className="row-item">
              <p className="small" style={{ fontWeight: 600, margin: 0 }}>{c.dimension} — {c.facts.length} sources disagree {c.adjudicated && <Pill kind="pill-teal">adjudicated</Pill>}</p>
              {c.facts.map((f) => (
                <div key={f.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '3px 0' }}>
                  <span className="small mono muted" style={{ flex: 1 }}>{f.outcome} · {f.provenance} · {f.sourceRef ? f.sourceRef.label : '—'}</span>
                  {!readOnly && !c.adjudicated && <button className="btn" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => adjudicateFact(f.id, { winner: f.id, note: 'prevails', date: new Date().toISOString().slice(0, 10) })}>This prevails</button>}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <p className="card-title">Infrastructure &amp; evidence</p>
        <p className="card-sub">Services × core-ring dimensions. Every cell is a fact — captured with source, provenance, and date.{readOnly && ' Sample engagement is read-only.'}</p>
        <div className="table-wrap">
          <table className="sites-table">
            <thead><tr><th>Service</th>{DIMS.map(([d, l]) => <th key={d}>{l}</th>)}</tr></thead>
            <tbody>
              {services.map((svc) => (
                <tr key={svc.id}>
                  <td style={{ fontWeight: 600 }}>{svc.name}</td>
                  {DIMS.map(([dim]) => {
                    const f = factFor(eng, svc.id, dim)
                    const key = `${svc.id}:${dim}`
                    return (
                      <td key={dim} style={{ verticalAlign: 'top' }}>
                        {f ? (
                          f.missingReason ? <Pill kind="pill-gray">{MISSING_REASONS[f.missingReason]}</Pill>
                            : <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}><Pill kind={f.outcome === 'shared' ? 'pill-red' : f.outcome === 'unknown' ? 'pill-gray' : legacyGrade(f).grade === 'VERIFIED_DIVERSE' ? 'pill-teal' : 'pill-amber'}>{f.outcome}</Pill><AgeBadge fact={{ status: effectiveProvenance(f), evidenceDate: f.capturedDate, validityDays: f.validityDays }} /></span>
                        ) : <span className="small faint">—</span>}
                        {!readOnly && <div><button className="btn" style={{ padding: '2px 8px', fontSize: 11, marginTop: 3 }} onClick={() => setCapturing(capturing === key ? null : key)}>{f ? 'recapture' : 'capture'}</button></div>}
                        {capturing === key && <CaptureForm onSave={(p) => doCapture(svc.id, dim, p)} onCancel={() => setCapturing(null)} />}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function SimulateTab({ eng, elements, site }) {
  const services = servicesForSite(eng, site.id)
  const baseFacts = useMemo(() => (eng.facts || []).filter((f) => f.subjectType === 'service' && services.some((s) => s.id === f.subjectId)), [eng, site.id])
  const [work, setWork] = useState(() => baseFacts.map((f) => ({ ...f })))
  const actual = siteConformance(eng, elements, site)
  const workingEng = { ...eng, facts: [...(eng.facts || []).filter((f) => !baseFacts.includes(f)), ...work] }
  const sim = siteConformance(workingEng, elements, site)
  const changes = work.filter((w, i) => w.outcome !== baseFacts[i].outcome).length

  const cycle = (i) => setWork(work.map((w, j) => (j === i ? { ...w, outcome: OUTCOMES[(OUTCOMES.indexOf(w.outcome) + 1) % OUTCOMES.length] } : w)))
  const reset = () => setWork(baseFacts.map((f) => ({ ...f })))

  const tco = computeTco({ ...DEFAULT_TCO_INPUTS, rev: Math.round((site.revenuePerHourUSD || 60000) / 1000) })

  const Delta = ({ label, a, b }) => <Metric label={label} value={`${b}`} tone={b !== a ? 'var(--violet)' : undefined} />

  return (
    <div>
      <div className="card" style={{ borderColor: 'var(--violet)' }}>
        <p className="small muted" style={{ margin: 0 }}>Hypothesis surface — toggling facts re-derives the verdict live and never writes to the store. <strong style={{ color: 'var(--ink)' }}>{changes} change{changes === 1 ? '' : 's'} from actual.</strong> <button className="btn" style={{ padding: '2px 8px', fontSize: 12 }} onClick={reset}>Reset to actual</button></p>
      </div>
      <div className="metric-grid">
        <div className="metric"><p className="metric-label">Verdict (sim)</p><p style={{ margin: 0 }}><Pill kind={VERDICTS[sim.verdict].pill}>{sim.verdict}</Pill></p><p className="small faint" style={{ margin: '2px 0 0' }}>actual: {actual.verdict}</p></div>
        <Delta label="Score (sim)" a={actual.score} b={sim.score} />
        <Delta label="Coverage (sim)" a={actual.coverage} b={`${sim.coverage}%`} />
        <Metric label="Outage exposure / yr" value={fk(tco.exposure)} tone="var(--red)" />
      </div>
      <div className="card">
        <p className="card-title">Fact hypotheses</p>
        <p className="card-sub">Click a fact to cycle its outcome (diverse → shared → unknown). Payback if remediated: {tco.months === null ? '—' : `${tco.months < 1 ? '<1' : Math.round(tco.months)} months`}.</p>
        {work.map((w, i) => (
          <div key={w.id} className="crit-row" style={{ margin: '4px 0' }}>
            <span className="crit-label" style={{ flexBasis: 220 }}>{services.find((s) => s.id === w.subjectId)?.name} · {w.dimension}</span>
            <button className="btn" style={{ background: OUTCOME_META[w.outcome] ? OUTCOME_META[w.outcome].color : undefined, borderColor: OUTCOME_META[w.outcome] ? OUTCOME_META[w.outcome].color : undefined, color: OUTCOME_META[w.outcome] ? '#fff' : undefined }} onClick={() => cycle(i)}>{w.outcome}{w.outcome !== baseFacts[i].outcome ? ` (was ${baseFacts[i].outcome})` : ''}</button>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Site({ site, back }) {
  const s = useStore()
  const eng = activeEngagement(s)
  const [tab, setTab] = useState('overview')
  if (!eng || !site) return <div><PageHead eyebrow="Site" title="Site" sub="No site selected." /><button className="btn" onClick={back}>← Sites</button></div>
  // resolve the live site object from the store (capture updates it)
  const live = eng.sites.find((x) => x.id === site.id) || site
  const elements = s.registry.elements || {}
  const c = siteConformance(eng, elements, live)
  const fresh = siteFreshness(eng, elements, live)
  const readOnly = isSampleActive(s)
  const ta = live.tierAssignment

  return (
    <div>
      <button className="btn" style={{ marginBottom: 10 }} onClick={back}>← Sites</button>
      <PageHead eyebrow={`${live.tier} · ${TIER_META[live.tier] ? TIER_META[live.tier].name : ''}`} title={live.name} sub={`${live.address || ''}${live.coords ? ' · ' + live.coords : ''}`} />
      <div className="tabs">
        {[['overview', 'Overview'], ['infra', 'Infrastructure & evidence'], ['sim', 'Simulate']].map(([k, l]) => (
          <button key={k} className={`tab ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {tab === 'overview' && (
        <div>
          <div className="metric-grid">
            <div className="metric"><p className="metric-label">Verdict</p><p style={{ margin: 0 }}><Pill kind={VERDICTS[c.verdict].pill}>{c.verdict}</Pill></p></div>
            <Metric label="Score" value={c.score ?? '—'} />
            <Metric label="Coverage" value={`${c.coverage}%`} tone={c.coverage < 60 ? 'var(--red)' : undefined} />
            <Metric label="Evidence fresh" value={`${fresh.fresh}/${fresh.fresh + fresh.aging + fresh.expired}`} />
          </div>
          <div className="card">
            <p className="card-title">Tier assignment</p>
            <p className="small muted" style={{ margin: 0 }}>{live.tier} · {TIER_META[live.tier] && TIER_META[live.tier].blurb}. Assigned {ta ? `${ta.assignedDate} (${ta.assignedBy})` : '—'}. {tierMisassigned(live) && <Pill kind="pill-amber">tier under review — declared criticality contradicts tier</Pill>}</p>
          </div>
          <div className="card">
            <p className="card-title">Top shared-fate findings</p>
            {c.collisions.length === 0 ? <p className="small ok" style={{ margin: 0 }}>No shared-fate collisions detected across this site's services.</p> : c.collisions.slice(0, 6).map((col) => (
              <p key={col.id} className="small muted" style={{ margin: '3px 0' }}><Pill kind={col.severity === 'high' ? 'pill-red' : 'pill-amber'}>{col.layer}</Pill> {col.note}</p>
            ))}
          </div>
        </div>
      )}
      {tab === 'infra' && <InfraTab eng={eng} elements={elements} site={live} readOnly={readOnly} />}
      {tab === 'sim' && <SimulateTab eng={eng} elements={elements} site={live} />}
    </div>
  )
}
