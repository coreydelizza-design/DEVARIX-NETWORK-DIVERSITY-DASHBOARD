// Cross-examination generalized to the graph (spine §3). Shared fate is a
// computed property: N services sharing an element (or a shared-risk
// dimension) at any layer. This absorbs the original seven pairwise
// checks — each was an element-collision on a specific canonical field
// (wire center, access vendor, NNI, POP, ASN…). Plus source-vs-source
// conflict detection on facts. Nothing here is stored; the site page and
// evidence queue render these live and the auditor accepts a finding to
// write the shared-fate relation to the registry.

import { TYPE_BY_ID } from './elementTypes'

const RING_OF = (elements, id) => (elements[id] ? elements[id].ring : 'core')

// Every element two or more of a site's services traverse is a shared-fate
// collision. Adjacent-ring shared dependencies are a named finding class.
export function detectCollisions(engagement, elements, siteId) {
  const services = (engagement.services || []).filter((s) => !siteId || s.site_id === siteId)
  const svcIds = new Set(services.map((s) => s.id))
  const byElement = {}
  engagement.edges
    .filter((e) => e.kind === 'traverses' && svcIds.has(e.from))
    .forEach((e) => {
      ;(byElement[e.to] = byElement[e.to] || new Set()).add(e.from)
    })

  const findings = []
  Object.entries(byElement).forEach(([elementId, set]) => {
    if (set.size < 2) return
    const el = elements[elementId]
    if (!el) return
    const t = TYPE_BY_ID[el.typeId] || {}
    findings.push({
      id: `col-${elementId}`,
      kind: el.ring === 'adjacent' ? 'adjacent' : 'element',
      elementId,
      element: el,
      layer: el.layer,
      typeName: t.name || el.typeId,
      services: [...set],
      severity: el.layer === 'L1' ? 'high' : el.ring === 'adjacent' ? 'medium' : 'high',
      note: el.ring === 'adjacent'
        ? `${set.size} services depend on the same ${t.name} — shared adjacent dependency`
        : `${set.size} services traverse the same ${t.name} (${el.key}) at ${el.layer}`,
    })
  })

  // Shared-risk-group dimensions (e.g. two distinct elements in the same
  // building / conduit corridor / power domain).
  const byDim = {}
  engagement.edges
    .filter((e) => e.kind === 'risk_group' && svcIds.has(e.from))
    .forEach((e) => {
      ;(byDim[e.to] = byDim[e.to] || new Set()).add(e.from)
    })
  Object.entries(byDim).forEach(([dim, set]) => {
    if (set.size < 2) return
    findings.push({
      id: `col-rg-${dim}`,
      kind: 'risk_group',
      dimension: dim,
      layer: 'L1',
      typeName: 'shared risk group',
      services: [...set],
      severity: 'high',
      note: `${set.size} services share the risk group "${dim}"`,
    })
  })

  return findings.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'high' ? -1 : 1))
}

// Source-vs-source conflicts: facts on the same subject+dimension whose
// outcomes/values disagree across distinct sources. Never silently
// overwritten (spine §2.5).
export function detectConflicts(engagement) {
  const groups = {}
  ;(engagement.facts || []).forEach((f) => {
    const k = `${f.subjectType}:${f.subjectId}:${f.dimension}`
    ;(groups[k] = groups[k] || []).push(f)
  })
  const conflicts = []
  Object.entries(groups).forEach(([k, facts]) => {
    if (facts.length < 2) return
    const outcomes = new Set(facts.map((f) => f.outcome).filter(Boolean))
    const values = new Set(facts.map((f) => String(f.value)).filter((v) => v !== 'null'))
    const adjudicated = facts.some((f) => f.adjudication)
    if (outcomes.size > 1 || values.size > 1) {
      conflicts.push({
        id: `conf-${k}`,
        subjectType: facts[0].subjectType,
        subjectId: facts[0].subjectId,
        dimension: facts[0].dimension,
        facts,
        adjudicated,
        note: `${facts.length} sources disagree on ${facts[0].dimension}`,
      })
    }
  })
  return conflicts
}

// The shared-fate relation written to the registry when an auditor accepts
// a collision — the compounding cross-engagement asset.
export function makeSharedFateRelation(finding, evidenceRef, engagementId, date) {
  return {
    element_ids: finding.elementId ? [finding.elementId] : [],
    dimension: finding.dimension || null,
    layer: finding.layer,
    relation: 'shared_fate',
    evidence_ref: evidenceRef,
    engagement_id: engagementId,
    date,
  }
}
