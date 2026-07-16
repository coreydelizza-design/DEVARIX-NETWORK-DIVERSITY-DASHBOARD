// localStorage persistence for the DEVARIX data model. One namespaced key,
// synchronous writes, and a subscribe API that plugs into React 18's
// useSyncExternalStore. All mutation goes through update() so every write
// persists and notifies in one place.

import { useSyncExternalStore } from 'react'
import { emptyState, migrate, makeEngagement, makeSite, makeRegistryEntity, makeCarrierRequest, normalizeKey, registryId, uid } from './schema'
import { upgradeEngagement } from './evidenceModel'
import { mintElement, validateFact, makeFact } from './graph'
import { makeSharedFateRelation } from './collisions'

const KEY = 'devarix.audit.v3'
// Older stores are read once, migrated up through schema.js MIGRATIONS,
// and rewritten under the current key — existing engagements load losslessly.
const LEGACY_KEYS = ['devarix.audit.v2', 'devarix.audit.v1']

let state = null
const listeners = new Set()

function read() {
  try {
    let raw = localStorage.getItem(KEY)
    if (!raw) raw = LEGACY_KEYS.map((k) => localStorage.getItem(k)).find(Boolean)
    if (!raw) return emptyState()
    return migrate(JSON.parse(raw))
  } catch {
    return emptyState()
  }
}

export function getState() {
  if (state === null) {
    state = read()
    // Persist immediately so a migrated v1 store lands under the bumped
    // key on first load, not on first mutation.
    try {
      if (!localStorage.getItem(KEY)) localStorage.setItem(KEY, JSON.stringify(state))
    } catch {
      // quota/privacy failure: in-memory state still works
    }
  }
  return state
}

export function update(fn) {
  state = fn(getState())
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    // Quota or privacy-mode failure: state still updates in memory; the
    // Engagements view surfaces persistence status.
  }
  listeners.forEach((l) => l())
}

export function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useStore() {
  return useSyncExternalStore(subscribe, getState)
}

export function activeEngagement(s) {
  const st = s || getState()
  return st.engagements.find((e) => e.id === st.active_engagement_id) || null
}

// --- engagement operations ---

export function createEngagement(name, clientName) {
  const eng = makeEngagement(name, clientName)
  update((s) => ({ ...s, engagements: [...s.engagements, eng], active_engagement_id: eng.id }))
  return eng
}

export function renameEngagement(id, name, clientName) {
  update((s) => ({
    ...s,
    engagements: s.engagements.map((e) =>
      e.id === id ? { ...e, name: name || e.name, client: { ...e.client, name: clientName } } : e
    ),
  }))
}

export function selectEngagement(id) {
  update((s) => ({ ...s, active_engagement_id: id }))
}

// --- registry operations ---

// Idempotent: registry ids are deterministic, so adding an existing
// key returns the canonical entity instead of duplicating it.
export function addRegistryEntity(kind, key, label, meta) {
  const existing = getState().registry[kind].find((e) => e.id === registryId(kind, key))
  if (existing) return existing
  const entity = makeRegistryEntity(kind, key, label, meta)
  update((s) => ({ ...s, registry: { ...s.registry, [kind]: [...s.registry[kind], entity] } }))
  return entity
}

export function registryEntity(kind, id) {
  return getState().registry[kind].find((e) => e.id === id) || null
}

// --- site & circuit operations (active engagement) ---

function withActiveEngagement(s, fn) {
  return { ...s, engagements: s.engagements.map((e) => (e.id === s.active_engagement_id ? fn(e) : e)) }
}

export function addSite(name, address, coords) {
  const site = makeSite(name, address, coords)
  update((s) => withActiveEngagement(s, (e) => ({ ...e, sites: [...e.sites, site] })))
  return site
}

export function updateSite(siteId, fields) {
  update((s) =>
    withActiveEngagement(s, (e) => ({
      ...e,
      sites: e.sites.map((x) => (x.id === siteId ? { ...x, ...fields } : x)),
    }))
  )
}

export function saveCircuit(circuit) {
  update((s) =>
    withActiveEngagement(s, (e) => {
      const exists = e.circuits.some((c) => c.id === circuit.id)
      return {
        ...e,
        circuits: exists ? e.circuits.map((c) => (c.id === circuit.id ? circuit : c)) : [...e.circuits, circuit],
      }
    })
  )
}

// --- engagement workflow: documents & carrier records requests ---
// Older stored engagements may lack documents/requests; every operation
// defaults them so pre-feature data keeps working.

function today() {
  return new Date().toISOString().slice(0, 10)
}

export function setEngagementDoc(docId, status) {
  update((s) =>
    withActiveEngagement(s, (e) => ({
      ...e,
      documents: { ...(e.documents || {}), [docId]: { status, date: today() } },
    }))
  )
}

export function addCarrierRequest(carrierRef) {
  update((s) =>
    withActiveEngagement(s, (e) => {
      const requests = e.requests || []
      if (requests.some((r) => r.carrier_ref === carrierRef)) return { ...e, requests }
      return { ...e, requests: [...requests, makeCarrierRequest(carrierRef)] }
    })
  )
}

export function setRequestItem(requestId, itemId, status) {
  update((s) =>
    withActiveEngagement(s, (e) => ({
      ...e,
      requests: (e.requests || []).map((r) => {
        if (r.id !== requestId) return r
        const item = r.items[itemId]
        const patch = { status }
        if (status === 'requested' && !item.requested_date) patch.requested_date = today()
        if (status === 'received') patch.received_date = today()
        return { ...r, items: { ...r.items, [itemId]: { ...item, ...patch } } }
      }),
    }))
  )
}

