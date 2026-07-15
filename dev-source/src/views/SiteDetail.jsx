import { PageHead, Pill, AgeBadge } from '../components/ui'
import { model } from '../lib/scoringModel'
import { REQUIREMENTS, FACT_DOMAINS, TIER_META } from '../lib/tierModel'
import { PROVENANCE, effectiveStatus, ageInDays } from '../lib/provenance'

function RubricSection({ site }) {
  const assessed = site && site.tierAssignment && site.posture && site.facts && site.facts.length > 0
  if (!assessed) {
    return (
      <div className="card">
        <p className="card-title">Conformance rubric</p>
        <p className="small muted" style={{ margin: 0 }}>
          Not assessed — this site is missing a tier assignment or captured evidence, so no rubric applies.
        </p>
      </div>
    )
  }
  const tier = site.tierAssignment.tier
  const reqs = REQUIREMENTS[tier]
  const rank = (p) => PROVENANCE.indexOf(p)
  const meets = (sel, minArr) => minArr.every((m, i) => sel[i] >= m)

  return (
    <div className="card">
      <p className="card-title">Conformance rubric</p>
      <p className="card-sub">
        {tier} · {TIER_META[tier].name} — {TIER_META[tier].blurb}. Assigned {site.tierAssignment.assignedDate} ({site.tierAssignment.assignedBy}).
      </p>
      {model.map((d, di) => {
        const req = reqs[di]
        if (!req.applicable) {
          return (
            <div key={d.name} className="rubric-row-na" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', padding: '7px 0', borderTop: '1px solid var(--line)' }}>
              <span className="small" style={{ flex: '0 0 170px', fontWeight: 600 }}>{d.name}</span>
              <span className="small" style={{ flex: 1 }}>N/A for {tier} — excluded from conformance math</span>
            </div>
          )
        }
        const sel = site.posture[di]
        const reqParts = []
        req.minPosture.forEach((m, ci) => { if (m > 0) reqParts.push(d.criteria[ci].opts[m][0]) })
        if (req.anyOf) {
          reqParts.push('one of: ' + req.anyOf.map((alt) => alt.map((m, ci) => (m > 0 ? d.criteria[ci].opts[m][0] : null)).filter(Boolean).join(' + ')).join(' / '))
        }
        const relevant = d.criteria.map((c, ci) => (req.minPosture[ci] > 0 || (req.anyOf && req.anyOf.some((alt) => alt[ci] > 0)) ? c.opts[sel[ci]][0] : null)).filter(Boolean)
        const postureOk = meets(sel, req.minPosture) && (!req.anyOf || req.anyOf.some((alt) => meets(sel, alt)))
        const facts = site.facts.filter((f) => FACT_DOMAINS[f.label] === d.name)
        const best = facts.slice().sort((a, b) => rank(effectiveStatus(b)) - rank(effectiveStatus(a)) || ageInDays(a.evidenceDate) - ageInDays(b.evidenceDate))[0]
        const provOk = best && rank(effectiveStatus(best)) >= rank(req.requiredProvenance)
        const freshOk = best && ageInDays(best.evidenceDate) <= req.freshnessDays
        const result = !postureOk ? 'failed: posture' : !provOk ? 'failed: provenance' : !freshOk ? 'failed: freshness' : 'met'
        return (
          <div key={d.name} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', padding: '7px 0', borderTop: '1px solid var(--line)' }}>
            <span className="small" style={{ flex: '0 0 170px', fontWeight: 600 }}>{d.name}</span>
            <span className="small muted" style={{ flex: 2, minWidth: 180 }}>
              {(reqParts.join(' + ') || 'any posture')} · evidence ≥ {req.requiredProvenance}, ≤ {req.freshnessDays}d
            </span>
            <span className="small muted" style={{ flex: 1, minWidth: 130 }}>{relevant.join(' · ') || 'posture accepted'}</span>
            <span style={{ flex: '0 0 175px', display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              {best ? <AgeBadge fact={best} /> : <span className="small faint">no evidence</span>}
            </span>
            <span className="small" style={{ flex: '0 0 130px', fontWeight: 600, color: result === 'met' ? 'var(--teal, #0b7261)' : 'var(--red)' }}>
              {result}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// Ledger assumptions carry a provenance fact (status, evidenceDate,
// validityDays) so data age renders alongside the claim status.
const assumptions = [
  { text: 'Two carriers means two physical paths', status: 'violated', note: 'Both PoPs sit in the same carrier hotel; a facility event is a common-mode failure', fact: { label: 'PoP facility separation', carrier: 'Carrier one', status: 'documented', evidenceDate: '2026-06-08', validityDays: 365 } },
  { text: 'Different ASNs ride different long-haul fiber', status: 'unvalidated', note: 'Denver to Chicago segment may share leased conduit; KMZ route files not on file for circuit B', fact: { label: 'Long-haul route KMZ', carrier: 'Carrier two', status: 'inferred', evidenceDate: '2026-01-15', validityDays: 180 } },
  { text: 'Local loops are conduit-diverse', status: 'validated', note: 'Separate building entrances and street routes confirmed against carrier KMZ', fact: { label: 'Local loop conduit path', carrier: 'Carrier one', status: 'verified', evidenceDate: '2026-03-10', validityDays: 365 } },
  { text: 'Serving wire centers are distinct', status: 'validated', note: 'Curtis St and Capitol Hill COs confirmed from carrier inventory records', fact: { label: 'Serving wire center assignment', carrier: 'Carrier one', status: 'verified', evidenceDate: '2026-03-10', validityDays: 180 } },
  { text: 'Cloud on-ramp is redundant', status: 'violated', note: 'Single direct connect, landed in the same carrier hotel as both PoPs', fact: { label: 'Cloud on-ramp redundancy', carrier: 'Carrier two', status: 'documented', evidenceDate: '2026-06-20', validityDays: 365 } },
  { text: 'Failover is hitless under single-circuit loss', status: 'unvalidated', note: 'BGP failover designed but never exercised under load; last test predates router refresh', fact: { label: 'Failover exercise record', carrier: 'Carrier one', status: 'declared', evidenceDate: '2025-11-02', validityDays: 180 } },
]

const statusMeta = {
  validated: { pill: 'pill-teal', label: 'Validated' },
  violated: { pill: 'pill-red', label: 'Violated' },
  unvalidated: { pill: 'pill-amber', label: 'Unvalidated' },
}

function Node({ x, y, w = 110, h = 56, title, sub, danger }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="8"
        fill={danger ? 'var(--red-bg)' : 'var(--canvas)'}
        stroke={danger ? 'var(--red)' : 'var(--line-strong)'} strokeWidth="1" />
      <text x={x + w / 2} y={y + 24} textAnchor="middle" fontSize="12.5" fontWeight="600"
        fill={danger ? 'var(--red)' : 'var(--ink)'} fontFamily="var(--sans)">{title}</text>
      <text x={x + w / 2} y={y + 41} textAnchor="middle" fontSize="11"
        fill={danger ? 'var(--red)' : 'var(--muted)'} fontFamily="var(--mono)">{sub}</text>
    </g>
  )
}

export default function SiteDetail({ site }) {
  const s = site || { id: 'DEN-014', city: 'Denver', tier: 'Plant', region: 'AMER', score: 38 }
  return (
    <div>
      <PageHead
        eyebrow="Site drill-down"
        title={`${s.id} · ${s.city} ${s.tier.toLowerCase()}`}
        sub="Circuit relationships, AS paths, PoP convergence, and the design assumption ledger. The example models full logical diversity converging physically in one carrier hotel."
      />

      <div className="two-col" style={{ marginBottom: 16 }}>
        <div className="card" style={{ margin: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <p className="card-title" style={{ margin: 0 }}>Circuit A · <span className="mono">CKT-88213</span></p>
            <Pill kind="pill-blue">Primary</Pill>
          </div>
          <table className="kv">
            <tbody>
              <tr><td>Carrier</td><td>Carrier one · AS64801</td></tr>
              <tr><td>Local loop</td><td>Fiber · own build</td></tr>
              <tr><td>Wire center</td><td>Curtis St CO</td></tr>
              <tr><td>PoP</td><td className="danger">910 15th St, fl 6</td></tr>
              <tr><td>AS path</td><td className="mono" style={{ fontSize: 12 }}>64512 › 64801 › 16509</td></tr>
            </tbody>
          </table>
        </div>
        <div className="card" style={{ margin: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <p className="card-title" style={{ margin: 0 }}>Circuit B · <span className="mono">CKT-91077</span></p>
            <Pill kind="pill-gray">Secondary</Pill>
          </div>
          <table className="kv">
            <tbody>
              <tr><td>Carrier</td><td>Carrier two · AS64907</td></tr>
              <tr><td>Local loop</td><td>Fiber · leased (type II)</td></tr>
              <tr><td>Wire center</td><td>Capitol Hill CO</td></tr>
              <tr><td>PoP</td><td className="danger">910 15th St, fl 9</td></tr>
              <tr><td>AS path</td><td className="mono" style={{ fontSize: 12 }}>64512 › 64907 › 16509</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <p className="card-title">Path topology</p>
        <p className="card-sub">Parallel rails from site to cloud on-ramp; the dashed zone marks physical convergence</p>
        <svg viewBox="0 0 680 330" style={{ width: '100%', height: 'auto' }} role="img"
          aria-label="Two circuit paths from the site through separate wire centers converging at a shared carrier hotel before reaching separate backbones and one cloud on-ramp">
          <rect x="252" y="30" width="130" height="270" rx="8" fill="none" stroke="var(--red)" strokeWidth="1.5" strokeDasharray="6 4" />
          <text x="317" y="20" textAnchor="middle" fontSize="12" fill="var(--red)" fontFamily="var(--sans)">Shared carrier hotel</text>

          <line x1="90" y1="150" x2="115" y2="80" stroke="var(--line-strong)" strokeWidth="1.4" />
          <line x1="90" y1="180" x2="115" y2="250" stroke="var(--line-strong)" strokeWidth="1.4" />
          <line x1="225" y1="80" x2="262" y2="80" stroke="var(--line-strong)" strokeWidth="1.4" />
          <line x1="225" y1="250" x2="262" y2="250" stroke="var(--line-strong)" strokeWidth="1.4" />
          <line x1="372" y1="80" x2="410" y2="80" stroke="var(--line-strong)" strokeWidth="1.4" />
          <line x1="372" y1="250" x2="410" y2="250" stroke="var(--line-strong)" strokeWidth="1.4" />
          <line x1="520" y1="80" x2="560" y2="150" stroke="var(--line-strong)" strokeWidth="1.4" />
          <line x1="520" y1="250" x2="560" y2="180" stroke="var(--line-strong)" strokeWidth="1.4" />

          <text x="98" y="105" fontSize="11" fill="var(--faint)" fontFamily="var(--mono)">loop A</text>
          <text x="98" y="236" fontSize="11" fill="var(--faint)" fontFamily="var(--mono)">loop B</text>

          <Node x={12} y={135} w={78} h={60} title="Site" sub={s.id} />
          <Node x={115} y={52} title="Curtis St CO" sub="wire center A" />
          <Node x={115} y={222} title="Capitol Hill CO" sub="wire center B" />
          <Node x={262} y={52} title="PoP A · fl 6" sub="AS64801" danger />
          <Node x={262} y={222} title="PoP B · fl 9" sub="AS64907" danger />
          <Node x={410} y={52} title="Backbone A" sub="AS64801" />
          <Node x={410} y={222} title="Backbone B" sub="AS64907" />
          <Node x={560} y={135} w={108} h={60} title="Cloud on-ramp" sub="AS16509" />
        </svg>
        <p className="small warn" style={{ margin: '8px 0 0' }}>
          AS paths are fully diverse, but both circuits terminate in one building. A facility event at the carrier hotel takes down both paths.
        </p>
      </div>

      <RubricSection site={site} />

      <div className="card">
        <p className="card-title">Design assumption ledger</p>
        <p className="card-sub">Every diversity claim recorded as a testable assumption with evidence and expiry</p>
        <div className="row-list" style={{ border: '1px solid var(--line)' }}>
          {assumptions.map((a) => (
            <div key={a.text} className="row-item">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontWeight: 600, fontSize: 14, flex: 1, minWidth: 220 }}>{a.text}</span>
                <Pill kind={statusMeta[a.status].pill}>{statusMeta[a.status].label}</Pill>
              </div>
              <p className="small muted" style={{ margin: '4px 0 0' }}>{a.note}</p>
              <p className="small faint mono" style={{ margin: '4px 0 0', fontSize: 12, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <AgeBadge fact={a.fact} />
                <span>evidence date {a.fact.evidenceDate} · validity window: {a.fact.validityDays}d</span>
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
