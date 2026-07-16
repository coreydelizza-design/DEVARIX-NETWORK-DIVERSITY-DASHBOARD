// The element graph API (spine §3). Pure functions over plain graph
// objects; the store supplies ids and persistence. Elements are
// registry entities (engagement-independent, deduped by canonical key);
// services/edges/facts are engagement-scoped. Free-text element creation
// is forbidden and facts are never naked (source + provenance + date).

import { TYPE_BY_ID, canonicalKeyFor } from './elementTypes'
import { OUTCOMES, PROVENANCE } from './evidenceModel'

export { OUTCOMES, PROVENANCE }

export const EDGE_KINDS = ['traverses', 'within', 'risk_group']

// Missing is a captured state (spine §2.4): unknown always carries a reason.
export const MISSING_REASONS = {
  not_requested: 'Not yet requested',
  requested_pending: 'Requested — pending',
  carrier_declined: 'Carrier declined / unable',
  not_applicable: 'Not applicable',
  client_cannot_say: 'Client cannot say',
}

// The engagement's evidence inventory kinds a source may point into.
export const SOURCE_KINDS = {
  carrier_response: 'Carrier response',
  document_ref: 'Document reference',
  interview: 'Interview',
  observation: 'Network observation',
  client_declaration: 'Client declaration',
}

// --- elements ---

// Mint or match an element by canonical key. Returns {ok:false} when the
// value cannot produce a canonical key — enforcing the no-free-text rule.
export function mintElement(elements, typeId, rawValue, label) {
  const t = TYPE_BY_ID[typeId]
  if (!t) return { ok: false, reason: `unknown element type ${typeId}` }
  if (t.captureMode !== 'element') return { ok: false, reason: `${typeId} is captured as ${t.captureMode}, not a graph element` }
  const id = canonicalKeyFor(typeId, rawValue)
  if (!id) return { ok: false, reason: 'no canonical key — free-text element creation is forbidden' }
  if (elements[id]) return { ok: true, id, element: elements[id], existed: true }
  const element = {
    id,
    typeId,
    layer: t.layer,
    ring: t.ring,
    key: id.slice(typeId.length + 1),
    label: label || `${t.name} · ${rawValue}`,
    promoted: false,
  }
  return { ok: true, id, element, existed: false }
}

// Promotion on collision: a note/attribute value becomes a full element
// the moment two paths reference it. Same canonical-key discipline.
export function promoteToElement(elements, typeId, rawValue, label) {
  const r = mintElement(elements, typeId, rawValue, label)
  if (r.ok && !r.existed) r.element.promoted = true
  return r
}

// --- facts (no naked facts) ---

export function validateFact(f) {
  if (!f || typeof f !== 'object') return 'fact required'
  if (!f.sourceRef) return 'source required (link to the engagement evidence inventory)'
  if (!PROVENANCE.includes(f.provenance)) return 'provenance grade required'
  if (!f.capturedDate) return 'captured date required'
  if (f.outcome && !OUTCOMES.includes(f.outcome)) return `invalid outcome ${f.outcome}`
  if ((f.value === undefined || f.value === null || f.value === '') && !f.missingReason) return 'value or missingReason required'
  if (f.missingReason && !MISSING_REASONS[f.missingReason]) return `invalid missingReason ${f.missingReason}`
  return null
}

// Fact factory. id is assigned by the caller (store uid / deterministic
// seeder). Shape = spine fact anatomy.
export function makeFact(id, subjectType, subjectId, dimension, payload) {
  return {
    id,
    subjectType, // 'element' | 'edge' | 'service'
    subjectId,
    dimension,
    value: payload.value !== undefined ? payload.value : null,
    outcome: payload.outcome || null,
    provenance: payload.provenance,
    sourceRef: payload.sourceRef || null,
    capturedDate: payload.capturedDate,
    validityDays: payload.validityDays != null ? payload.validityDays : 365,
    missingReason: payload.missingReason || null,
    conflictState: payload.conflictState || null,
    adjudication: payload.adjudication || null,
  }
}

// --- queries ---

export function elementsForService(engagement, serviceId) {
  return engagement.edges
    .filter((e) => e.kind === 'traverses' && e.from === serviceId)
    .map((e) => e.to)
}

export function servicesTraversing(engagement, elementId) {
  return [...new Set(engagement.edges.filter((e) => e.kind === 'traverses' && e.to === elementId).map((e) => e.from))]
}

export function factsFor(engagement, subjectType, subjectId) {
  return (engagement.facts || []).filter((f) => f.subjectType === subjectType && f.subjectId === subjectId)
}

export function servicesForSite(engagement, siteId) {
  return (engagement.services || []).filter((s) => s.site_id === siteId)
}

// Element lookup resolving the engagement's edges against the registry.
export function elementRecord(registry, elementId) {
  return (registry.elements || {})[elementId] || null
}
