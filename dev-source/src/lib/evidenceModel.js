// The unified evidence model — the single source of truth for what a
// graded pair-layer stores: outcome (what the evidence says) x
// provenance (how good the evidence is). The four legacy grades are
// DERIVED display labels, never stored values or conditionals. Decay
// degrades provenance, never outcome.
//
// Records keep the store's existing field names (evidence_ref,
// confidence_note, verified_date) so migration is lossless.

import { PROVENANCE, effectiveStatus } from './provenance'

export { PROVENANCE }

export const OUTCOMES = ['diverse', 'shared', 'unknown']

export const OUTCOME_META = {
  diverse: { label: 'Diverse', color: '#0b7261' },
  shared: { label: 'Shared fate', color: '#a83228' },
  unknown: { label: 'Unknown', color: '#6b7280' },
}

export const RECORD_VALIDITY_DAYS = 365

export function makeRecord(outcome, provenance, evidenceRef, confidenceNote) {
  return {
    outcome: OUTCOMES.includes(outcome) ? outcome : 'unknown',
    provenance: PROVENANCE.includes(provenance) ? provenance : 'declared',
    evidence_ref: evidenceRef || '',
    confidence_note: confidenceNote || '',
    verified_date: new Date().toISOString().slice(0, 10),
  }
}

// A stale record degrades provenance over its validity window via the
// same decay math as demo facts; the outcome never changes by itself.
export function effectiveProvenance(record, today) {
  return effectiveStatus(
    { status: record.provenance, evidenceDate: record.verified_date, validityDays: RECORD_VALIDITY_DAYS },
    today
  )
}

// Derived legacy labels:
//   diverse x verified                      -> VERIFIED_DIVERSE
//   diverse x (declared|documented|inferred) -> CLAIMED_UNVERIFIED
//   shared  x (verified|documented)          -> SHARED_FATE_CONFIRMED
//   shared  x (declared|inferred)            -> SHARED_FATE_CONFIRMED, suspected
//   unknown x anything                       -> UNKNOWN
export function legacyGrade(record) {
  const p = effectiveProvenance(record)
  if (record.outcome === 'unknown') return { grade: 'UNKNOWN', suspected: false }
  if (record.outcome === 'diverse') {
    return { grade: p === 'verified' ? 'VERIFIED_DIVERSE' : 'CLAIMED_UNVERIFIED', suspected: false }
  }
  return { grade: 'SHARED_FATE_CONFIRMED', suspected: p !== 'verified' && p !== 'documented' }
}

export const LEGACY_GRADES = {
  VERIFIED_DIVERSE: { label: 'Verified diverse', pill: 'pill-teal' },
  CLAIMED_UNVERIFIED: { label: 'Claimed, unverified', pill: 'pill-amber' },
  UNKNOWN: { label: 'Unknown', pill: 'pill-gray' },
  SHARED_FATE_CONFIRMED: { label: 'Shared fate confirmed', pill: 'pill-red' },
}

export const LEGACY_ORDER = ['VERIFIED_DIVERSE', 'CLAIMED_UNVERIFIED', 'UNKNOWN', 'SHARED_FATE_CONFIRMED']

// Composite points on the 0-2 scale (raw in math, rounded for display):
// diverse x verified 2 · diverse x documented 1.5 · diverse x declared
// or inferred 1 · unknown 0.5 · shared 0.
export function recordPoints(record) {
  if (record.outcome === 'shared') return 0
  if (record.outcome === 'unknown') return 0.5
  const p = effectiveProvenance(record)
  if (p === 'verified') return 2
  if (p === 'documented') return 1.5
  return 1
}

// Store migration (v1 -> v2): stored four-grade fields become
// outcome x provenance pairs by the inverse of the derivation table.
export function upgradeRecord(g) {
  if (!g || g.outcome) return g
  const map = {
    VERIFIED_DIVERSE: { outcome: 'diverse', provenance: 'verified' },
    CLAIMED_UNVERIFIED: { outcome: 'diverse', provenance: 'declared' },
    SHARED_FATE_CONFIRMED: { outcome: 'shared', provenance: 'verified' },
    UNKNOWN: { outcome: 'unknown', provenance: 'declared' },
  }
  const { grade, ...rest } = g
  return { ...rest, ...(map[grade] || map.UNKNOWN) }
}

export function upgradeEngagement(e) {
  return {
    ...e,
    pairs: (e.pairs || []).map((p) => ({
      ...p,
      grades: Object.fromEntries(Object.entries(p.grades || {}).map(([k, g]) => [k, upgradeRecord(g)])),
    })),
  }
}
