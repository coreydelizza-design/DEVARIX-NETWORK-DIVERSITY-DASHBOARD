// The element-type catalog (spine §3) — data, not code paths. Each type
// declares its layer, ontology ring, capture mode, canonical-key kind,
// the shared-fate dimensions a collision compares on, and an optional
// promotion rule. The core ring is seeded fully (drives scoring); the
// extended and adjacent rings are catalog stubs (captured only when
// evidence surfaces, a tier requires them, or a collision promotes a
// note/attribute into an element).
//
// Capture modes: element (graph node with canonical key) · attribute
// (field on a parent element) · flag (Y/N checklist item on a parent) ·
// note (adjacent-ring, free text; promotable on collision).

export const RINGS = ['core', 'extended', 'adjacent']
export const LAYERS = ['L1', 'L2', 'L3', 'adjacent']
export const CAPTURE_MODES = ['element', 'attribute', 'flag', 'note']

// Canonical-key kinds and their normalizers. Free-text element creation
// is forbidden: minting an element requires one of these keys.
export const CANONICAL_KINDS = {
  clli: (v) => String(v || '').trim().toUpperCase(),
  asn: (v) => String(v || '').trim().toUpperCase().replace(/^AS/, ''),
  address: (v) => String(v || '').trim().toUpperCase().replace(/\s+/g, ' '),
  addressFloor: (v) => String(v || '').trim().toUpperCase().replace(/\s+/g, ' '),
  nniId: (v) => String(v || '').trim().toUpperCase(),
  vendor: (v) => String(v || '').trim().toUpperCase().replace(/\s+/g, ' '),
  routeId: (v) => String(v || '').trim().toUpperCase(),
  facilityId: (v) => String(v || '').trim().toUpperCase().replace(/\s+/g, ' '),
}

// id, name, layer, ring, captureMode, canonicalKey?, sharedFateDimensions[], promotionRule?
const CORE = [
  // --- L1 physical ---
  { id: 'entrance_facility', name: 'Entrance facility / vault', layer: 'L1', ring: 'core', captureMode: 'element', canonicalKey: 'addressFloor', sharedFateDimensions: ['building', 'entrance'] },
  { id: 'conduit', name: 'Conduit segment', layer: 'L1', ring: 'core', captureMode: 'element', canonicalKey: 'facilityId', sharedFateDimensions: ['conduit_corridor'], promotionRule: 'promote note/attribute to element when two paths cite the same conduit id' },
  { id: 'riser', name: 'Building riser', layer: 'L1', ring: 'core', captureMode: 'element', canonicalKey: 'facilityId', sharedFateDimensions: ['building', 'riser'] },
  { id: 'wire_center', name: 'Serving wire center (CLLI)', layer: 'L1', ring: 'core', captureMode: 'element', canonicalKey: 'clli', sharedFateDimensions: ['wire_center'] },
  { id: 'pop_hotel', name: 'Carrier PoP / hotel', layer: 'L1', ring: 'core', captureMode: 'element', canonicalKey: 'addressFloor', sharedFateDimensions: ['building', 'floor'] },
  { id: 'fiber_route', name: 'Fiber route segment (KMZ)', layer: 'L1', ring: 'core', captureMode: 'element', canonicalKey: 'routeId', sharedFateDimensions: ['route_corridor'], promotionRule: 'promote a named splice enclosure / manhole to element when two routes reference it' },
  { id: 'colo_facility', name: 'Colo / data center facility', layer: 'L1', ring: 'core', captureMode: 'element', canonicalKey: 'addressFloor', sharedFateDimensions: ['building'] },
  { id: 'power_feed_a', name: 'Power feed A', layer: 'L1', ring: 'core', captureMode: 'flag', sharedFateDimensions: ['power_domain'] },
  { id: 'power_feed_b', name: 'Power feed B', layer: 'L1', ring: 'core', captureMode: 'flag', sharedFateDimensions: ['power_domain'] },
  { id: 'chassis', name: 'Router / firewall / SD-WAN chassis', layer: 'L1', ring: 'core', captureMode: 'element', canonicalKey: 'facilityId', sharedFateDimensions: ['chassis'] },
  { id: 'ha_required', name: 'HA required', layer: 'L1', ring: 'core', captureMode: 'flag', sharedFateDimensions: [] },
  { id: 'ha_actual', name: 'HA actual', layer: 'L1', ring: 'core', captureMode: 'flag', sharedFateDimensions: [] },
  { id: 'redundant_supervisor', name: 'Redundant supervisor', layer: 'L1', ring: 'core', captureMode: 'flag', sharedFateDimensions: [] },
  // --- L2 transport ---
  { id: 'access_provider', name: 'Access provider', layer: 'L2', ring: 'core', captureMode: 'element', canonicalKey: 'vendor', sharedFateDimensions: ['access_vendor'] },
  { id: 'underlying_provider', name: 'Underlying provider', layer: 'L2', ring: 'core', captureMode: 'element', canonicalKey: 'vendor', sharedFateDimensions: ['access_vendor'] },
  { id: 'access_loop', name: 'Access loop', layer: 'L2', ring: 'core', captureMode: 'element', canonicalKey: 'facilityId', sharedFateDimensions: ['access_loop'] },
  { id: 'nni', name: 'NNI (location CLLI + ID)', layer: 'L2', ring: 'core', captureMode: 'element', canonicalKey: 'nniId', sharedFateDimensions: ['nni', 'wire_center'] },
  { id: 'backbone_span', name: 'Backbone transport span', layer: 'L2', ring: 'core', captureMode: 'element', canonicalKey: 'vendor', sharedFateDimensions: ['backbone'] },
  { id: 'mmr', name: 'MMR cross-connect', layer: 'L2', ring: 'core', captureMode: 'element', canonicalKey: 'addressFloor', sharedFateDimensions: ['building', 'mmr'] },
  // --- L3 network ---
  { id: 'asn', name: 'ASN / egress', layer: 'L3', ring: 'core', captureMode: 'element', canonicalKey: 'asn', sharedFateDimensions: ['asn'] },
  { id: 'transit_gateway', name: 'Transit / egress gateway', layer: 'L3', ring: 'core', captureMode: 'element', canonicalKey: 'facilityId', sharedFateDimensions: ['gateway'] },
  { id: 'cloud_region', name: 'Cloud region / AZ', layer: 'L3', ring: 'core', captureMode: 'element', canonicalKey: 'facilityId', sharedFateDimensions: ['cloud_region'] },
  { id: 'cloud_interconnect_port', name: 'Cloud interconnect port', layer: 'L3', ring: 'core', captureMode: 'element', canonicalKey: 'facilityId', sharedFateDimensions: ['interconnect_port'] },
  { id: 'cloud_interconnect_facility', name: 'Cloud interconnect facility', layer: 'L3', ring: 'core', captureMode: 'element', canonicalKey: 'addressFloor', sharedFateDimensions: ['building'] },
]

