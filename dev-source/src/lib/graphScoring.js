// Per-site score, coverage, and verdict — derived at render time from the
// element graph (spine §2.6, §3). Domains are views over layer groupings;
// the verdict comes from the tier's required independence per layer versus
// the shared-fate collisions found. Two honest numbers travel together:
// score (measurement) and coverage (% of applicable facts captured).
// Nothing here is stored.

import { LAYER_INDEPENDENCE } from './tierModel'
import { gradeOf } from './scoringModel'
import { recordPoints, legacyGrade } from './evidenceModel'
import { ageInDays } from './provenance'
import { detectCollisions } from './collisions'
import { servicesForSite, elementsForService } from './graph'

export const VERDICTS = {
  Conformant: { pill: 'pill-teal', color: '#0b7261' },
  'Conformant · at risk': { pill: 'pill-amber', color: '#c07f16' },
  Nonconformant: { pill: 'pill-red', color: '#a83228' },
  'Over-provisioned': { pill: 'pill-violet', color: 'var(--violet)' },
  'Not assessed': { pill: 'pill-gray', color: '#9aa1a9' },
}
export const VERDICT_ORDER = ['Nonconformant', 'Conformant · at risk', 'Over-provisioned', 'Conformant', 'Not assessed']

const LAYER_WEIGHT = { L1: 3, L2: 2, L3: 1, adjacent: 0 }
// A diversity fact names the layer it speaks to via its dimension, so a
// service-scoped fact still weights by its true layer.
const LAYER_OF_DIM = {
  wire_center: 'L1', conduit: 'L1', pop_hotel: 'L1', entrance: 'L1', riser: 'L1', power: 'L1', chassis: 'L1',
  access_provider: 'L2', underlying_provider: 'L2', nni: 'L2', loop: 'L2', backbone: 'L2', identity: 'L2', mmr: 'L2',
  asn: 'L3', logical: 'L3', cloud: 'L3',
}

// Aggregate the site's facts into a 0-100 score. Diversity facts are
// service-scoped (about a service's posture at a layer); genuinely
// element-global facts are also counted. Points: diverse×verified best →
// shared worst; weighted by the layer the fact speaks to.
function scoreFromFacts(engagement, elements, site) {
  const svcIds = new Set(servicesForSite(engagement, site.id).map((s) => s.id))
  const facts = (engagement.facts || []).filter((f) => {
    if (f.subjectType === 'service') return svcIds.has(f.subjectId)
    if (f.subjectType === 'element') return [...svcIds].some((sid) => elementsForService(engagement, sid).includes(f.subjectId))
    return false
  })
  if (!facts.length) return { score: null, facts }
  let num = 0
  let den = 0
  facts.forEach((f) => {
    if (!f.outcome) return
    const layer = f.subjectType === 'element' && elements[f.subjectId] ? elements[f.subjectId].layer : LAYER_OF_DIM[f.dimension] || 'L2'
    const w = LAYER_WEIGHT[layer] || 1
    num += (recordPoints(f) / 2) * w
    den += w
  })
  return { score: den ? Math.round((num / den) * 100) : null, facts }
}

export function siteConformance(engagement, elements, site) {
  const tier = site.tierAssignment ? site.tierAssignment.tier : null
  const { score, facts } = scoreFromFacts(engagement, elements, site)
  if (!tier || score === null) {
    return { verdict: 'Not assessed', score, coverage: 0, collisions: [], failingLayers: [], grade: score === null ? null : gradeOf(score) }
  }

  const collisions = detectCollisions(engagement, elements, site.id)
  const indep = LAYER_INDEPENDENCE[tier] || LAYER_INDEPENDENCE.T3

  // A collision fails the site when its layer requires independence and no
  // mitigation applies. 'mitigated' collisions become at-risk, not fail.
  const failingLayers = []
  let atRisk = false
  collisions.forEach((c) => {
    if (c.kind === 'adjacent') { atRisk = true; return }
    const rule = indep[c.layer] || 'tolerated'
    if (rule === 'required') failingLayers.push(c.layer)
    else if (rule === 'mitigated') atRisk = true
  })

  // Coverage: how many of the site's captured facts carry evidence refs,
  // and provenance freshness. A stale/declared-only fact is at-risk.
  const evidenced = facts.filter((f) => f.sourceRef).length
  const coverage = facts.length ? Math.round((evidenced / facts.length) * 100) : 0
  const weakProvenance = facts.some((f) => f.outcome === 'diverse' && legacyGrade(f).grade !== 'VERIFIED_DIVERSE')

  // Over-provisioned is a cost finding: full independence a low tier does
  // not require. A high-tier site meeting its high bar is simply Conformant.
  const lowTier = tier === 'T3' || tier === 'T4'
  let verdict
  if (failingLayers.length) verdict = 'Nonconformant'
  else if (atRisk || weakProvenance || coverage < 60) verdict = 'Conformant · at risk'
  else verdict = collisions.length === 0 && score >= 85 && lowTier ? 'Over-provisioned' : 'Conformant'

  return { verdict, score, coverage, collisions, failingLayers: [...new Set(failingLayers)], grade: gradeOf(score) }
}

// Freshness bands for a site's facts (drives the microbar and worklist).
export function siteFreshness(engagement, elements, site) {
  const svcIds = new Set(servicesForSite(engagement, site.id).map((s) => s.id))
  const facts = (engagement.facts || []).filter((f) => f.subjectType === 'service' && svcIds.has(f.subjectId) && f.outcome)
  const bands = { fresh: 0, aging: 0, expired: 0 }
  facts.forEach((f) => {
    const age = ageInDays(f.capturedDate)
    const w = f.validityDays || 365
    if (age > w) bands.expired++
    else if (age >= 0.7 * w) bands.aging++
    else bands.fresh++
  })
  return bands
}

// The next action a site's verdict implies (for the index + cards).
export function nextAction(c) {
  if (c.verdict === 'Nonconformant') return 'remediate shared-fate finding'
  if (c.verdict === 'Conformant · at risk') return 'refresh / adjudicate evidence'
  if (c.verdict === 'Over-provisioned') return 'cost-recovery review'
  if (c.verdict === 'Not assessed') return 'assign tier / capture evidence'
  return 're-verify on schedule'
}

export function conformanceRate(engagement, elements, sites) {
  let assessed = 0
  let good = 0
  sites.forEach((site) => {
    const v = siteConformance(engagement, elements, site).verdict
    if (v === 'Not assessed') return
    assessed++
    if (v === 'Conformant' || v === 'Over-provisioned') good++
  })
  return assessed ? Math.round((good / assessed) * 100) : 0
}
