// Outage TCO math, extracted so the findings report's cost-of-inertia
// section and the interactive TCO view compute identical numbers.

export const DEFAULT_TCO_INPUTS = { rev: 80, inc: 2, dur: 4, emp: 450, lc: 75, capex: 180, opex: 36, red: 70 }

export function computeTco({ rev, inc, dur, emp, lc, capex, opex, red }) {
  // Workforce cost discounted to 60% of loaded cost — people partially
  // work around outages.
  const perHr = rev + (emp * lc * 0.6) / 1000
  const exposure = inc * dur * perHr
  const avoided = exposure * (red / 100)
  const netAnnual = avoided - opex
  const months = netAnnual > 0 ? (capex / netAnnual) * 12 : null
  const net3 = 3 * netAnnual - capex
  return { perHr, exposure, avoided, netAnnual, months, net3 }
}

export function fk(n) {
  if (n >= 1000) return '$' + (n / 1000).toFixed(n >= 10000 ? 1 : 2) + 'M'
  return '$' + Math.round(n) + 'k'
}
