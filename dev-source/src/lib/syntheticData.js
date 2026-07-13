import { gradeOf } from './scoringModel'
import { TODAY, agingBand } from './provenance'

// Deterministic seeded RNG so the demo portfolio is stable across reloads.
function rng(seed) {
  let s = seed
  return function () {
    s = (s * 1103515245 + 12345) % 2147483648
    return s / 2147483648
  }
}

const regions = ['AMER', 'EMEA', 'APAC', 'LATAM']
const tiers = [
  ['Data center', 18],
  ['Regional hub', 32],
  ['Plant', 50],
  ['Branch', 80],
]
const cities = [
  'Denver', 'Frankfurt', 'Singapore', 'Sao Paulo', 'Chicago', 'London', 'Tokyo',
  'Mexico City', 'Dallas', 'Amsterdam', 'Sydney', 'Bogota', 'Atlanta', 'Paris',
  'Mumbai', 'Santiago', 'Phoenix', 'Madrid', 'Seoul', 'Lima', 'Toronto', 'Milan',
  'Osaka', 'Monterrey', 'Seattle', 'Warsaw', 'Bangkok', 'Buenos Aires', 'Boston',
  'Dublin', 'Manila', 'Quito',
]

// [flag text, domain, weighted portfolio impact per site]
export const flagPool = [
  ['Same conduit or building entrance', 'Local loop', 5.2],
  ['Both loops home to same wire center', 'Wire center', 3.1],
  ['Single NNI convergence', 'Backbone', 4.4],
  ['Single edge router', 'Hardware', 3.8],
  ['Single entrance facility', 'Data center', 3.4],
  ['Both circuits on one access carrier', 'Local loop', 4.6],
  ['Long-haul route unvalidated', 'Backbone', 2.2],
  ['Single cloud on-ramp', 'Cloud', 2.8],
  ['No A+B power feeds', 'Data center', 2.4],
  ['Internet-only cloud path', 'Cloud', 2.0],
  ['Local loop path unvalidated', 'Local loop', 2.6],
  ['Redundant routers share power', 'Hardware', 1.8],
]

function buildSites() {
  const r = rng(42)
  const sites = []
  let id = 100
  tiers.forEach(([tier, count]) => {
    const base = tier === 'Data center' ? 68 : tier === 'Regional hub' ? 58 : tier === 'Plant' ? 46 : 40
    for (let i = 0; i < count; i++) {
      let score = Math.round(base + (r() * 44 - 22))
      score = Math.max(12, Math.min(98, score))
      const nf = score >= 85 ? Math.round(r()) : score >= 65 ? 1 + Math.round(r() * 2) : score >= 40 ? 2 + Math.round(r() * 3) : 4 + Math.round(r() * 3)
      const pool = flagPool.slice()
      const flags = []
      for (let k = 0; k < nf && pool.length; k++) {
        flags.push(pool.splice(Math.floor(r() * pool.length), 1)[0])
      }
      sites.push({
        id: 'S-' + id++,
        city: cities[Math.floor(r() * cities.length)],
        region: regions[Math.floor(r() * 4)],
        tier,
        score,
        grade: gradeOf(score),
        flags,
      })
    }
  })
  return sites
}

export const sites = buildSites()

// --- evidence facts (demo provenance layer) ---
// A separate seeded RNG so adding facts leaves the existing site
// scores, flags, and cities byte-identical.

const factPool = [
  'Access carrier separation',
  'Local loop conduit path',
  'Serving wire center assignment',
  'Entrance facility separation',
  'A+B power feed separation',
  'Edge router redundancy',
  'Backbone provider separation',
  'NNI handoff mapping',
  'Long-haul route KMZ',
  'Cloud on-ramp redundancy',
]

const factCarriers = ['Carrier one', 'Carrier two', 'Carrier three']

function dateDaysBeforeToday(days) {
  const d = new Date(TODAY)
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

function attachFacts(list) {
  const r = rng(1337)
  list.forEach((site) => {
    const pool = factPool.slice()
    const n = 6 + Math.floor(r() * 5)
    const facts = []
    for (let i = 0; i < n && pool.length; i++) {
      const label = pool.splice(Math.floor(r() * pool.length), 1)[0]
      const carrier = factCarriers[Math.floor(r() * 3)]
      const sPick = r()
      const status = sPick < 0.45 ? 'verified' : sPick < 0.75 ? 'documented' : sPick < 0.92 ? 'declared' : 'inferred'
      const validityDays = [90, 180, 365][Math.floor(r() * 3)]
      // Target roughly 55% fresh / 30% aging / 15% expired portfolio-wide;
      // margins clear the band cutoffs by more than date-rounding error.
      const bPick = r()
      let age
      if (bPick < 0.55) age = Math.floor(r() * 0.65 * validityDays)
      else if (bPick < 0.85) age = Math.floor((0.72 + r() * 0.26) * validityDays)
      else age = Math.floor((1.05 + r() * 0.7) * validityDays)
      facts.push({ label, carrier, status, evidenceDate: dateDaysBeforeToday(age), validityDays })
    }
    site.facts = facts
  })
}
attachFacts(sites)

export function factBands() {
  const counts = { fresh: 0, aging: 0, expired: 0 }
  sites.forEach((s) => s.facts.forEach((f) => counts[agingBand(f)]++))
  return counts
}

export function portfolioStats() {
  const counts = { res: 0, part: 0, exp: 0, crit: 0 }
  let flagTotal = 0
  let scoreTotal = 0
  sites.forEach((s) => {
    counts[s.grade]++
    flagTotal += s.flags.length
    scoreTotal += s.score
  })
  return {
    total: sites.length,
    avg: Math.round(scoreTotal / sites.length),
    critical: counts.crit,
    flags: flagTotal,
    counts,
  }
}

export function remediationPrograms(limit = 5) {
  const agg = {}
  sites.forEach((s) =>
    s.flags.forEach(([text, domain, impact]) => {
      if (!agg[text]) agg[text] = { text, domain, impact: 0, count: 0 }
      agg[text].impact += impact
      agg[text].count++
    })
  )
  return Object.values(agg).sort((a, b) => b.impact - a.impact).slice(0, limit)
}
