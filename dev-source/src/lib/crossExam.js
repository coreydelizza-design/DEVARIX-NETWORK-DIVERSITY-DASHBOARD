// Cross-examination engine: automated contradiction checks on a circuit
// pair. Pure comparisons on registry entity ids — normalization is the
// contract, so label text is never compared. A missing field on either
// side is insufficient_data, never no_match. Match results carry a
// unified-record proposal (outcome shared, provenance documented — the
// contradiction is confirmed by records) with an auto-written evidence
// reference; nothing is graded unless a human saves it.

function display(registry, kind, ref) {
  if (!ref) return null
  const e = (registry[kind] || []).find((x) => x.id === ref)
  return e ? (kind === 'clli' ? e.key : e.label) : ref
}

// Checks 1, 2, 3, 6, 7 from the audit model. Numbers 4 and 5 are the
// external-workflow checks handled by manualHints below.
export function runChecks(registry, pair, circuits) {
  const a = circuits.find((c) => c.id === pair.circuit_a_id)
  const b = circuits.find((c) => c.id === pair.circuit_b_id)
  if (!a || !b) return []
  const A = a.layers
  const B = b.layers
  const bothType2 = A.loop.access_type === 'type2' && B.loop.access_type === 'type2'

  const compare = (num, name, layer, kind, aRef, bRef, evidenceFor) => {
    const av = display(registry, kind, aRef)
    const bv = display(registry, kind, bRef)
    if (!aRef || !bRef) return { num, name, layer, result: 'insufficient_data', a: av, b: bv }
    if (aRef === bRef) {
      return { num, name, layer, result: 'match', a: av, b: bv, evidence: evidenceFor(av), proposal: { outcome: 'shared', provenance: 'documented' } }
    }
    return { num, name, layer, result: 'no_match', a: av, b: bv }
  }
  const notApplicable = (num, name, layer) => ({ num, name, layer, result: 'not_applicable', a: null, b: null })

  const checks = []

  checks.push(compare(1, 'Serving wire center', 'loop', 'clli', A.loop.wire_center_ref, B.loop.wire_center_ref,
    (v) => `cross-exam: both circuits homed to serving wire center CLLI ${v}`))

  checks.push(bothType2
    ? compare(2, 'Access vendor (Type II)', 'loop', 'accessVendor', A.loop.access_provider_ref, B.loop.access_provider_ref,
        (v) => `cross-exam: both Type II loops ride access vendor ${v}`)
    : notApplicable(2, 'Access vendor (Type II)', 'loop'))

  if (!bothType2) {
    checks.push(notApplicable(3, 'NNI', 'nni'))
  } else if (A.nni.nni_id_ref && B.nni.nni_id_ref) {
    checks.push(compare(3, 'NNI', 'nni', 'nniId', A.nni.nni_id_ref, B.nni.nni_id_ref,
      (v) => `cross-exam: both circuits hand off at NNI ${v}`))
  } else {
    checks.push(compare(3, 'NNI location', 'nni', 'clli', A.nni.nni_clli_ref, B.nni.nni_clli_ref,
      (v) => `cross-exam: both circuits hand off at NNI location CLLI ${v}`))
  }

  const pop = compare(6, 'POP / node', 'pop', 'clli', A.pop.pop_clli_ref, B.pop.pop_clli_ref,
    (v) => `cross-exam: both circuits terminate at POP CLLI ${v}`)
  if (pop.result === 'match') {
    const same = (x, y) => x && y && x.trim().toLowerCase() === y.trim().toLowerCase()
    if (same(A.pop.router_node, B.pop.router_node)) pop.evidence += ` — same router/node ${A.pop.router_node.trim()}`
    else if (same(A.pop.shelf_card_port, B.pop.shelf_card_port)) pop.evidence += ` — same shelf/card/port ${A.pop.shelf_card_port.trim()}`
  }
  checks.push(pop)

  checks.push(compare(7, 'Egress ASN', 'logical', 'asn', A.logical.egress_asn_ref, B.logical.egress_asn_ref,
    (v) => `cross-exam: both carriers egress via ${v}`))

  return checks
}

// Checks 4 (KMZ route overlay — external GIS workflow) and 5 (building
// entrance — site walk). The tool derives review hints from captured
// intake fields; it does not render automated verdicts for these.
export function manualHints(pair, circuits) {
  const a = circuits.find((c) => c.id === pair.circuit_a_id)
  const b = circuits.find((c) => c.id === pair.circuit_b_id)
  if (!a || !b) return []
  const hints = []

  const overlaps = [a, b].map((c) => (c.layers.route.overlap_segments || '').trim()).filter(Boolean)
  const kmzBoth = a.layers.route.kmz_received === 'yes' && b.layers.route.kmz_received === 'yes'
  hints.push({
    num: 4,
    name: 'KMZ route overlap (external GIS)',
    layer: 'route',
    status: overlaps.length ? 'review' : kmzBoth ? 'info' : 'insufficient',
    text: overlaps.length
      ? `Review needed — overlap segments recorded: ${overlaps.join(' / ')}`
      : kmzBoth
        ? 'KMZs on file for both circuits — run the GIS overlay and record the result'
        : 'KMZ not on file for both circuits — request from carriers',
  })

  const ca = (a.layers.entrance.conduit || '').trim()
  const cb = (b.layers.entrance.conduit || '').trim()
  const sameConduit = ca && cb && ca.toLowerCase() === cb.toLowerCase()
  hints.push({
    num: 5,
    name: 'Building entrance (site walk)',
    layer: 'entrance',
    status: ca && cb ? (sameConduit ? 'review' : 'info') : 'insufficient',
    text: ca && cb
      ? sameConduit
        ? `Review needed — both circuits record the same conduit "${ca}"`
        : 'Recorded conduits differ — confirm physical separation on the site walk'
      : 'Entrance fields incomplete — capture conduit for both circuits',
  })

  return hints
}