// Extended & adjacent rings — catalog stubs. Present so capture/promotion
// can reference them; not seeded into the sample and not scoring drivers.
const EXTENDED = [
  { id: 'optical_inventory', name: 'Optical inventory', layer: 'L2', ring: 'extended', captureMode: 'note', sharedFateDimensions: [] },
  { id: 'line_card', name: 'Module / line card', layer: 'L1', ring: 'extended', captureMode: 'attribute', sharedFateDimensions: ['chassis'] },
  { id: 'cloud_net_internal', name: 'Cloud networking internals', layer: 'L3', ring: 'extended', captureMode: 'note', sharedFateDimensions: [] },
  { id: 'eos_eol', name: 'EoS / EoL dates', layer: 'L1', ring: 'extended', captureMode: 'attribute', sharedFateDimensions: [] },
]

// Adjacent-ring types capture as notes but carry a canonical key so a
// shared dependency can be promoted to an element (a named finding class).
const ADJACENT = [
  { id: 'orchestrator', name: 'SD-WAN / control-plane orchestrator', layer: 'adjacent', ring: 'adjacent', captureMode: 'note', canonicalKey: 'facilityId', sharedFateDimensions: ['orchestrator'], promotionRule: 'promote to element when two services name the same orchestrator' },
  { id: 'dns_ntp_identity', name: 'DNS / NTP / identity', layer: 'adjacent', ring: 'adjacent', captureMode: 'note', canonicalKey: 'facilityId', sharedFateDimensions: ['identity_service'] },
  { id: 'mgmt_system', name: 'Management system', layer: 'adjacent', ring: 'adjacent', captureMode: 'note', canonicalKey: 'facilityId', sharedFateDimensions: ['mgmt'] },
]

export const ELEMENT_TYPES = [...CORE, ...EXTENDED, ...ADJACENT]
export const CORE_TYPES = CORE
export const TYPE_BY_ID = Object.fromEntries(ELEMENT_TYPES.map((t) => [t.id, t]))

export function typesInRing(ring) {
  return ELEMENT_TYPES.filter((t) => t.ring === ring)
}

// Normalize a raw value to its type's canonical key. Returns null when the
// type has no canonical key (flag/note) or the value is empty — callers
// treat null as "cannot mint an element", enforcing the no-free-text rule.
export function canonicalKeyFor(typeId, rawValue) {
  const t = TYPE_BY_ID[typeId]
  if (!t || !t.canonicalKey) return null
  const norm = CANONICAL_KINDS[t.canonicalKey]
  const k = norm ? norm(rawValue) : String(rawValue || '').trim()
  return k ? `${typeId}:${k}` : null
}