export function savePair(pair) {
  update((s) =>
    withActiveEngagement(s, (e) => {
      const exists = e.pairs.some((p) => p.id === pair.id)
      return { ...e, pairs: exists ? e.pairs.map((p) => (p.id === pair.id ? pair : p)) : [...e.pairs, pair] }
    })
  )
}

// --- element graph write API (spine §3) ---

// The sample engagement is read-only; graph mutations refuse to touch it.
export function isSampleActive(s) {
  const e = activeEngagement(s || getState())
  return !!(e && e.sample)
}

// Mint or match an element into the registry namespace by canonical key.
// Free-text creation is forbidden — returns {ok:false} with a reason.
export function graphMintElement(typeId, rawValue, label) {
  const r = mintElement(getState().registry.elements || {}, typeId, rawValue, label)
  if (r.ok && !r.existed) {
    update((s) => ({ ...s, registry: { ...s.registry, elements: { ...(s.registry.elements || {}), [r.id]: r.element } } }))
  }
  return r
}

export function graphAddService(siteId, name) {
  const svc = { id: uid('svc'), site_id: siteId, name: name || 'Service' }
  update((s) => withActiveEngagement(s, (e) => ({ ...e, services: [...(e.services || []), svc] })))
  return svc
}

export function graphAddEdge(from, to, kind) {
  const edge = { id: uid('edge'), kind: kind || 'traverses', from, to }
  update((s) => withActiveEngagement(s, (e) => {
    const dup = (e.edges || []).some((x) => x.kind === edge.kind && x.from === from && x.to === to)
    return dup ? e : { ...e, edges: [...(e.edges || []), edge] }
  }))
  return edge
}

// Capture a fact — no naked facts. Throws with the validation reason when
// source / provenance / date are missing, so the caller surfaces it.
export function captureFact(subjectType, subjectId, dimension, payload) {
  const fact = makeFact(uid('fact'), subjectType, subjectId, dimension, payload)
  const err = validateFact(fact)
  if (err) throw new Error(err)
  update((s) => withActiveEngagement(s, (e) => ({ ...e, facts: [...(e.facts || []), fact] })))
  return fact
}

export function adjudicateFact(factId, adjudication) {
  update((s) => withActiveEngagement(s, (e) => ({
    ...e,
    facts: (e.facts || []).map((f) => (f.id === factId ? { ...f, adjudication } : f)),
  })))
}

// Accept a collision finding: write the confirmed shared-fate relation to
// the registry — the compounding cross-engagement asset.
export function acceptCollision(finding, evidenceRef, date) {
  const eng = activeEngagement(getState())
  if (!eng) return null
  const rel = makeSharedFateRelation(finding, evidenceRef, eng.id, date || new Date().toISOString().slice(0, 10))
  update((s) => ({ ...s, registry: { ...s.registry, sharedFate: [...(s.registry.sharedFate || []), rel] } }))
  return rel
}

// --- export / import ---

// Full-engagement export: the engagement plus the entire registry, so the
// file is self-contained and re-importable into an empty browser.
export function exportEngagement(id) {
  const s = getState()
  const engagement = s.engagements.find((e) => e.id === id)
  if (!engagement) return null
  return JSON.stringify(
    { type: 'devarix-engagement', schema_version: s.schema_version, registry: s.registry, engagement },
    null,
    2
  )
}

// Registry-only export: the cross-engagement carry-forward. Canonical
// entities, no client data, no grades.
export function exportRegistry() {
  const s = getState()
  return JSON.stringify({ type: 'devarix-registry', schema_version: s.schema_version, registry: s.registry }, null, 2)
}

export function importEngagement(json) {
  const doc = migrate(JSON.parse(json))
  // migrate() returns emptyState() for foreign shapes; re-validate type on
  // the raw parse so a wrong file gives a clear error, not silent data.
  const raw = JSON.parse(json)
  if (raw.type !== 'devarix-engagement' || !raw.engagement) throw new Error('not a DEVARIX engagement file')
  // Exports written before the unified evidence model upgrade in place.
  const engagement = upgradeEngagement(raw.engagement)
  update((s) => {
    const registry = mergeRegistry(s.registry, raw.registry)
    const exists = s.engagements.some((e) => e.id === engagement.id)
    const next = exists ? { ...engagement, id: uid('eng'), name: `${engagement.name} (imported)` } : engagement
    return { ...s, schema_version: doc.schema_version, registry, engagements: [...s.engagements, next], active_engagement_id: next.id }
  })
}

// Registry ids are deterministic (kind:KEY), so merging is set-union by
// id — an imported entity that already exists is simply kept once.
function mergeRegistry(base, incoming) {
  if (!incoming) return base
  const merged = { ...base }
  Object.keys(base).forEach((kind) => {
    const seen = new Set(base[kind].map((e) => e.id))
    const extra = (incoming[kind] || []).filter((e) => e && e.id && !seen.has(e.id) && normalizeKey(e.key))
    if (extra.length) merged[kind] = [...base[kind], ...extra]
  })
  return merged
}

export function registryCount(s) {
  const st = s || getState()
  return Object.values(st.registry).reduce((n, arr) => n + arr.length, 0)
}
