import { useState } from 'react'
import { useStore, selectEngagement } from './lib/store'
import Sites from './views/Sites'
import Site from './views/Site'
import EvidenceQueue from './views/EvidenceQueue'
import Deliverable from './views/Deliverable'
import EngagementSettings from './views/EngagementSettings'

// One app, always inside an open engagement (spine §2.1). Nav is four
// nouns plus the engagement picker.
const NAV = [
  ['sites', 'Sites'],
  ['evidence', 'Evidence queue'],
  ['deliverable', 'Deliverable'],
  ['settings', 'Engagement settings'],
]

export default function App() {
  const s = useStore()
  const [view, setView] = useState('sites')
  const [activeSite, setActiveSite] = useState(null)
  const [siteTab, setSiteTab] = useState('overview')

  const active = s.engagements.find((e) => e.id === s.active_engagement_id) || s.engagements[0]

  const openSite = (site, tab = 'overview') => {
    setActiveSite(site)
    setSiteTab(tab)
    setView('site')
  }
  const openSiteTab = (siteId, tab) => {
    const site = (active.sites || []).find((x) => x.id === siteId)
    if (site) openSite(site, tab)
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <p className="brand-name">DEVARIX</p>
          <p className="brand-sub">Infrastructure dependency assurance</p>
        </div>
        <div className="eng-picker">
          <label className="small faint">Engagement</label>
          <select value={s.active_engagement_id || ''} onChange={(e) => { selectEngagement(e.target.value); setView('sites') }}>
            {s.engagements.map((e) => <option key={e.id} value={e.id}>{e.sample ? '★ ' : ''}{e.name}</option>)}
          </select>
        </div>
        {NAV.map(([key, label], i) => (
          <button key={key} className={`nav-item ${view === key ? 'active' : ''}`} onClick={() => setView(key)}>
            <span className="nav-num">0{i + 1}</span>{label}
          </button>
        ))}
        <div className="sidebar-foot">
          {active && active.sample
            ? 'Sample engagement — synthetic, read-only, excluded from export.'
            : 'Engagement data persists in this browser. Export from settings before clearing storage.'}
        </div>
      </aside>
      <main className="main">
        {active && active.sample && <div className="sample-banner no-print">SAMPLE — synthetic engagement for illustration. Read-only, excluded from export.</div>}
        {view === 'sites' && <Sites openSite={openSite} />}
        {view === 'site' && <Site site={activeSite} back={() => setView('sites')} />}
        {view === 'evidence' && <EvidenceQueue openSiteTab={openSiteTab} />}
        {view === 'deliverable' && <Deliverable />}
        {view === 'settings' && <EngagementSettings />}
      </main>
    </div>
  )
}
