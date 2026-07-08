import { useState } from 'react'
import { PageHead, Metric } from '../components/ui'

function fk(n) {
  if (n >= 1000) return '$' + (n / 1000).toFixed(n >= 10000 ? 1 : 2) + 'M'
  return '$' + Math.round(n) + 'k'
}

function Slider({ label, value, onChange, min, max, step, format }) {
  return (
    <div className="slider-row">
      <label className="slider-label">{label}</label>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <span className="slider-value">{format(value)}</span>
    </div>
  )
}

export default function Tco() {
  const [rev, setRev] = useState(80)
  const [inc, setInc] = useState(2)
  const [dur, setDur] = useState(4)
  const [emp, setEmp] = useState(450)
  const [lc, setLc] = useState(75)
  const [capex, setCapex] = useState(180)
  const [opex, setOpex] = useState(36)
  const [red, setRed] = useState(70)

  const perHr = rev + (emp * lc * 0.6) / 1000
  const exposure = inc * dur * perHr
  const avoided = exposure * (red / 100)
  const netAnnual = avoided - opex
  const months = netAnnual > 0 ? (capex / netAnnual) * 12 : null
  const net3 = 3 * netAnnual - capex

  let verdict
  if (netAnnual <= 0) {
    verdict = 'At these inputs remediation does not pay for itself in avoided downtime alone — the case would rest on compliance, SLA, or contractual exposure instead.'
  } else if (months !== null && months <= 12) {
    verdict = 'Remediation pays for itself within a year of avoided downtime. This is a fund-now recommendation in the standardized report.'
  } else {
    verdict = 'Positive return with a payback beyond one year — typically bundled into the next contract renewal or infrastructure cycle rather than funded standalone.'
  }

  return (
    <div>
      <PageHead
        eyebrow="Economics"
        title="Outage TCO calculator"
        sub="Turns a diversity score into a funded remediation decision. Downtime reduction is derived from the score delta — remediation eliminates the common-mode failures that drive multi-hour, both-circuits-down incidents."
      />

      <div className="two-col" style={{ marginBottom: 20 }}>
        <div className="card" style={{ margin: 0 }}>
          <p className="card-title">Outage exposure inputs</p>
          <Slider label="Revenue at risk / hr" value={rev} onChange={setRev} min={0} max={500} step={5} format={(v) => '$' + v + 'k'} />
          <Slider label="Incidents / year" value={inc} onChange={setInc} min={0} max={12} step={0.5} format={(v) => String(v)} />
          <Slider label="Avg duration (hrs)" value={dur} onChange={setDur} min={0.5} max={24} step={0.5} format={(v) => String(v)} />
          <Slider label="Employees idled" value={emp} onChange={setEmp} min={0} max={2000} step={25} format={(v) => String(v)} />
          <Slider label="Loaded cost / emp / hr" value={lc} onChange={setLc} min={20} max={200} step={5} format={(v) => '$' + v} />
        </div>
        <div className="card" style={{ margin: 0 }}>
          <p className="card-title">Remediation inputs</p>
          <Slider label="One-time cost" value={capex} onChange={setCapex} min={0} max={1000} step={10} format={(v) => '$' + v + 'k'} />
          <Slider label="Added annual cost" value={opex} onChange={setOpex} min={0} max={240} step={2} format={(v) => '$' + v + 'k'} />
          <Slider label="Downtime reduction" value={red} onChange={setRed} min={0} max={95} step={5} format={(v) => v + '%'} />
          <p className="small faint" style={{ margin: '8px 0 0' }}>
            Workforce cost is discounted to 60% of loaded cost — people partially work around outages.
          </p>
        </div>
      </div>

      <div className="metric-grid">
        <Metric label="Annual outage exposure" value={fk(exposure)} tone="var(--red)" />
        <Metric label="Avoided loss / year" value={fk(avoided)} tone="var(--teal)" />
        <Metric label="Payback" value={months === null ? '—' : months < 1 ? '<1 mo' : Math.round(months) + ' mo'} />
        <Metric label="3-year net benefit" value={(net3 < 0 ? '-' : '') + fk(Math.abs(net3))} tone={net3 >= 0 ? 'var(--teal)' : 'var(--red)'} />
      </div>

      <p className="small muted" style={{ maxWidth: '70ch' }}>{verdict}</p>
    </div>
  )
}
