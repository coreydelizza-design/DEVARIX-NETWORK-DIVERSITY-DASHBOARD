import { gradeOf, model } from './scoringModel'
import { TODAY, agingBand } from './provenance'
import { REQUIREMENTS } from './tierModel'

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

// --- resilience tiers, posture, and tier-aware evidence facts ---
// One deterministic pass (own seed) assigns each site a governed tier,
// declared criticality inputs, per-domain posture selections, and
// evidence facts biased so the portfolio lands at a 60-70% conformance
// rate with all five verdicts represented. Verdicts themselves are never
// stored — conformance.js computes them at render time.

const DOMAIN_LABELS = {
  'Local loop / last mile': ['Access carrier separation', 'Local loop conduit path'],
  'Serving wire center': ['Serving wire center assignment'],
  'Data center facility': ['Entrance facility separation', 'A+B power feed separation'],
  'Edge routers / hardware': ['Edge router redundancy'],
  'Backbone / transport': ['Backbone provider separation', 'NNI handoff mapping', 'Long-haul route KMZ'],
  'Cloud connectivity': ['Cloud on-ramp redundancy'],
}

const LABEL_DOMAIN = {}
Object.entries(DOMAIN_LABELS).forEach(([domain, labels]) => labels.forEach((l) => { LABEL_DOMAIN[l] = domain }))

function attachTiersAndFacts(list) {
  const r = rng(2024)
  const used = new Set()
  const pickDistinct = (n) => {
    const out = new Set()
    while (out.size < n) {
      const i = Math.floor(r() * list.length)
      if (!used.has(i)) {
        used.add(i)
        out.add(i)
      }
    }
    return out
  }
  const opIdx = pickDistinct(6) // Over-provisioned quota
  const naTierIdx = pickDistinct(2) // Not assessed: tier never assigned
  const naFactsIdx = pickDistinct(2) // Not assessed: no evidence captured
  const misIdx = pickDistinct(4) // tier misassignment candidates

  const bestSel = (d) => d.criteria.map((c) => {
    let bi = 0
    c.opts.forEach((o, oi) => { if (o[1] > c.opts[bi][1]) bi = oi })
    return bi
  })

  list.forEach((site, idx) => {
    let tier = site.tier === 'Data center' ? 'T1'
      : site.tier === 'Regional hub' ? (r() < 0.2 ? 'T1' : 'T2')
      : site.tier === 'Plant' ? (r() < 0.5 ? 'T2' : 'T3')
      : (r() < 0.2 ? 'T4' : 'T3')
    if (opIdx.has(idx) || misIdx.has(idx)) tier = 'T3'

    const revK = { T1: 100 + r() * 400, T2: 20 + r() * 100, T3: 2 + r() * 38, T4: 0.5 + r() * 4.5 }[tier]
    site.revenuePerHourUSD = Math.round(revK) * 1000
    site.rtoHours = Math.round({ T1: 1 + r() * 3, T2: 5 + r() * 19, T3: 25 + r() * 47, T4: 72 + r() * 96 }[tier])
    if (misIdx.has(idx)) {
      site.revenuePerHourUSD = 120000 + Math.round(r() * 180) * 1000
      site.rtoHours = 2 + Math.round(r() * 2)
    }

    const assignedBy = r() < 0.1 ? 'customer-override' : 'platform-recommended'
    site.tierAssignment = naTierIdx.has(idx) ? null : {
      tier,
      assignedBy,
      assignedDate: dateDaysBeforeToday(30 + Math.floor(r() * 300)),
      rationale: assignedBy === 'customer-override'
        ? 'Customer designated criticality above platform recommendation'
        : 'Recommended from revenue-at-risk and RTO inputs',
    }

    // Verdict bias target (never stored; only shapes posture and facts).
    let target
    if (opIdx.has(idx)) target = 'op'
    else if (naTierIdx.has(idx) || naFactsIdx.has(idx)) target = 'na'
    else {
      const x = r()
      target = x < 0.62 ? 'conformant' : x < 0.8 ? 'atrisk' : 'nonconformant'
    }
    // T3/T4 posture floors are permissive; posture failure is impossible.
    if (target === 'nonconformant' && (tier === 'T3' || tier === 'T4')) target = 'atrisk'

    const reqs = REQUIREMENTS[tier]
    site.posture = model.map((d, di) => {
      const req = reqs[di]
      if (!req.applicable) return d.criteria.map((c) => Math.floor(r() * c.opts.length))
      return d.criteria.map((c, ci) => Math.max(req.minPosture[ci] || 0, req.anyOf ? req.anyOf[0][ci] || 0 : 0))
    })
    if (target === 'op') {
      let boosted = 0
      model.forEach((d, di) => {
        if (reqs[di].applicable && boosted < 3) {
          site.posture[di] = bestSel(d)
          boosted++
        }
      })
    }
    if (target === 'nonconformant') {
      const di = model.findIndex((d, i) => reqs[i].applicable && reqs[i].minPosture.some((m) => m > 0))
      if (di >= 0) {
        const ci = reqs[di].minPosture.findIndex((m) => m > 0)
        site.posture[di] = [...site.posture[di]]
        site.posture[di][ci] = 0
      }
    }

    let breakDomain = null
    if (target === 'atrisk') {
      const apps = model.map((d, i) => i).filter((i) => reqs[i].applicable)
      breakDomain = model[apps[Math.floor(r() * apps.length)]].name
    }

    const facts = []
    if (!naFactsIdx.has(idx)) {
      model.forEach((d, di) => {
        if (!reqs[di].applicable) return
        const labels = DOMAIN_LABELS[d.name]
        const label = labels[Math.floor(r() * labels.length)]
        const carrier = factCarriers[Math.floor(r() * 3)]
        if (breakDomain === d.name) {
          // Stale past the tier's freshness window (decays too).
          facts.push({ label, carrier, status: 'verified', evidenceDate: dateDaysBeforeToday(reqs[di].freshnessDays + 40 + Math.floor(r() * 100)), validityDays: 365 })
        } else {
          facts.push({ label, carrier, status: 'verified', evidenceDate: dateDaysBeforeToday(Math.floor(r() * Math.min(200, reqs[di].freshnessDays * 0.5))), validityDays: 365 })
        }
      })
      // Decorative facts keep the aging bands populated; low provenance so
      // they can never rescue a biased break, and never on the broken domain.
      const extras = 2 + Math.floor(r() * 3)
      for (let i = 0; i < extras; i++) {
        const label = factPool[Math.floor(r() * factPool.length)]
        if (LABEL_DOMAIN[label] === breakDomain) continue
        const carrier = factCarriers[Math.floor(r() * 3)]
        const status = r() < 0.6 ? 'declared' : 'inferred'
        const validityDays = [90, 180, 365][Math.floor(r() * 3)]
        const bPick = r()
        let age
        if (bPick < 0.5) age = Math.floor(r() * 0.65 * validityDays)
        else if (bPick < 0.8) age = Math.floor((0.72 + r() * 0.26) * validityDays)
        else age = Math.floor((1.05 + r() * 0.7) * validityDays)
        facts.push({ label, carrier, status, evidenceDate: dateDaysBeforeToday(age), validityDays })
      }
    }
    site.facts = facts
  })
}
attachTiersAndFacts(sites)

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
