// Telcordia-style serialized circuit ID parsing.
// Real deployments would back this with a full CLLI database and per-carrier
// format registry; this local table is enough to demonstrate the mechanic.

export const clliTable = {
  DNVRCO: 'Denver, CO',
  CHCGIL: 'Chicago, IL',
  NYCMNY: 'New York, NY',
  DLLSTX: 'Dallas, TX',
  LSANCA: 'Los Angeles, CA',
  ATLNGA: 'Atlanta, GA',
  STTLWA: 'Seattle, WA',
  PHNXAZ: 'Phoenix, AZ',
  LONDEN: 'London, UK',
  FRNKGE: 'Frankfurt, DE',
}

export const facilityCodes = {
  T1: 'DS1 · 1.5 Mbps TDM',
  T3: 'DS3 · 45 Mbps TDM',
  OC3: 'OC-3 SONET',
  OC12: 'OC-12 SONET',
  GE: 'Gigabit Ethernet',
  TGE: '10 Gigabit Ethernet',
  HC: 'High-cap facility',
}

export function parseCircuitId(raw) {
  const v = (raw || '').trim().toUpperCase()
  const parts = v.split('/')
  const cliiish = /^[A-Z]{4,6}[A-Z0-9]{2}[A-Z0-9]{0,2}$/
  if (parts.length >= 4 && cliiish.test(parts[2])) {
    const a = parts[2].substring(0, 6)
    const z = parts[3].substring(0, 6)
    return {
      valid: true,
      format: 'Telcordia CLCI serialized, 4 fields',
      serial: parts[0],
      facility: facilityCodes[parts[1]] || parts[1] + ' · unrecognized facility code',
      aLoc: { code: parts[2], place: clliTable[a] || 'CLLI not in local table' },
      zLoc: { code: parts[3], place: clliTable[z] || 'CLLI not in local table' },
      inference:
        'CLLI-coded endpoints allow wire center lookup and carrier facility cross-check against the billed provider.',
    }
  }
  return {
    valid: false,
    message:
      'No known format matched. Non-standard IDs go to the manual validation queue with an LOA/CFA request to the billed carrier.',
  }
}
