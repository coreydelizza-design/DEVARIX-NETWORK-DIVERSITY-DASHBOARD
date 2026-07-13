// Canonical access transport mediums. Drives the scorer's per-circuit
// medium pickers and serves as the pick list for intake's site-access
// fields. Plant identifies the physical infrastructure class used for
// diversity comparison — lit and dark fiber share plant, DSL and EoC
// share plant, and so on.

export const transportMediums = [
  { id: 'fiber-lit', label: 'Fiber — lit service', plant: 'fiber' },
  { id: 'fiber-dark', label: 'Dark fiber', plant: 'fiber' },
  { id: 'copper-dsl', label: 'DSL / copper broadband', plant: 'copper' },
  { id: 'copper-eoc', label: 'Ethernet over copper', plant: 'copper' },
  { id: 'cable-docsis', label: 'Cable broadband (DOCSIS / HFC)', plant: 'coax' },
  { id: 'fixed-wireless', label: 'Fixed wireless access', plant: 'fixed-wireless' },
  { id: 'microwave', label: 'Licensed microwave', plant: 'microwave' },
  { id: 'cellular', label: 'Cellular 4G / 5G', plant: 'cellular' },
  { id: 'sat-leo', label: 'Satellite — LEO (Starlink-class)', plant: 'leo' },
  { id: 'sat-geo', label: 'Satellite — GEO (VSAT)', plant: 'geo' },
]

const WIRELINE = ['fiber', 'copper', 'coax']
// Classes where two circuits of the same plant share constellation,
// spectrum, or tower infrastructure and fail together.
const SHARED_RF = ['cellular', 'leo', 'geo']

// Maps a circuit-pair medium selection to an option index of the
// 'Access technology' criterion in scoringModel. Returns null until
// both mediums are chosen.
export function accessTechOptionIndex(aId, bId) {
  const a = transportMediums.find((m) => m.id === aId)
  const b = transportMediums.find((m) => m.id === bId)
  if (!a || !b) return null
  if (a.plant === b.plant && SHARED_RF.includes(a.plant)) return 3
  if (a.plant === b.plant) return 0
  if (WIRELINE.includes(a.plant) && WIRELINE.includes(b.plant)) return 1
  return 2
}

// Service types delivered over an access medium — the pick list for the
// intake schema's identity-layer service_type field. A service is not a
// medium: MPLS can ride fiber, copper, or satellite.
export const serviceTypes = [
  'DIA (dedicated internet access)',
  'MPLS / IP-VPN',
  'Ethernet — EPL / EVPL',
  'Wavelength',
  'Dark fiber (unlit capacity)',
  'Broadband (best-effort)',
  'SD-WAN underlay',
  'Private LTE / 5G',
]
