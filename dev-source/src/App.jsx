import { useState } from 'react'
import Engagements from './views/Engagements'
import Dashboard from './views/Dashboard'
import Scorer from './views/Scorer'
import SiteDetail from './views/SiteDetail'
import Intake from './views/Intake'
import EvidenceChecks from './views/EvidenceChecks'
import Tco from './views/Tco'
import FindingsReport from './views/FindingsReport'

// Two modes, one app. Demo is the synthetic showcase; Engagement is the
// persisted audit pipeline. Demo views read only synthetic data;
// engagement views read only the store.
const DEMO_NAV = [
  ['dashboard', 'Portfolio'],
  ['scorer', 'Site scorer'],
  ['site', 'Site drill-down'],
  ['tco', 'Outage TCO'],
]

const ENGAGEMENT_NAV = [
  ['engagements', '1 Engagement'],
  ['intake', '2 Intake'],
  ['evidence', '3 Evidence & checks'],
  ['findings', '4 Deliverable'],
]

export default function App() {
  const [mode, setMode] = useState(() => {
    try { return localStorage.getItem('devarix.ui.mode') || 'demo' } catch { return 'demo' }
  })
  const [view, setView] = useState(mode === 'demo' ? 'dashboard' : 'engagements')
  const [activeSite, setActiveSite] = useState(null)

  const nav = mode === 'demo' ? DEMO_NAV : ENGAGEMENT_NAV

  const switchMode = (m) => {
    if (m === mode) return
    setMode(m)
    try { localStorage.setItem('devarix.ui.mode', m) } catch { /* ignore */ }
    setView(m === 'demo' ? 'dashboard' : 'engagements')
  }

  const openSite = (site) => {
    setActiveSite(site)
    setView('site')
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <p className="brand-name">DEVARIX</p>
          <p className="brand-sub">Network diversity assurance</p>
        </div>
        <div className="mode-switch">
          {[['demo', 'Demo'], ['engagement', 'Engagement']].map(([m, label]) => (
            <button key={m} className={mode === m ? 'active' : ''} onClick={() => switchMode(m)}>
              {label}
            </button>
          ))}
        </div>
        {nav.map(([key, label], i) => (
          <button
            key={key}
            className={`nav-item ${view === key ? 'active' : ''}`}
            onClick={() => setView(key)}
          >
            <span className="nav-num">0{i + 1}</span>
            {label}
          </button>
        ))}
        <div className="sidebar-foot">
          {mode === 'demo'
            ? 'Demo build · synthetic data. Scores, sites, carriers, and circuit IDs are illustrative.'
            : 'Engagement data persists in this browser. Export from the Engagement step before clearing storage.'}
        </div>
      </aside>
      <main className="main">
        {mode === 'demo' && (
          <div className="demo-banner no-print">Demo data — synthetic portfolio for illustration</div>
        )}
        {mode === 'demo' && view === 'dashboard' && <Dashboard openSite={openSite} />}
        {mode === 'demo' && view === 'scorer' && <Scorer />}
        {mode === 'demo' && view === 'site' && <SiteDetail site={activeSite} />}
        {mode === 'demo' && view === 'tco' && <Tco />}
        {mode === 'engagement' && view === 'engagements' && <Engagements />}
        {mode === 'engagement' && view === 'intake' && <Intake />}
        {mode === 'engagement' && view === 'evidence' && <EvidenceChecks />}
        {mode === 'engagement' && view === 'findings' && <FindingsReport />}
      </main>
    </div>
  )
}
