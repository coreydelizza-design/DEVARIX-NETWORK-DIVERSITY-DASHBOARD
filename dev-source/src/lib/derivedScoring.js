// Derived scoring: the composite score is a VIEW over the four-grade
// evidence model — grades are the primary data, the number is
// presentation. Grade points sit on the existing 0-2 criterion scale
// and grade bands reuse gradeOf from the demo scoring model, so
// Resilient / Partially diverse / Exposed / Critical mean the same
// thing everywhere.
//
// Layer weights carry the demo model's domain emphasis onto the seven
// audit layers. An ungraded layer scores like UNKNOWN (0.5) — absence
// of evidence is not evidence of diversity — and evidence coverage is
// reported alongside the score so a high score with low coverage is
// visibly weak. The NNI layer only applies when both circuits are
// Type II; weights renormalize when it is excluded.

import { LAYERS } from './schema'
import { gradeOf } from './scoringModel'
import { recordPoints } from './evidenceModel'

export const LAYER_WEIGHTS = {
  identity: 5,
  entrance: 15,
  loop: 25,
  nni: 10,
  route: 20,
  pop: 15,
  logical: 10,
}

export function computeDerivedScore(pair, circuits) {
  const a = circuits.find((c) => c.id === pair.circuit_a_id)
  const b = circuits.find((c) => c.id === pair.circuit_b_id)
  const bothType2 = !!(a && b && a.layers.loop.access_type === 'type2' && b.layers.loop.access_type === 'type2')
  const applicable = LAYERS.filter((l) => l.id !== 'nni' || bothType2)
  const weightTotal = applicable.reduce((n, l) => n + LAYER_WEIGHTS[l.id], 0)

  let composite = 0
  let graded = 0
  const layers = applicable.map((l) => {
    const g = pair.grades[l.id]
    const points = g ? recordPoints(g) : 0.5
    if (g) graded++
    composite += (points / 2) * (LAYER_WEIGHTS[l.id] / weightTotal) * 100
    return {
      id: l.id,
      label: l.label,
      record: g || null,
      points,
      weight: LAYER_WEIGHTS[l.id],
      evidence_ref: g ? g.evidence_ref : '',
      verified_date: g ? g.verified_date : null,
    }
  })

  const withEvidence = layers.filter((l) => l.evidence_ref).length
  const rounded = Math.round(composite)
  return {
    composite: rounded,
    grade: gradeOf(rounded),
    layers,
    graded,
    applicable: applicable.length,
    coverage: Math.round((withEvidence / applicable.length) * 100),
    sharedFate: layers.filter((l) => l.record && l.record.outcome === 'shared').length,
  }
}
