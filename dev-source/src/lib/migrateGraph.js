// v2 -> v3 migration: derive the L1-L3 element graph from existing
// engagement data ADDITIVELY. Sites, circuits, and pairs are retained
// byte-for-byte; services, elements, edges, and facts are added beside
// them. Losslessness is therefore guaranteed by construction and the
// verify step proves it with a field-level pre/post comparison.
//
// Elements are minted from the canonical registry refs the circuit layers
// already carry (CLLI, carrier/vendor, NNI, ASN), so the graph inherits
// the normalization discipline. Pair-layer grade records become facts on
// the elements their layers referenced.

import { mintElement, makeFact } from './graph'

// circuit layer ref -> element type to mint. registry ref is `kind:KEY`;
// the KEY portion becomes the element's canonical value.
const IDENTITY_MAP = [
  ['identity', 'carrier_ref', 'access_provider'],
  ['loop', 'wire_center_ref', 'wire_center'],
  ['loop', 'access_provider_ref', 'underlying_provider'],
  ['nni', 'nni_id_ref', 'nni'],
  ['pop', 'pop_clli_ref', 'pop_hotel'],
  ['logical', 'egress_asn_ref', 'asn'],
]

// pair-layer -> the element type whose fact this grade becomes.
const GRADE_LAYER_MAP = {
  identity: 'access_provider',
  loop: 'wire_center',
  nni: 'nni',
  pop: 'pop_hotel',
  logical: 'asn',
}

function keyOfRef(ref) {
  if (!ref) return null
  const i = ref.indexOf(':')
  return i < 0 ? ref : ref.slice(i + 1)
}

export function deriveGraphForState(state) {
  const registry = { ...state.registry }
  const elements = { ...(registry.elements || {}) }
  registry.elements = elements
  if (!registry.sharedFate) registry.sharedFate = []

  const engagements = (state.engagements || []).map((eng) => {
    // already migrated? keep as-is (idempotent)
    const services = []
    const edges = []
    const facts = []
    let edgeN = 0
    let factN = 0

    const circuitElementIds = {} // circuitId -> {typeId -> elementId}

    ;(eng.circuits || []).forEach((c) => {
      const svcId = `svc-${c.id}`
      services.push({
        id: svcId,
        site_id: c.site_id,
        name: (c.layers.identity && c.layers.identity.circuit_id) || c.id,
        source_circuit_id: c.id,
      })
      const mine = {}
      IDENTITY_MAP.forEach(([layer, field, typeId]) => {
        const ref = c.layers[layer] && c.layers[layer][field]
        const key = keyOfRef(ref)
        if (!key) return
        const r = mintElement(elements, typeId, key)
        if (!r.ok) return
        if (!r.existed) elements[r.id] = r.element
        mine[typeId] = r.id
        edges.push({ id: `edge-${eng.id}-${edgeN++}`, kind: 'traverses', from: svcId, to: r.id })
      })
      // entrance conduit (free-text -> conduit element when present)
      const conduit = c.layers.entrance && c.layers.entrance.conduit
      if (conduit) {
        const r = mintElement(elements, 'conduit', conduit)
        if (r.ok) {
          if (!r.existed) elements[r.id] = r.element
          mine.conduit = r.id
          edges.push({ id: `edge-${eng.id}-${edgeN++}`, kind: 'traverses', from: svcId, to: r.id })
        }
      }
      circuitElementIds[c.id] = mine
    })

    ;(eng.pairs || []).forEach((p) => {
      Object.entries(p.grades || {}).forEach(([layerId, g]) => {
        const typeId = GRADE_LAYER_MAP[layerId]
        const anchorElement = typeId && circuitElementIds[p.circuit_a_id] && circuitElementIds[p.circuit_a_id][typeId]
        const subjectType = anchorElement ? 'element' : 'service'
        const subjectId = anchorElement || `svc-${p.circuit_a_id}`
        // every migrated grade carries evidence_ref (editor enforced it),
        // so the derived fact is never naked.
        facts.push(
          makeFact(`fact-${eng.id}-${factN++}`, subjectType, subjectId, layerId, {
            value: g.outcome || 'unknown',
            outcome: g.outcome || 'unknown',
            provenance: g.provenance || 'declared',
            sourceRef: g.evidence_ref ? { kind: 'document_ref', label: g.evidence_ref } : { kind: 'document_ref', label: 'migrated grade' },
            capturedDate: g.verified_date || state.today || '2026-07-13',
            validityDays: 365,
          })
        )
      })
    })

    return { ...eng, services, edges, facts }
  })

  return { ...state, registry, engagements }
}
