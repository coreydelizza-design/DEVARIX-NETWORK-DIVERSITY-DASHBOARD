import { Pill, ScoreBar } from './ui'
import { VERDICTS, nextAction } from '../lib/graphScoring'
import { tierMisassigned } from '../lib/tierModel'

const BAND_COLORS = { fresh: '#0b7261', aging: '#c07f16', expired: '#a83228' }
const NEUTRAL_SCORE = '#9aa1a9'

// The card model: verdict pill is the only status-colored element; score
// renders neutral. Freshness bands are passed in (computed by the caller).
export default function SiteCard({ site, conformance, fresh = { fresh: 0, aging: 0, expired: 0 }, onOpen }) {
  const c = conformance
  const tier = site.tierAssignment ? site.tierAssignment.tier : '—'
  const total = fresh.fresh + fresh.aging + fresh.expired
  const top = c.collisions && c.collisions[0]
  const finding = top ? `${top.layer} ${top.typeName} shared across ${top.services.length} services` : c.verdict === 'Not assessed' ? 'No tier or evidence captured' : 'No shared-fate collisions'

  return (
    <div className="site-card" onClick={onOpen} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onOpen()}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
        <span style={{ fontWeight: 600, fontSize: 14 }}>{site.city} <span className="mono faint" style={{ fontWeight: 400, fontSize: 12 }}>{site.id}</span></span>
        <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {tierMisassigned(site) && <Pill kind="pill-amber">tier under review</Pill>}
          <span className="tier-chip">{tier}</span>
        </span>
      </div>
      <p className="small muted" style={{ margin: '2px 0 8px' }}>{site.region} · {site.siteType || ''}</p>

      <div style={{ marginBottom: 8 }}><Pill kind={VERDICTS[c.verdict].pill}>{c.verdict}</Pill></div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span className="small muted" style={{ flex: '0 0 38px' }}>Score</span>
        <ScoreBar score={c.score ?? 0} color={NEUTRAL_SCORE} />
        <span className="small muted mono">{c.coverage}% cov</span>
      </div>

      <div className="dist" style={{ height: 4, marginBottom: 8 }}>
        {total > 0 ? ['fresh', 'aging', 'expired'].map((b) => <div key={b} style={{ width: `${(fresh[b] / total) * 100}%`, background: BAND_COLORS[b] }} title={`${b}: ${fresh[b]}`} />)
          : <div style={{ width: '100%', background: 'var(--line)' }} title="no evidence" />}
      </div>

      <p className="small muted" style={{ margin: '0 0 8px' }}>{finding}</p>
      <p className="small faint mono" style={{ margin: 0, fontSize: 12 }}>{nextAction(c)} · {fresh.expired} expired</p>
    </div>
  )
}
