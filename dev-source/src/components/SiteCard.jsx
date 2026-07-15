import { Pill, ScoreBar } from './ui'
import { VERDICTS } from '../lib/conformance'
import { tierMisassigned } from '../lib/tierModel'
import { agingBand } from '../lib/provenance'

const BAND_COLORS = { fresh: '#0b7261', aging: '#c07f16', expired: '#a83228' }
const NEUTRAL_SCORE = '#9aa1a9'

export default function SiteCard({ site, conformance, onOpen }) {
  const c = conformance
  const tier = site.tierAssignment ? site.tierAssignment.tier : '—'
  const bands = { fresh: 0, aging: 0, expired: 0 }
  ;(site.facts || []).forEach((f) => bands[agingBand(f)]++)
  const factTotal = bands.fresh + bands.aging + bands.expired
  const gaps = bands.expired
  const carrier = (site.facts && site.facts[0] && site.facts[0].carrier) || 'Carrier one'

  let finding
  let action
  switch (c.verdict) {
    case 'Nonconformant': {
      const top = [...c.failingDomains].sort((x, y) => y.weight - x.weight)[0]
      finding = `Fails ${tier} on ${top.domain} — ${top.reason} below requirement`
      action = `LOA pending · ${carrier}`
      break
    }
    case 'Conformant · at risk':
      finding = c.soonestExpiry
        ? c.soonestExpiry.days < 0
          ? `${c.soonestExpiry.domain} evidence expired ${-c.soonestExpiry.days}d ago`
          : `${c.soonestExpiry.domain} evidence expires in ${c.soonestExpiry.days}d`
        : 'Evidence provenance below tier requirement'
      action = c.soonestExpiry && c.soonestExpiry.days < 0 ? 'delta refresh recommended' : `refresh due ${c.soonestExpiry ? c.soonestExpiry.days : 0}d`
      break
    case 'Over-provisioned':
      finding = `Exceeds ${tier} requirements in ${c.marginNotes.overDomains} domains — spend above need`
      action = 'cost-recovery finding'
      break
    case 'Conformant':
      finding = `Meets ${tier} requirements across ${c.applicableDomains.length} domains`
      action = c.soonestExpiry ? `refresh due ${c.soonestExpiry.days}d` : 'refresh scheduled'
      break
    default:
      finding = site.tierAssignment ? 'No evidence captured for this site' : 'No resilience tier assigned'
      action = site.tierAssignment ? `LOA pending · ${carrier}` : 'assign tier'
  }

  return (
    <div className="site-card" onClick={onOpen} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onOpen()}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
        <span style={{ fontWeight: 600, fontSize: 14 }}>
          {site.city} <span className="mono faint" style={{ fontWeight: 400, fontSize: 12 }}>{site.id}</span>
        </span>
        <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {tierMisassigned(site) && <Pill kind="pill-amber">tier under review</Pill>}
          <span className="tier-chip">{tier}</span>
        </span>
      </div>
      <p className="small muted" style={{ margin: '2px 0 8px' }}>{site.region} · {site.tier}</p>

      <div style={{ marginBottom: 8 }}>
        <Pill kind={VERDICTS[c.verdict].pill}>{c.verdict}</Pill>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span className="small muted" style={{ flex: '0 0 38px' }}>Score</span>
        <ScoreBar score={site.score} color={NEUTRAL_SCORE} />
      </div>

      <div className="dist" style={{ height: 4, marginBottom: 8 }}>
        {factTotal > 0
          ? ['fresh', 'aging', 'expired'].map((b) => (
              <div key={b} style={{ width: `${(bands[b] / factTotal) * 100}%`, background: BAND_COLORS[b] }} title={`${b}: ${bands[b]}`} />
            ))
          : <div style={{ width: '100%', background: 'var(--line)' }} title="no evidence" />}
      </div>

      <p className="small muted" style={{ margin: '0 0 8px' }}>{finding}</p>

      <p className="small faint mono" style={{ margin: 0, fontSize: 12 }}>
        {action} · {gaps} open gap{gaps === 1 ? '' : 's'}
      </p>
    </div>
  )
}
