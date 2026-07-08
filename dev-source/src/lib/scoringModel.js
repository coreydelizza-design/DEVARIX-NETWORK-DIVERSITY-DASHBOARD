// Diversity scoring model.
// Each criterion option = [label, points (0-2), riskFlag or null].
// Domain score = points / max * 100. Composite = weighted sum of domain scores.

export const model = [
  {
    name: 'Local loop / last mile', weight: 25, criteria: [
      { label: 'Access carrier', opts: [
        ['Same carrier both circuits', 0, 'Both circuits ride one access carrier'],
        ['Different carriers, unvalidated', 1, null],
        ['Different carriers, validated diverse', 2, null],
      ]},
      { label: 'Physical path and conduit', opts: [
        ['Same conduit or entrance', 0, 'Circuits share conduit or building entrance'],
        ['Path unknown', 1, 'Local loop physical path has not been validated'],
        ['Validated diverse paths', 2, null],
      ]},
      { label: 'Access technology', opts: [
        ['Same technology', 1, null],
        ['Mixed media (fiber + wireless)', 2, null],
      ]},
    ],
  },
  {
    name: 'Serving wire center', weight: 10, criteria: [
      { label: 'Wire center / CO', opts: [
        ['Same wire center', 0, 'Both loops home to the same serving wire center'],
        ['Unknown', 1, 'Serving wire centers have not been identified'],
        ['Different wire centers', 2, null],
      ]},
    ],
  },
  {
    name: 'Data center facility', weight: 15, criteria: [
      { label: 'Building entrances', opts: [
        ['Single entrance facility', 0, 'One entrance facility serves all circuits'],
        ['Dual diverse entrances', 2, null],
      ]},
      { label: 'Power feeds', opts: [
        ['Single feed', 0, 'Facility power lacks A+B feed separation'],
        ['A+B diverse feeds', 2, null],
      ]},
      { label: 'Meet-me room', opts: [
        ['Same MMR', 1, null],
        ['Separate MMRs', 2, null],
      ]},
    ],
  },
  {
    name: 'Edge routers / hardware', weight: 15, criteria: [
      { label: 'Edge router count', opts: [
        ['Single router', 0, 'One edge router is a single point of failure'],
        ['Dual routers', 2, null],
      ]},
      { label: 'Vendor diversity', opts: [
        ['Single vendor', 1, null],
        ['Dual vendor', 2, null],
      ]},
      { label: 'Power and line cards', opts: [
        ['Shared power / cards', 0, 'Redundant routers share power or line cards'],
        ['Fully diverse', 2, null],
      ]},
    ],
  },
  {
    name: 'Backbone / transport', weight: 20, criteria: [
      { label: 'Backbone provider', opts: [
        ['Same provider backbone', 0, 'Both circuits converge on one provider backbone'],
        ['Different providers', 2, null],
      ]},
      { label: 'NNI diversity', opts: [
        ['Single NNI', 0, 'Traffic funnels through a single NNI'],
        ['Unknown', 1, 'NNI handoff points have not been mapped'],
        ['Diverse NNIs', 2, null],
      ]},
      { label: 'Long-haul route', opts: [
        ['Route unknown', 1, 'Long-haul fiber routes have not been validated'],
        ['Validated diverse routes', 2, null],
      ]},
    ],
  },
  {
    name: 'Cloud connectivity', weight: 15, criteria: [
      { label: 'Cloud on-ramps', opts: [
        ['Single on-ramp', 0, 'Cloud access depends on one on-ramp location'],
        ['Dual on-ramps', 2, null],
      ]},
      { label: 'Cloud regions', opts: [
        ['Single region', 1, null],
        ['Multi-region', 2, null],
      ]},
      { label: 'Connection method', opts: [
        ['Internet only', 0, 'No private path to cloud workloads'],
        ['Internet + direct connect', 1, null],
        ['Dual direct connects', 2, null],
      ]},
    ],
  },
]

export function gradeOf(score) {
  if (score >= 85) return 'res'
  if (score >= 65) return 'part'
  if (score >= 40) return 'exp'
  return 'crit'
}

export const gradeMeta = {
  res: { label: 'Resilient', color: '#0b7261', pill: 'pill-teal' },
  part: { label: 'Partially diverse', color: '#2a5fa8', pill: 'pill-blue' },
  exp: { label: 'Exposed', color: '#c07f16', pill: 'pill-amber' },
  crit: { label: 'Critical', color: '#a83228', pill: 'pill-red' },
}

export function barColor(score) {
  if (score >= 85) return '#0b7261'
  if (score >= 50) return '#c07f16'
  return '#a83228'
}

// selections: array (per domain) of arrays (per criterion) of option indices
export function computeScore(selections) {
  let composite = 0
  const flags = []
  const domainScores = model.map((d, di) => {
    let pts = 0
    let max = 0
    d.criteria.forEach((c, ci) => {
      const opt = c.opts[selections[di][ci]]
      pts += opt[1]
      max += 2
      if (opt[2]) flags.push({ domain: d.name, text: opt[2] })
    })
    const score = Math.round((pts / max) * 100)
    composite += (score * d.weight) / 100
    return score
  })
  return { composite: Math.round(composite), domainScores, flags }
}

export function defaultSelections() {
  return model.map((d) => d.criteria.map(() => 0))
}
