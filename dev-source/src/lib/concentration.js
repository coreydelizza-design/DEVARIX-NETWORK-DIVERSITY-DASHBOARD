// Concentration findings derived from the synthetic portfolio — pure
// computation, no seeding needed, identical every load. Carriers here
// are genericized names; the ctppAnalog flag marks providers whose
// real-world analogs carry critical-provider designation in the EU.
// The UI never names real companies.

import { sites } from './syntheticData'
import { agingBand } from './provenance'

function buildFindings() {
  const carrierExpired = {}
  const dominantCount = {}
  let expiredTotal = 0
  let singleCarrierSites = 0

  sites.forEach((site) => {
    const per = {}
    site.facts.forEach((f) => {
      per[f.carrier] = (per[f.carrier] || 0) + 1
      if (agingBand(f) === 'expired') {
        carrierExpired[f.carrier] = (carrierExpired[f.carrier] || 0) + 1
        expiredTotal++
      }
    })
    const names = Object.keys(per).sort((a, b) => per[b] - per[a] || a.localeCompare(b))
    if (names.length === 1) singleCarrierSites++
    if (names[0]) dominantCount[names[0]] = (dominantCount[names[0]] || 0) + 1
  })

  const topDominant = Object.entries(dominantCount).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]
  const topExpired = Object.entries(carrierExpired).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]
  const nniSites = sites.filter((s) => s.flags.some((f) => f[0] === 'Single NNI convergence')).length

  const findings = [
    {
      id: 'dominant-carrier',
      text: `${Math.round((topDominant[1] / sites.length) * 100)}% of sites carry most of their evidence footprint on ${topDominant[0]}`,
      severity: 'high',
      carrier: topDominant[0],
    },
    {
      id: 'single-carrier-sites',
      text: `${singleCarrierSites} sites depend on a single carrier across every evidenced domain`,
      severity: singleCarrierSites > 10 ? 'high' : 'medium',
      carrier: null,
    },
    {
      id: 'nni-funnel',
      text: `${nniSites} sites funnel traffic through a single NNI`,
      severity: 'high',
      carrier: null,
    },
    {
      id: 'expired-concentration',
      text: `${topExpired[0]} accounts for ${Math.round((topExpired[1] / expiredTotal) * 100)}% of expired evidence portfolio-wide`,
      severity: 'medium',
      carrier: topExpired[0],
    },
  ]

  return findings.map((f) => ({ ...f, ctppAnalog: /^Carrier (one|two|three)$/.test(f.carrier || '') }))
}

export const concentrationFindings = buildFindings()
