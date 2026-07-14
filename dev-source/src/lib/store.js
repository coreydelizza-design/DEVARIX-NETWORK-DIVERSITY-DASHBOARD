// localStorage persistence for the DEVARIX data model. One namespaced key,
// synchronous writes, and a subscribe API that plugs into React 18's
// useSyncExternalStore. All mutation goes through update() so every write
// persists and notifies in one place.

import { useSyncExternalStore } from 'react'
import { emptyState, migrate, makeEngagement, makeSite, makeRegistryEntity, normalizeKey, registryId, uid } from './schema'

const KEY = 'devarix.audit.v1'

let state = null
const listeners = new Set()

function read() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return emptyState()
    return migrate(JSON.parse(raw))
  } catch {
    return emptyState()
  }
}

export function getState() {
  if (state === null) state = read()
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

export function savePair(pair) {
  update((s) =>
    withActiveEngagement(s, (e) => {
      const exists = e.pairs.some((p) => p.id === pair.id)
      return { ...e, pairs: exists ? e.pairs.map((p) => (p.id === pair.id ? pair : p)) : [...e.pairs, pair] }
    })
  )
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
  const engagement = raw.engagement
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
