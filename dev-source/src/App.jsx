import { useState } from 'react'
import Dashboard from './views/Dashboard'
import Scorer from './views/Scorer'
import SiteDetail from './views/SiteDetail'
import Intake from './views/Intake'
import Tco from './views/Tco'
import Reports from './views/Reports'

const nav = [
  ['dashboard', 'Portfolio'],
  ['scorer', 'Site scorer'],
  ['site', 'Site drill-down'],
  ['intake', 'Intake & validation'],
  ['tco', 'Outage TCO'],
  ['reports', 'Reports'],
]

export default function App() {
  const [view, setView] = useState('dashboard')
  const [activeSite, setActiveSite] = useState(null)

  const openSite = (site) => {
    setActiveSite(site)
    setView('site')
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <p className="brand-name">PATHSTEAD</p>
          <p className="brand-sub">Network diversity assurance</p>
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
          Demo build · synthetic data. Scores, sites, carriers, and circuit IDs are illustrative.
        </div>
      </aside>
      <main className="main">
        {view === 'dashboard' && <Dashboard openSite={openSite} />}
        {view === 'scorer' && <Scorer />}
        {view === 'site' && <SiteDetail site={activeSite} />}
        {view === 'intake' && <Intake />}
        {view === 'tco' && <Tco />}
        {view === 'reports' && <Reports />}
      </main>
    </div>
  )
}
