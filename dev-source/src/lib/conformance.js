// The conformance engine. Conformance = posture + provenance + freshness,
// all three per applicable domain, judged against the tier requirement
// matrix. Verdicts are COMPUTED at render time — there is no stored
// verdict field anywhere. Color encodes the verdict, never the raw score.

import { model } from './scoringModel'
import { REQUIREMENTS, FACT_DOMAINS, OVERPROVISION_MARGIN } from './tierModel'
import { PROVENANCE, effectiveStatus, ageInDays } from './provenance'

export const VERDICTS = {
  Conformant: { pill: 'pill-teal', color: '#0b7261' },
  'Conformant · at risk': { pill: 'pill-amber', color: '#c07f16' },
  Nonconformant: { pill: 'pill-red', color: '#a83228' },
  'Over-provisioned': { pill: 'pill-violet', color: 'var(--violet)' },
  'Not assessed': { pill: 'pill-gray', color: '#9aa1a9' },
}

// Default sort severity: worst first.
export const VERDICT_ORDER = ['Nonconformant', 'Conformant · at risk', 'Over-provisioned', 'Conformant', 'Not assessed']

const rank = (p) => PROVENANCE.indexOf(p)

function domainScore(d, sel) {
  let pts = 0
  let max = 0
  d.criteria.forEach((c, ci) => {
    pts += c.opts[sel[ci]][1]
    max += 2
  })
  return Math.round((pts / max) * 100)
}

const meets = (sel, minArr) => minArr.every((m, i) => sel[i] >= m)

export function computeConformance(site) {
  if (!site.tierAssignment || !site.posture || !site.facts || site.facts.length === 0) {
    return { verdict: 'Not assessed', failingDomains: [], applicableDomains: [], marginNotes: { overDomains: 0 }, soonestExpiry: null }
  }
  const reqs = REQUIREMENTS[site.tierAssignment.tier]
  const failingDomains = []
  const applicableDomains = []
  let overDomains = 0
  let soonestExpiry = null

  model.forEach((d, di) => {
    const req = reqs[di]
    if (!req.applicable) return
    applicableDomains.push(d.name)
    const sel = site.posture[di]

    const postureOk = meets(sel, req.minPosture) && (!req.anyOf || req.anyOf.some((alt) => meets(sel, alt)))
    if (!postureOk) {
      failingDomains.push({ domain: d.name, weight: d.weight, reason: 'posture' })
      return
    }

    const facts = site.facts.filter((f) => FACT_DOMAINS[f.label] === d.name)
    const best = facts
      .slice()
      .sort((a, b) => rank(effectiveStatus(b)) - rank(effectiveStatus(a)) || ageInDays(a.evidenceDate) - ageInDays(b.evidenceDate))[0]
    if (!best || rank(effectiveStatus(best)) < rank(req.requiredProvenance)) {
      failingDomains.push({ domain: d.name, weight: d.weight, reason: 'provenance' })
      return
    }

    const daysLeft = req.freshnessDays - ageInDays(best.evidenceDate)
    if (soonestExpiry === null || daysLeft < soonestExpiry.days) soonestExpiry = { domain: d.name, days: daysLeft }
    if (daysLeft < 0) {
      failingDomains.push({ domain: d.name, weight: d.weight, reason: 'freshness' })
      return
    }

    const minSel = d.criteria.map((c, ci) => req.minPosture[ci] || 0)
    if (domainScore(d, sel) - domainScore(d, minSel) >= OVERPROVISION_MARGIN) overDomains++
  })

  let verdict
  if (failingDomains.some((f) => f.reason === 'posture')) verdict = 'Nonconformant'
  else if (failingDomains.length > 0) verdict = 'Conformant · at risk'
  else verdict = overDomains >= 2 ? 'Over-provisioned' : 'Conformant'

  return { verdict, failingDomains, applicableDomains, marginNotes: { overDomains }, soonestExpiry }
}

// Over-provisioned IS conformant for the rate — a cost finding, not a
// risk finding.
export function conformanceRate(list) {
  let assessed = 0
  let good = 0
  list.forEach((s) => {
    const v = computeConformance(s).verdict
    if (v === 'Not assessed') return
    assessed++
    if (v === 'Conformant' || v === 'Over-provisioned') good++
  })
  return assessed ? Math.round((good / assessed) * 100) : 0
}
