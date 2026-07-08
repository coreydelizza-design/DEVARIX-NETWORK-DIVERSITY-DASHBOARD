import { gradeOf } from './scoringModel'

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
