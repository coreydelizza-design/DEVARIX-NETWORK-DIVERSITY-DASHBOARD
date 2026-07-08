import { PageHead, Pill } from '../components/ui'

const assumptions = [
  ['Two carriers means two physical paths', 'violated', 'Both PoPs sit in the same carrier hotel; a facility event is a common-mode failure', 'Site survey · Jun 2026'],
  ['Different ASNs ride different long-haul fiber', 'unvalidated', 'Denver to Chicago segment may share leased conduit; KMZ route files not on file for circuit B', 'No evidence'],
  ['Local loops are conduit-diverse', 'validated', 'Separate building entrances and street routes confirmed against carrier KMZ', 'KMZ pair · Mar 2026'],
  ['Serving wire centers are distinct', 'validated', 'Curtis St and Capitol Hill COs confirmed from carrier inventory records', 'LOA/CFA · Mar 2026'],
  ['Cloud on-ramp is redundant', 'violated', 'Single direct connect, landed in the same carrier hotel as both PoPs', 'Cross-connect record · Jun 2026'],
  ['Failover is hitless under single-circuit loss', 'unvalidated', 'BGP failover designed but never exercised under load; last test predates router refresh', 'Test overdue'],
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

      <div className="card">
        <p className="card-title">Design assumption ledger</p>
        <p className="card-sub">Every diversity claim recorded as a testable assumption with evidence and expiry</p>
        <div className="row-list" style={{ border: '1px solid var(--line)' }}>
          {assumptions.map(([text, status, note, evidence]) => (
            <div key={text} className="row-item">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontWeight: 600, fontSize: 14, flex: 1, minWidth: 220 }}>{text}</span>
                <Pill kind={statusMeta[status].pill}>{statusMeta[status].label}</Pill>
              </div>
              <p className="small muted" style={{ margin: '4px 0 0' }}>{note}</p>
              <p className="small faint mono" style={{ margin: '2px 0 0', fontSize: 12 }}>Evidence: {evidence}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
