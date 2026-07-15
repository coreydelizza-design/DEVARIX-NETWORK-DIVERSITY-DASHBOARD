// Gap & remediation register for the Proof Center. Entries derive
// deterministically from expired evidence facts on the synthetic
// portfolio — an expired fact is an open re-verification gap. Owners,
// target dates, and ordering are seeded, identical every load.

import { sites } from './syntheticData'
import { TODAY, agingBand, effectiveStatus } from './provenance'

const OWNERS = ['Network engineering', 'Procurement', 'Facilities', 'Cloud team']

const DOMAINS = {
  'Access carrier separation': 'Local loop',
  'Local loop conduit path': 'Local loop',
  'Serving wire center assignment': 'Wire center',
  'Entrance facility separation': 'Data center',
  'A+B power feed separation': 'Data center',
  'Edge router redundancy': 'Hardware',
  'Backbone provider separation': 'Backbone',
  'NNI handoff mapping': 'Backbone',
  'Long-haul route KMZ': 'Backbone',
  'Cloud on-ramp redundancy': 'Cloud',
}

// Same LCG as the portfolio generator, its own seed so this register is
// stable regardless of draw order elsewhere.
function rng(seed) {
  let s = seed
  return function () {
    s = (s * 1103515245 + 12345) % 2147483648
    return s / 2147483648
  }
}

function dateFromToday(days) {
  const d = new Date(TODAY)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function buildGaps() {
  const byLabel = {}
  sites.forEach((site) =>
    site.facts.forEach((f) => {
      if (agingBand(f) !== 'expired') return
      if (!byLabel[f.label]) byLabel[f.label] = { siteIds: new Set(), sample: f }
      byLabel[f.label].siteIds.add(site.id)
    })
  )
  const r = rng(7331)
  return Object.entries(byLabel)
    .map(([label, v]) => ({ label, siteCount: v.siteIds.size, sample: v.sample }))
    .sort((a, b) => b.siteCount - a.siteCount || a.label.localeCompare(b.label))
    .slice(0, 12)
    .map((e, i) => {
      const overdue = i === 0 || i === 3 || i === 7
      const offset = overdue ? -(5 + Math.floor(r() * 40)) : 10 + Math.floor(r() * 110)
      return {
        gap: `Re-verify ${e.label.toLowerCase()} — evidence expired`,
        domain: DOMAINS[e.label] || 'Portfolio',
        owner: OWNERS[Math.floor(r() * OWNERS.length)],
        targetDate: dateFromToday(offset),
        siteCount: e.siteCount,
        provenance: effectiveStatus(e.sample),
      }
    })
}

export const gapEntries = buildGaps()

export function gapStats() {
  const overdue = gapEntries.filter((g) => g.targetDate < TODAY).length
  const closing = gapEntries.filter((g) => g.targetDate >= TODAY && g.targetDate <= dateFromToday(60)).length
  return { open: gapEntries.length, overdue, closing }
}
