// Versioned data model for real engagement data. Two namespaces live in
// one store: the REGISTRY (engagement-independent canonical entities that
// accumulate across audits) and ENGAGEMENTS (client-scoped sites, circuits,
// pairs, grades, and evidence). Engagement records reference registry
// entities by id, never by free-text string — normalization is what makes
// cross-examination checks and the shared-fate registry work.
//
// Registry ids are deterministic (kind:KEY) so seeds regenerate
// identically, imports merge by identity, and references never dangle
// across an export/import cycle.

import { clliTable } from './circuitParser'

export { transportMediums, serviceTypes } from './transportMediums'

export const SCHEMA_VERSION = 1

// The seven infrastructure layers every circuit pair is graded on.
export const LAYERS = [
  { id: 'identity', label: 'Identity' },
  { id: 'entrance', label: 'Building entrance' },
  { id: 'loop', label: 'Local loop' },
  { id: 'nni', label: 'NNI' },
  { id: 'route', label: 'Route' },
  { id: 'pop', label: 'POP / node' },
  { id: 'logical', label: 'Logical' },
]

// The four evidence grades. A grade without an evidence_ref is an
// attestation, not a finding — enforcement lives in the grading UI.
export const GRADES = {
  VERIFIED_DIVERSE: { label: 'Verified diverse', pill: 'pill-teal' },
  CLAIMED_UNVERIFIED: { label: 'Claimed, unverified', pill: 'pill-amber' },
  UNKNOWN: { label: 'Unknown', pill: 'pill-gray' },
  SHARED_FATE_CONFIRMED: { label: 'Shared fate confirmed', pill: 'pill-red' },
}

// Canonical entity kinds in the registry namespace.
export const REGISTRY_KINDS = ['clli', 'asn', 'carrier', 'accessVendor', 'nniId', 'routeSegment', 'pop']

export function normalizeKey(s) {
  return String(s || '').trim().toUpperCase().replace(/\s+/g, ' ')
}

export function registryId(kind, key) {
  return `${kind}:${normalizeKey(key)}`
}

export function makeRegistryEntity(kind, key, label, meta) {
  return { id: registryId(kind, key), kind, key: normalizeKey(key), label: label || key, meta: meta || {} }
}

let counter = 0
export function uid(prefix) {
  counter += 1
  return `${prefix}-${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

export function makeEngagement(name, clientName) {
  return {
    id: uid('eng'),
    name: name || 'Untitled engagement',
    client: { name: clientName || '' },
    created_date: new Date().toISOString().slice(0, 10),
    sites: [],
    circuits: [],
    pairs: [],
  }
}

export function makeSite(name, address, coords) {
  return { id: uid('site'), name: name || '', address: address || '', coords: coords || '' }
}

// Circuit layer fields are defined by the intake feature; the factory
// guarantees every circuit carries all seven layers, each with its own
// evidence_source, so intake and grading never null-check layer shape.
export function makeCircuit(siteId) {
  const layers = {}
  LAYERS.forEach((l) => {
    layers[l.id] = { evidence_source: '' }
  })
  return { id: uid('ckt'), site_id: siteId, layers }
}

export function makePair(siteId, circuitAId, circuitBId) {
  return { id: uid('pair'), site_id: siteId, circuit_a_id: circuitAId, circuit_b_id: circuitBId, grades: {} }
}

export function makeGrade(grade, evidenceRef, confidenceNote) {
  return {
    grade: GRADES[grade] ? grade : 'UNKNOWN',
    evidence_ref: evidenceRef || '',
    confidence_note: confidenceNote || '',
    verified_date: new Date().toISOString().slice(0, 10),
  }
}

// Starter canonical tables. Carriers are backbone/service providers;
// access vendors are the last-mile owners (ILECs, cable MSOs, altnets)
// that Type II circuits actually ride. Both grow via intake.
const SEED_CARRIERS = [
  'Lumen', 'AT&T', 'Verizon', 'Zayo', 'GTT', 'Colt', 'Orange Business',
  'NTT', 'Arelion', 'Tata Communications', 'PCCW Global', 'Cogent',
  'Telstra International', 'BT', 'Vodafone', 'T-Systems', 'Sparkle',
  'Telia', 'Comcast Business', 'Charter / Spectrum Enterprise', 'Cox Business',
  'Windstream', 'Frontier', 'Crown Castle', 'euNetworks', 'Exa Infrastructure',
]

const SEED_ACCESS_VENDORS = [
  'AT&T', 'Verizon', 'Lumen', 'Frontier', 'Windstream', 'Ziply Fiber',
  'Consolidated Communications', 'Brightspeed', 'Comcast', 'Charter',
  'Cox', 'Altice / Optimum', 'TDS Telecom', 'BT Openreach',
  'Deutsche Telekom', 'Orange', 'Telefonica', 'KPN', 'Telmex', 'NTT East/West',
]

export function emptyState() {
  const registry = {}
  REGISTRY_KINDS.forEach((k) => {
    registry[k] = []
  })
  SEED_CARRIERS.forEach((n) => registry.carrier.push(makeRegistryEntity('carrier', n, n)))
  SEED_ACCESS_VENDORS.forEach((n) => registry.accessVendor.push(makeRegistryEntity('accessVendor', n, n)))
  Object.entries(clliTable).forEach(([code, place]) =>
    registry.clli.push(makeRegistryEntity('clli', code, `${code} · ${place}`, { place }))
  )
  return { schema_version: SCHEMA_VERSION, registry, engagements: [], active_engagement_id: null }
}

// MIGRATIONS[n] upgrades a version-n state to version n+1. Add a function
// here whenever SCHEMA_VERSION is bumped; stored data then upgrades
// stepwise on next load instead of being discarded.
const MIGRATIONS = {}

export function migrate(state) {
  if (!state || typeof state !== 'object' || typeof state.schema_version !== 'number') return emptyState()
  let s = state
  while (s.schema_version < SCHEMA_VERSION) {
    const step = MIGRATIONS[s.schema_version]
    if (!step) return emptyState()
    s = { ...step(s), schema_version: s.schema_version + 1 }
  }
  return s
}
