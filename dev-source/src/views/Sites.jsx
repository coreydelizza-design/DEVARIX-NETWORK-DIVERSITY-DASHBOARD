import { useMemo, useState } from 'react'
import { useStore, activeEngagement } from '../lib/store'
import { siteConformance, siteFreshness, nextAction, conformanceRate, VERDICTS, VERDICT_ORDER } from '../lib/graphScoring'
import { detectCollisions } from '../lib/collisions'
import { tierMisassigned } from '../lib/tierModel'
import SiteCard from '../components/SiteCard'
import { PageHead, Metric, Pill } from '../components/ui'

const BAND_COLORS = { fresh: '#0b7261', aging: '#c07f16', expired: '#a83228' }
const PAGE = 12

function FreshBar({ b }) {
  const t = b.fresh + b.aging + b.expired || 1
  return (
    <div className="dist" style={{ height: 5, width: 70 }}>
      {['fresh', 'aging', 'expired'].map((k) => (
        <div key={k} style={{ width: `${(b[k] / t) * 100}%`, background: BAND_COLORS[k] }} title={`${k}: ${b[k]}`} />
      ))}
    </div>
  )
}

export default function Sites({ openSite }) {
  const s = useStore()
  const eng = activeEngagement(s)
  const elements = s.registry.elements || {}
  const [q, setQ] = useState('')
  const [region, setRegion] = useState('all')
  const [tier, setTier] = useState('all')
  const [verdict, setVerdict] = useState('all')
  const [cover, setCover] = useState('all')
  const [sort, setSort] = useState('verdict')
  const [asc, setAsc] = useState(true)
  const [page, setPage] = useState(0)
  const [cards, setCards] = useState(false)

  const rows = useMemo(() => {
    if (!eng) return []
    return eng.sites.map((site) => {
      const c = siteConformance(eng, elements, site)
      const top = detectCollisions(eng, elements, site.id)[0]
      return {
        site, c, fresh: siteFreshness(eng, elements, site),
        topFinding: top ? `${top.layer} ${top.typeName}` : '—',
        misassigned: tierMisassigned(site),
      }
    })
  }, [eng, elements])

  const filtered = useMemo(() => {
    let r = rows.filter((x) =>
      (!q || x.site.name.toLowerCase().includes(q.toLowerCase()) || x.site.id.toLowerCase().includes(q.toLowerCase())) &&
      (region === 'all' || x.site.region === region) &&
      (tier === 'all' || x.site.tier === tier) &&
      (verdict === 'all' || x.c.verdict === verdict) &&
      (cover === 'all' || (cover === 'low' ? x.c.coverage < 60 : x.c.coverage >= 60))
    )
    const dir = asc ? 1 : -1
    r = [...r].sort((a, b) => {
      if (sort === 'verdict') return dir * (VERDICT_ORDER.indexOf(a.c.verdict) - VERDICT_ORDER.indexOf(b.c.verdict))
      if (sort === 'score') return dir * ((a.c.score ?? -1) - (b.c.score ?? -1))
      if (sort === 'coverage') return dir * (a.c.coverage - b.c.coverage)
      if (sort === 'tier') return dir * a.site.tier.localeCompare(b.site.tier)
      return dir * a.site.name.localeCompare(b.site.name)
    })
    return r
  }, [rows, q, region, tier, verdict, cover, sort, asc])

  if (!eng) return <div><PageHead eyebrow="Sites" title="Sites" sub="Select an engagement." /></div>

  const rate = conformanceRate(eng, elements, eng.sites)
  const counts = {}
  VERDICT_ORDER.forEach((v) => { counts[v] = 0 })
  rows.forEach((x) => { counts[x.c.verdict]++ })
  const pages = Math.ceil(filtered.length / PAGE)
  const shown = filtered.slice(page * PAGE, page * PAGE + PAGE)
  const setSortCol = (col) => { if (sort === col) setAsc(!asc); else { setSort(col); setAsc(true) } }

  const exportCsv = () => {
    const head = ['id', 'name', 'region', 'tier', 'verdict', 'score', 'coverage', 'top_finding', 'next_action']
    const lines = [head.join(',')].concat(filtered.map((x) => [x.site.id, `"${x.site.name}"`, x.site.region, x.site.tier, `"${x.c.verdict}"`, x.c.score ?? '', x.c.coverage, `"${x.topFinding}"`, `"${nextAction(x.c)}"`].join(',')))
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }))
    a.download = 'sites.csv'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div>
      <PageHead eyebrow="Sites" title={`Sites · ${eng.name}`} sub="Every site measured on the graph, then judged against its tier. The score is the measurement; the verdict is the judgment." />

      <div className="metric-grid">
        <Metric label="Conformance rate" value={`${rate}%`} />
        <Metric label="Sites" value={eng.sites.length} />
        <Metric label="Nonconformant" value={counts.Nonconformant} tone="var(--red)" />
        <Metric label="At risk" value={counts['Conformant · at risk']} tone="var(--amber, #c07f16)" />
      </div>

      <div className="filters">
        <input type="text" placeholder="Search sites…" value={q} onChange={(e) => { setQ(e.target.value); setPage(0) }} style={{ minWidth: 160 }} />
        <select value={region} onChange={(e) => { setRegion(e.target.value); setPage(0) }}><option value="all">All regions</option>{['AMER', 'EMEA', 'APAC', 'LATAM'].map((x) => <option key={x}>{x}</option>)}</select>
        <select value={tier} onChange={(e) => { setTier(e.target.value); setPage(0) }}><option value="all">All tiers</option>{['T1', 'T2', 'T3', 'T4'].map((x) => <option key={x}>{x}</option>)}</select>
        <select value={verdict} onChange={(e) => { setVerdict(e.target.value); setPage(0) }}><option value="all">All verdicts</option>{VERDICT_ORDER.map((x) => <option key={x} value={x}>{x}</option>)}</select>
        <select value={cover} onChange={(e) => { setCover(e.target.value); setPage(0) }}><option value="all">All coverage</option><option value="low">Coverage &lt; 60%</option><option value="high">Coverage ≥ 60%</option></select>
        <button className="btn" onClick={exportCsv}>Export CSV</button>
        <button className="btn" onClick={() => setCards(!cards)}>{cards ? 'Table' : 'Cards'}</button>
        <span className="small faint">{filtered.length} of {eng.sites.length} sites</span>
      </div>

      {cards ? (
        <div className="site-grid">
          {shown.map((x) => <SiteCard key={x.site.id} site={x.site} conformance={x.c} fresh={x.fresh} onOpen={() => openSite(x.site)} />)}
        </div>
      ) : (
        <div className="table-wrap">
          <table className="sites-table">
            <thead>
              <tr>
                <th onClick={() => setSortCol('name')}>Site</th>
                <th onClick={() => setSortCol('tier')}>Tier</th>
                <th onClick={() => setSortCol('verdict')}>Verdict</th>
                <th onClick={() => setSortCol('score')}>Score</th>
                <th onClick={() => setSortCol('coverage')}>Coverage</th>
                <th>Freshness</th>
                <th>Top finding</th>
                <th>Next action</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((x) => (
                <tr key={x.site.id} onClick={() => openSite(x.site)} style={{ cursor: 'pointer' }}>
                  <td><span style={{ fontWeight: 600 }}>{x.site.city}</span> <span className="mono faint" style={{ fontSize: 11 }}>{x.site.id}</span><div className="small muted">{x.site.region} · {x.site.siteType}</div></td>
                  <td><span className="tier-chip">{x.site.tier}</span>{x.misassigned && <Pill kind="pill-amber">review</Pill>}</td>
                  <td><Pill kind={VERDICTS[x.c.verdict].pill}>{x.c.verdict}</Pill></td>
                  <td className="mono" style={{ color: 'var(--muted)' }}>{x.c.score ?? '—'}</td>
                  <td className="mono" style={{ color: x.c.coverage < 60 ? 'var(--red)' : 'var(--muted)' }}>{x.c.coverage}%</td>
                  <td><FreshBar b={x.fresh} /></td>
                  <td className="small muted">{x.topFinding}</td>
                  <td className="small faint">{nextAction(x.c)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12 }}>
          <button className="btn" disabled={page === 0} onClick={() => setPage(page - 1)}>Prev</button>
          <span className="small muted">Page {page + 1} of {pages}</span>
          <button className="btn" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      )}
    </div>
  )
}
