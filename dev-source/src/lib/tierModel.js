// Resilience tiers and the conformance requirement matrix. The rubric is
// data: for each tier, for each of the six scoring domains, the minimum
// posture (expressed against existing criteria option indices), the
// required evidence provenance, and a freshness window. N/A domains drop
// out of conformance math entirely. The raw diversity score is the
// measurement; the verdict (computed in conformance.js) is the judgment.

export const TIERS = ['T1', 'T2', 'T3', 'T4']

export const TIER_META = {
  T1: { name: 'Mission-critical', blurb: 'Loss halts revenue or safety-critical operations' },
  T2: { name: 'Important', blurb: 'Loss degrades operations within a business day' },
  T3: { name: 'Standard', blurb: 'Loss tolerable for a day with workarounds' },
  T4: { name: 'Best effort', blurb: 'Connectivity convenience; no hard recovery target' },
}

// Domain order matches scoringModel.model. minPosture: minimum option
// index per criterion (0 = no requirement). anyOf: alternative minima —
// posture passes when minPosture is met AND any one alternative is met.
// Access-technology criteria carry no minimum: their option order is not
// monotonic. Not-applicable domains carry only { applicable: false }.
export const REQUIREMENTS = {
  T1: [
    { applicable: true, minPosture: [2, 2, 0], anyOf: null, requiredProvenance: 'verified', freshnessDays: 365 },
    { applicable: true, minPosture: [2], anyOf: null, requiredProvenance: 'verified', freshnessDays: 365 },
    { applicable: true, minPosture: [1, 1, 1], anyOf: null, requiredProvenance: 'verified', freshnessDays: 365 },
    { applicable: true, minPosture: [1, 0, 1], anyOf: null, requiredProvenance: 'verified', freshnessDays: 365 },
    { applicable: true, minPosture: [1, 2, 1], anyOf: null, requiredProvenance: 'verified', freshnessDays: 365 },
    { applicable: true, minPosture: [1, 0, 2], anyOf: null, requiredProvenance: 'verified', freshnessDays: 365 },
  ],
  T2: [
    { applicable: true, minPosture: [1, 2, 0], anyOf: null, requiredProvenance: 'documented', freshnessDays: 548 },
    { applicable: true, minPosture: [2], anyOf: null, requiredProvenance: 'documented', freshnessDays: 548 },
    { applicable: true, minPosture: [0, 0, 0], anyOf: [[1, 0, 0], [0, 1, 0]], requiredProvenance: 'documented', freshnessDays: 548 },
    { applicable: true, minPosture: [1, 0, 0], anyOf: null, requiredProvenance: 'documented', freshnessDays: 548 },
    { applicable: true, minPosture: [0, 0, 0], anyOf: [[1, 0, 0], [0, 2, 0]], requiredProvenance: 'documented', freshnessDays: 548 },
    { applicable: true, minPosture: [0, 0, 0], anyOf: [[1, 0, 0], [0, 1, 0]], requiredProvenance: 'documented', freshnessDays: 548 },
  ],
  T3: [
    { applicable: true, minPosture: [0, 0, 0], anyOf: null, requiredProvenance: 'declared', freshnessDays: 730 },
    { applicable: false },
    { applicable: false },
    { applicable: true, minPosture: [0, 0, 0], anyOf: null, requiredProvenance: 'declared', freshnessDays: 730 },
    { applicable: false },
    { applicable: true, minPosture: [0, 0, 0], anyOf: null, requiredProvenance: 'declared', freshnessDays: 730 },
  ],
  T4: [
    { applicable: true, minPosture: [0, 0, 0], anyOf: null, requiredProvenance: 'declared', freshnessDays: 1095 },
    { applicable: false },
    { applicable: false },
    { applicable: false },
    { applicable: false },
    { applicable: false },
  ],
}

// A site is Over-provisioned when Conformant AND its domain posture score
// exceeds the tier's minimum-posture-equivalent score by this margin in
// 2+ applicable domains. A cost finding, not a risk finding.
export const OVERPROVISION_MARGIN = 40

// Evidence facts map to scoring domains by label.
export const FACT_DOMAINS = {
  'Access carrier separation': 'Local loop / last mile',
  'Local loop conduit path': 'Local loop / last mile',
  'Serving wire center assignment': 'Serving wire center',
  'Entrance facility separation': 'Data center facility',
  'A+B power feed separation': 'Data center facility',
  'Edge router redundancy': 'Edge routers / hardware',
  'Backbone provider separation': 'Backbone / transport',
  'NNI handoff mapping': 'Backbone / transport',
  'Long-haul route KMZ': 'Backbone / transport',
  'Cloud on-ramp redundancy': 'Cloud connectivity',
}

// Declared criticality inputs contradicting the assigned tier flag the
// site for tier review. Computed at render time, never stored.
export function tierMisassigned(site) {
  const t = site.tierAssignment && site.tierAssignment.tier
  if (t !== 'T3' && t !== 'T4') return false
  return site.revenuePerHourUSD >= 100000 || site.rtoHours <= 4
}
