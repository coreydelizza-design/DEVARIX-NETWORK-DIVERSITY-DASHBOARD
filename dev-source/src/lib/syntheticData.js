// Sample-engagement seeder ONLY (spine §2.1). Builds the read-only,
// watermarked "Sample — Meridian Industrial (synthetic)" engagement as a
// full L1-L3 element graph: 24 sites, two services each, core-ring
// elements, facts, deliberate shared-fate collisions (shared conduit,
// carrier hotel, underlying carrier on a "diverse" pair, adjacent SD-WAN
// orchestrator promoted on collision), a source-vs-source conflict, and a
// missing-with-reason fact. Deterministic: seeded LCG + TODAY constant,
// no Date.now/Math.random. The store injects this; no view imports it.

import { TODAY } from './provenance'
import { mintElement, promoteToElement, makeFact } from './graph'

function rng(seed) {
  let s = seed
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648
    return s / 2147483648
  }
}
function dateDaysBeforeToday(days) {
  const d = new Date(TODAY)
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

const CITIES = [
  ['Denver', 'AMER', 'DNVRCO'], ['Chicago', 'AMER', 'CHCGIL'], ['Dallas', 'AMER', 'DLLSTX'],
  ['Atlanta', 'AMER', 'ATLNGA'], ['Seattle', 'AMER', 'STTLWA'], ['Phoenix', 'AMER', 'PHNXAZ'],
  ['New York', 'AMER', 'NYCMNY'], ['Boston', 'AMER', 'BSTNMA'], ['London', 'EMEA', 'LONDEN'],
  ['Frankfurt', 'EMEA', 'FRNKGE'], ['Amsterdam', 'EMEA', 'AMSTNL'], ['Paris', 'EMEA', 'PARSFR'],
  ['Singapore', 'APAC', 'SNGPSG'], ['Tokyo', 'APAC', 'TOKYJP'], ['Sydney', 'APAC', 'SYDNAU'],
  ['Mumbai', 'APAC', 'MMBAIN'], ['Sao Paulo', 'LATAM', 'SAOPBR'], ['Mexico City', 'LATAM', 'MXCYMX'],
  ['Toronto', 'AMER', 'TORNON'], ['Madrid', 'EMEA', 'MADRES'], ['Milan', 'EMEA', 'MILNIT'],
  ['Seoul', 'APAC', 'SEOLKR'], ['Bogota', 'LATAM', 'BGTACO'], ['Dublin', 'EMEA', 'DUBLIE'],
]
const CARRIERS = ['Lumen', 'Zayo', 'AT&T', 'Verizon', 'Colt']
const VENDORS = ['Ziply Fiber', 'Frontier', 'Comcast', 'Windstream']

// Per-site config guaranteeing a full verdict spread and acceptance #7's
// two decoupled cases (green < 50, red > 65). type/tier/quality plus flags:
// wc = force shared wire center (L1), cd/ho/un = shared conduit/hotel/
// underlying, or = shared adjacent orchestrator, cf = conflict, ms = missing.
const SITES = [
  { t: 'Data center', tier: 'T1', q: 'strong', wc: true },   // 0 red>65 (shared L1, else verified)
  { t: 'Data center', tier: 'T1', q: 'strong' },             // 1 conformant
  { t: 'Data center', tier: 'T1', q: 'strong', cd: true },   // 2 nonconformant (shared conduit)
  { t: 'Data center', tier: 'T1', q: 'strong' },             // 3 conformant
  { t: 'Regional hub', tier: 'T2', q: 'strong' },            // 4 conformant
  { t: 'Regional hub', tier: 'T2', q: 'strong', ho: true },  // 5 nonconformant (shared hotel)
  { t: 'Regional hub', tier: 'T2', q: 'aging' },             // 6 at-risk
  { t: 'Regional hub', tier: 'T2', q: 'strong', cf: true },  // 7 conflict
  { t: 'Regional hub', tier: 'T1', q: 'strong' },            // 8 conformant
  { t: 'Regional hub', tier: 'T2', q: 'strong', un: true },  // 9 at-risk (shared underlying L2)
  { t: 'Plant', tier: 'T3', q: 'strong' },                   // 10 over-provisioned
  { t: 'Plant', tier: 'T2', q: 'strong', ms: true },         // 11 at-risk (missing NNI)
  { t: 'Plant', tier: 'T2', q: 'aging' },                    // 12 at-risk
  { t: 'Plant', tier: 'T3', q: 'strong' },                   // 13 over-provisioned
  { t: 'Plant', tier: 'T2', q: 'strong', or: true },         // 14 at-risk (adjacent orchestrator)
  { t: 'Plant', tier: 'T3', q: 'aging' },                    // 15 at-risk
  { t: 'Plant', tier: 'T2', q: 'strong' },                   // 16 conformant
  { t: 'Plant', tier: 'T3', q: 'thin' },                     // 17 conformant (low score, tolerated)
  { t: 'Branch', tier: 'T4', q: 'thin' },                    // 18 green<50
  { t: 'Branch', tier: 'T4', q: 'thin' },                    // 19 green<50
  { t: 'Branch', tier: 'T4', q: 'strong' },                  // 20 over-provisioned
  { t: 'Branch', tier: 'T3', q: 'aging' },                   // 21 at-risk
  { t: 'Branch', tier: 'T3', q: 'thin' },                    // 22 conformant low
  { t: 'Branch', tier: 'T4', q: 'aging' },                   // 23 at-risk
]

// quality -> (outcome, provenance, age-days) for a non-shared service fact.
// strong: verified-diverse & fresh. thin: unknown outcome (low score, but
// not a weak diversity claim) -> Conformant on a tolerant tier. aging:
// diverse but stale, so provenance decays and the site reads at-risk.
function factProfile(q, r) {
  if (q === 'strong') return { outcome: 'diverse', provenance: 'verified', age: Math.floor(r() * 120), validity: 365 }
  if (q === 'thin') return { outcome: 'unknown', provenance: 'declared', age: Math.floor(r() * 120), validity: 365 }
  return { outcome: 'diverse', provenance: 'documented', age: 400 + Math.floor(r() * 220), validity: 365 } // aging: decays
}

export function buildSampleEngagement() {
  const r = rng(90210)
  const elements = {}
  const mint = (typeId, val, label) => {
    const m = mintElement(elements, typeId, val, label)
    if (m.ok && !m.existed) elements[m.id] = m.element
    return m.ok ? m.id : null
  }
  const promote = (typeId, val, label) => {
    const m = promoteToElement(elements, typeId, val, label)
    if (m.ok && !m.existed) elements[m.id] = m.element
    return m.ok ? m.id : null
  }

  const sites = []
  const services = []
  const edges = []
  const facts = []
  let edgeN = 0
  let factN = 0
  const addEdge = (from, to) => { if (to) edges.push({ id: `edge-${edgeN++}`, kind: 'traverses', from, to }) }
  const addFact = (subjectType, subjectId, dim, p) => facts.push(makeFact(`fact-${factN++}`, subjectType, subjectId, dim, p))
  const REV = { T1: 200000, T2: 60000, T3: 12000, T4: 2000 }
  const RTO = { T1: 2, T2: 8, T3: 36, T4: 96 }

  SITES.forEach((cfg, i) => {
    const [city, region, clli] = CITIES[i]
    const id = `S-${100 + i}`
    const tier = cfg.tier
    const assignedBy = i % 11 === 0 ? 'customer-override' : 'platform-recommended'
    sites.push({
      id, name: `${id} · ${city} ${cfg.t.toLowerCase()}`, city, region, tier, siteType: cfg.t,
      address: `${100 + Math.floor(r() * 8900)} Industrial Way, ${city}`,
      coords: `${(20 + r() * 40).toFixed(3)} / ${(-120 + r() * 100).toFixed(3)}`,
      revenuePerHourUSD: cfg.ms || cfg.wc ? 140000 : REV[tier], // a couple of misassignment candidates
      rtoHours: RTO[tier],
      tierAssignment: {
        tier, assignedBy, assignedDate: dateDaysBeforeToday(30 + Math.floor(r() * 200)),
        rationale: assignedBy === 'customer-override' ? 'Customer-designated criticality' : 'From revenue-at-risk and RTO inputs',
      },
    })

    const svcA = { id: `svc-${id}-A`, site_id: id, name: `${id} primary` }
    const svcB = { id: `svc-${id}-B`, site_id: id, name: `${id} secondary` }
    services.push(svcA, svcB)

    const carrierA = CARRIERS[i % CARRIERS.length]
    const carrierB = CARRIERS[(i + 2) % CARRIERS.length]

    const wcA = mint('wire_center', clli)
    const wcB = mint('wire_center', cfg.wc ? clli : `${clli.slice(0, 4)}${10 + (i % 80)}`)
    addEdge(svcA.id, wcA); addEdge(svcB.id, wcB)

    const apA = mint('access_provider', carrierA)
    const apB = mint('access_provider', carrierB)
    addEdge(svcA.id, apA); addEdge(svcB.id, apB)

    const vendorA = VENDORS[i % VENDORS.length]
    const vendorB = cfg.un ? vendorA : VENDORS[(i + 1) % VENDORS.length]
    const upA = mint('underlying_provider', vendorA)
    const upB = mint('underlying_provider', vendorB)
    addEdge(svcA.id, upA); addEdge(svcB.id, upB)

    const hotelA = mint('pop_hotel', `${city} CH1`, `${city} carrier hotel 1`)
    const hotelB = mint('pop_hotel', cfg.ho ? `${city} CH1` : `${city} CH2`, `${city} carrier hotel 2`)
    addEdge(svcA.id, hotelA); addEdge(svcB.id, hotelB)

    const conduitA = mint('conduit', `${id}-CDT-N`)
    const conduitB = mint('conduit', cfg.cd ? `${id}-CDT-N` : `${id}-CDT-S`)
    addEdge(svcA.id, conduitA); addEdge(svcB.id, conduitB)

    // adjacent orchestrator: note captured on both services -> promoted to a
    // shared element (a named finding class) on the orchestrator-collision site.
    if (cfg.or) {
      const orch = promote('orchestrator', 'Meridian-SDWAN-Orch-1', 'Meridian SD-WAN orchestrator')
      addEdge(svcA.id, orch); addEdge(svcB.id, orch)
    }

    // Diversity facts are SERVICE-scoped (a service's posture at a layer),
    // so shared canonical elements don't leak facts across sites. Per
    // dimension, a shared element (A element === B element) yields a
    // shared fact; otherwise the site's quality profile applies.
    ;[['wire_center', wcA, wcB], ['access_provider', apA, apB], ['underlying_provider', upA, upB], ['pop_hotel', hotelA, hotelB], ['conduit', conduitA, conduitB]].forEach(([dim, ea, eb]) => {
      if (!ea) return
      if (ea === eb) {
        addFact('service', svcA.id, dim, { value: 'shared', outcome: 'shared', provenance: 'documented', sourceRef: { kind: 'carrier_response', label: `${carrierA} DLR` }, capturedDate: dateDaysBeforeToday(Math.floor(r() * 90)), validityDays: 365 })
      } else {
        const p = factProfile(cfg.q, r)
        addFact('service', svcA.id, dim, { value: p.outcome, outcome: p.outcome, provenance: p.provenance, sourceRef: { kind: r() < 0.6 ? 'carrier_response' : 'document_ref', label: `${svcA.name} · ${dim}` }, capturedDate: dateDaysBeforeToday(p.age), validityDays: p.validity })
      }
    })

    if (cfg.ms) {
      const nni = mint('nni', `${clli}-NNI-01`)
      addEdge(svcA.id, nni)
      addFact('service', svcA.id, 'nni', { value: null, missingReason: 'requested_pending', provenance: 'inferred', sourceRef: { kind: 'carrier_response', label: `${carrierA} records request` }, capturedDate: dateDaysBeforeToday(18), validityDays: 365 })
    }
    if (cfg.cf) {
      addFact('service', svcA.id, 'wire_center', { value: 'diverse', outcome: 'diverse', provenance: 'declared', sourceRef: { kind: 'client_declaration', label: 'Client network team' }, capturedDate: dateDaysBeforeToday(45), validityDays: 365 })
      addFact('service', svcA.id, 'wire_center', { value: 'shared', outcome: 'shared', provenance: 'documented', sourceRef: { kind: 'carrier_response', label: `${carrierA} DLR` }, capturedDate: dateDaysBeforeToday(9), validityDays: 365 })
    }
  })

  const engagement = {
    id: 'sample',
    sample: true,
    name: 'Sample — Meridian Industrial (synthetic)',
    client: { name: 'Meridian Industrial (synthetic)' },
    created_date: dateDaysBeforeToday(45),
    sites, services, edges, facts,
    pairs: [], circuits: [],
    documents: { msa: { status: 'executed', date: dateDaysBeforeToday(60) }, sow: { status: 'executed', date: dateDaysBeforeToday(50) }, loa: { status: 'executed', date: dateDaysBeforeToday(44) }, nda: { status: 'executed', date: dateDaysBeforeToday(44) }, dpa: { status: 'sent', date: dateDaysBeforeToday(30) } },
    requests: [],
  }
  return { engagement, elements }
}
