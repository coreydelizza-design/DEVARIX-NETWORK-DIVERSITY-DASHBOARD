// Evidence provenance and data-age math for the demo portfolio.
// Provenance states describe evidence QUALITY of a fact, in strength
// order: inferred -> declared -> documented -> verified. This is a
// separate axis from the diversity GRADES in lib/schema.js
// (VERIFIED_DIVERSE etc.) — do not conflate the two. Decay is computed
// at render time, never stored.
//
// Functions accept an optional `today` so the real expiry engine can
// reuse them against live dates; the TODAY default keeps demo data
// deterministic.

export const PROVENANCE = ['inferred', 'declared', 'documented', 'verified']

export const TODAY = '2026-07-13'

export function ageInDays(evidenceDate, today = TODAY) {
  const ms = new Date(today) - new Date(evidenceDate)
  return Math.max(0, Math.round(ms / 86400000))
}

// Decay: one state past the validity window, two states past twice the
// window. Floor is `declared` for anything that was ever evidenced;
// `inferred` never decays — it is already the floor.
export function effectiveStatus(fact, today = TODAY) {
  const idx = PROVENANCE.indexOf(fact.status)
  if (idx <= 1) return fact.status
  const age = ageInDays(fact.evidenceDate, today)
  let drop = 0
  if (age > fact.validityDays) drop = 1
  if (age > 2 * fact.validityDays) drop = 2
  return PROVENANCE[Math.max(1, idx - drop)]
}

export function agingBand(fact, today = TODAY) {
  const age = ageInDays(fact.evidenceDate, today)
  if (age > fact.validityDays) return 'expired'
  if (age >= 0.7 * fact.validityDays) return 'aging'
  return 'fresh'
}
