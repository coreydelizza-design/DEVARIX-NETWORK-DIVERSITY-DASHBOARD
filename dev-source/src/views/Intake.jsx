import { useState } from 'react'
import { parseCircuitId } from '../lib/circuitParser'
import { normalizeKey, makeCircuit, makePair, makeGrade, GRADES, LAYERS, transportMediums, serviceTypes } from '../lib/schema'
import { useStore, activeEngagement, addSite, updateSite, saveCircuit, savePair, addRegistryEntity } from '../lib/store'
import { runChecks, manualHints } from '../lib/crossExam'
import { PageHead, Pill } from '../components/ui'

// Text -> canonical entity resolution. Values persist as registry entity
// ids, never free text; a picker that doesn't resolve blocks save.
function resolveEntity(registry, kind, text) {
  const k = normalizeKey(text)
  if (!k) return { ok: true, ref: null }
  const ent = registry[kind].find((e) => e.key === k || e.label.toLowerCase() === text.trim().toLowerCase())
  return ent ? { ok: true, ref: ent.id } : { ok: false, ref: null }
}

function entityLabel(registry, kind, ref) {
  const ent = registry[kind].find((e) => e.id === ref)
  return ent ? ent.label : ''
}

function RegistryPicker({ registry, kind, listId, text, onText, addLabel }) {
  const { ok } = resolveEntity(registry, kind, text)
  return (
    <div style={{ display: 'flex', gap: 6, flex: 1, minWidth: 220 }}>
      <input
        type="text"
        list={listId}
        value={text}
        onChange={(e) => onText(e.target.value)}
        placeholder="Type to search…"
        style={{ flex: 1 }}
      />
      <datalist id={listId}>
        {registry[kind].map((e) => (
          <option key={e.id} value={e.label} />
        ))}
      </datalist>
      {!ok && (
        <button
          className="btn"
          onClick={() => {
            const ent = addRegistryEntity(kind, text.trim())
            onText(ent.label)
          }}
        >
          {addLabel}
        </button>
      )}
    </div>
  )
}

function ClliStatus({ registry, text }) {
  const k = normalizeKey(text)
  if (!k) return null
  const ent = registry.clli.find((e) => e.key === k)
  if (ent) return <p className="small ok" style={{ margin: '2px 0 0' }}>{ent.meta.place || ent.label} · in registry</p>
  if (/^[A-Z]{4}[A-Z0-9]{2,7}$/.test(k))
    return <p className="small muted" style={{ margin: '2px 0 0' }}>Not in registry — will be added as a new canonical CLLI on save</p>
  return <p className="small warn" style={{ margin: '2px 0 0' }}>Not a plausible CLLI format</p>
}

function TriState({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {[['yes', 'Yes'], ['no', 'No'], ['unknown', 'Unknown']].map(([v, l]) => (
        <button key={v} className={`btn ${value === v ? 'btn-primary' : ''}`} onClick={() => onChange(v)}>{l}</button>
      ))}
    </div>
  )
}

const asnDigits = (t) => String(t || '').trim().toUpperCase().replace(/^AS/, '')

function AsnPicker({ registry, text, onText }) {
  const d = asnDigits(text)
  const match = registry.asn.find((e) => e.key === d)
  const valid = /^\d+$/.test(d)
  return (
    <div style={{ flex: 1, minWidth: 220 }}>
      <div style={{ display: 'flex', gap: 6 }}>
        <input type="text" className="mono" list="asn-list" value={text} onChange={(e) => onText(e.target.value)} placeholder="e.g. 64801 or AS64801" style={{ flex: 1 }} />
        <datalist id="asn-list">
          {registry.asn.map((e) => (
            <option key={e.id} value={e.label} />
          ))}
        </datalist>
        {!match && valid && (
          <button className="btn" onClick={() => { addRegistryEntity('asn', d, `AS${d}`); onText(`AS${d}`) }}>Add ASN</button>
        )}
      </div>
      {d && !valid && <p className="small warn" style={{ margin: '2px 0 0' }}>ASN must be numeric</p>}
      {match && <p className="small ok" style={{ margin: '2px 0 0' }}>{match.label} · in registry</p>}
    </div>
  )
}

function Section({ title, filled, total, open, onToggle, children }) {
  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 6, marginBottom: 8 }}>
      <button
        onClick={onToggle}
        style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'none', border: 'none', cursor: 'pointer', font: 'inherit', textAlign: 'left' }}
      >
        <span style={{ fontWeight: 600, fontSize: 13.5 }}>{title}</span>
        <span className="small muted mono">{filled}/{total} fields {open ? '▾' : '▸'}</span>
      </button>
      {open && <div style={{ padding: '0 12px 12px' }}>{children}</div>}
    </div>
  )
}

// Per-layer completion from stored circuit data. Tri-state 'unknown' is
// the default and counts as unfilled; the NNI layer only counts on
// Type II loops.
export function layerCompletion(c) {
  const loop = c.layers.loop || {}
  const type2 = loop.access_type === 'type2'
  const defs = [
    ['Identity', c.layers.identity, ['circuit_id', 'carrier_ref', 'service_type', 'access_medium', 'evidence_source']],
    ['Loop', loop, type2 ? ['access_type', 'access_provider_ref', 'access_circuit_id', 'wire_center_ref', 'evidence_source'] : ['access_type', 'wire_center_ref', 'evidence_source']],
    ['Entrance', c.layers.entrance, ['conduit', 'demarc', 'riser', 'power', 'evidence_source']],
    ...(type2 ? [['NNI', c.layers.nni, ['nni_clli_ref', 'nni_id_ref', 'evidence_source']]] : []),
    ['Route', c.layers.route, ['kmz_received', 'kmz_file_ref', 'overlap_segments', 'evidence_source']],
    ['POP', c.layers.pop, ['pop_clli_ref', 'router_node', 'shelf_card_port', 'evidence_source']],
    ['Logical', c.layers.logical, ['egress_asn_ref', 'bgp_multihoming', 'traceroute_divergence', 'evidence_source']],
  ]
  return defs.map(([label, layer, fields]) => ({
    label,
    filled: fields.filter((k) => {
      const v = (layer || {})[k]
      return v && v !== 'unknown'
    }).length,
    total: fields.length,
  }))
}

const emptyForm = {
  circuitId: '',
  carrierText: '',
  serviceType: '',
  medium: '',
  identityEvidence: '',
  accessType: 'onnet',
  providerText: '',
  accessCircuitId: '',
  clliText: '',
  loopEvidence: '',
  conduit: '',
  demarc: '',
  riser: '',
  power: '',
  entranceEvidence: '',
  nniClli: '',
  nniIdText: '',
  nniEvidence: '',
  kmzReceived: 'unknown',
  kmzFileRef: '',
  overlapSegments: '',
  routeEvidence: '',
  popClli: '',
  routerNode: '',
  shelfCardPort: '',
  popEvidence: '',
  asnText: '',
  bgpMultihoming: 'unknown',
  tracerouteDivergence: 'unknown',
  logicalEvidence: '',
}

function CircuitForm({ registry, site, circuit, onDone, initialSection }) {
  const [f, setF] = useState(() => {
    if (!circuit) return emptyForm
    // Missing layer fields default so feature-3-era circuits load cleanly.
    const id = circuit.layers.identity || {}
    const loop = circuit.layers.loop || {}
    const ent = circuit.layers.entrance || {}
    const nni = circuit.layers.nni || {}
    const route = circuit.layers.route || {}
    const pop = circuit.layers.pop || {}
    const logical = circuit.layers.logical || {}
    const clliKey = (ref) => (registry.clli.find((e) => e.id === ref) || {}).key || ''
    return {
      circuitId: id.circuit_id || '',
      carrierText: entityLabel(registry, 'carrier', id.carrier_ref),
      serviceType: id.service_type || '',
      medium: id.access_medium || '',
      identityEvidence: id.evidence_source || '',
      accessType: loop.access_type || 'onnet',
      providerText: entityLabel(registry, 'accessVendor', loop.access_provider_ref),
      accessCircuitId: loop.access_circuit_id || '',
      clliText: clliKey(loop.wire_center_ref),
      loopEvidence: loop.evidence_source || '',
      conduit: ent.conduit || '',
      demarc: ent.demarc || '',
      riser: ent.riser || '',
      power: ent.power || '',
      entranceEvidence: ent.evidence_source || '',
      nniClli: clliKey(nni.nni_clli_ref),
      nniIdText: entityLabel(registry, 'nniId', nni.nni_id_ref),
      nniEvidence: nni.evidence_source || '',
      kmzReceived: route.kmz_received || 'unknown',
      kmzFileRef: route.kmz_file_ref || '',
      overlapSegments: route.overlap_segments || '',
      routeEvidence: route.evidence_source || '',
      popClli: clliKey(pop.pop_clli_ref),
      routerNode: pop.router_node || '',
      shelfCardPort: pop.shelf_card_port || '',
      popEvidence: pop.evidence_source || '',
      asnText: entityLabel(registry, 'asn', logical.egress_asn_ref),
      bgpMultihoming: logical.bgp_multihoming || 'unknown',
      tracerouteDivergence: logical.traceroute_divergence || 'unknown',
      logicalEvidence: logical.evidence_source || '',
    }
  })
  const [parsed, setParsed] = useState(null)
  const [notice, setNotice] = useState('')
  const [open, setOpen] = useState({ identity: true, loop: true, ...(initialSection ? { [initialSection]: true } : {}) })
  const set = (patch) => setF((prev) => ({ ...prev, ...patch }))
  const toggle = (k) => setOpen((prev) => ({ ...prev, [k]: !prev[k] }))
  const filled = (arr) => arr.filter(Boolean).length

  const onCircuitId = (v) => {
    const p = parseCircuitId(v)
    setParsed(p.valid ? p : null)
    // CLCI-coded ids carry the serving wire center as the A-location CLLI.
    set(p.valid ? { circuitId: v, clliText: p.aLoc.code.substring(0, 6) } : { circuitId: v })
  }

  const resolveClli = (text) => {
    const k = normalizeKey(text)
    if (!k) return null
    const ent = registry.clli.find((e) => e.key === k) || addRegistryEntity('clli', k, k)
    return ent.id
  }

  const save = () => {
    if (!f.circuitId.trim()) return setNotice('Circuit ID is required.')
    const carrier = resolveEntity(registry, 'carrier', f.carrierText)
    if (!carrier.ok) return setNotice('Carrier not in registry — use Add carrier to create it first.')
    const provider = f.accessType === 'type2' ? resolveEntity(registry, 'accessVendor', f.providerText) : { ok: true, ref: null }
    if (!provider.ok) return setNotice('Access provider not in registry — use Add vendor to create it first.')
    const nniId = f.accessType === 'type2' ? resolveEntity(registry, 'nniId', f.nniIdText) : { ok: true, ref: null }
    if (!nniId.ok) return setNotice('NNI ID not in registry — use Add NNI to create it first.')

    let asnRef = null
    const dAsn = asnDigits(f.asnText)
    if (dAsn) {
      if (!/^\d+$/.test(dAsn)) return setNotice('ASN must be numeric (e.g. 64801).')
      const ent = registry.asn.find((e) => e.key === dAsn) || addRegistryEntity('asn', dAsn, `AS${dAsn}`)
      asnRef = ent.id
    }

    const c = circuit || makeCircuit(site.id)
    const next = {
      ...c,
      layers: {
        ...c.layers,
        identity: {
          ...c.layers.identity,
          circuit_id: f.circuitId.trim(),
          carrier_ref: carrier.ref,
          service_type: f.serviceType,
          access_medium: f.medium,
          evidence_source: f.identityEvidence.trim(),
        },
        loop: {
          ...c.layers.loop,
          access_type: f.accessType,
          access_provider_ref: provider.ref,
          access_circuit_id: f.accessCircuitId.trim(),
          wire_center_ref: resolveClli(f.clliText),
          evidence_source: f.loopEvidence.trim(),
        },
        entrance: {
          ...c.layers.entrance,
          conduit: f.conduit.trim(),
          demarc: f.demarc.trim(),
          riser: f.riser.trim(),
          power: f.power.trim(),
          evidence_source: f.entranceEvidence.trim(),
        },
        // NNI facts persist only for Type II; an on-net save preserves any
        // previously captured values rather than discarding them.
        nni: f.accessType === 'type2'
          ? { ...c.layers.nni, nni_clli_ref: resolveClli(f.nniClli), nni_id_ref: nniId.ref, evidence_source: f.nniEvidence.trim() }
          : c.layers.nni,
        route: {
          ...c.layers.route,
          kmz_received: f.kmzReceived,
          kmz_file_ref: f.kmzFileRef.trim(),
          overlap_segments: f.overlapSegments.trim(),
          evidence_source: f.routeEvidence.trim(),
        },
        pop: {
          ...c.layers.pop,
          pop_clli_ref: resolveClli(f.popClli),
          router_node: f.routerNode.trim(),
          shelf_card_port: f.shelfCardPort.trim(),
          evidence_source: f.popEvidence.trim(),
        },
        logical: {
          ...c.layers.logical,
          egress_asn_ref: asnRef,
          bgp_multihoming: f.bgpMultihoming,
          traceroute_divergence: f.tracerouteDivergence,
          evidence_source: f.logicalEvidence.trim(),
        },
      },
    }
    saveCircuit(next)
    onDone()
  }

  return (
    <div className="card" style={{ background: 'var(--canvas)' }}>
      <p className="card-title">{circuit ? 'Edit circuit' : 'New circuit'} · {site.name}</p>

      <Section title="Identity" open={!!open.identity} onToggle={() => toggle('identity')}
        filled={filled([f.circuitId, f.carrierText, f.serviceType, f.medium, f.identityEvidence])} total={5}>
        <div className="crit-row">
          <label className="crit-label">Circuit ID</label>
          <input
            type="text"
            className="mono"
            style={{ flex: 1, minWidth: 220 }}
            value={f.circuitId}
            onChange={(e) => onCircuitId(e.target.value)}
            placeholder="Paste carrier circuit ID — CLCI formats auto-parse"
          />
        </div>
        {parsed && (
          <p className="small ok" style={{ margin: '0 0 6px' }}>
            {parsed.format} · {parsed.facility} · A: {parsed.aLoc.code} ({parsed.aLoc.place}) · Z: {parsed.zLoc.code} ({parsed.zLoc.place})
          </p>
        )}
        <div className="crit-row">
          <label className="crit-label">Carrier</label>
          <RegistryPicker registry={registry} kind="carrier" listId={`carriers-${site.id}`} text={f.carrierText} onText={(v) => set({ carrierText: v })} addLabel="Add carrier" />
        </div>
        <div className="crit-row">
          <label className="crit-label">Service type</label>
          <select value={f.serviceType} onChange={(e) => set({ serviceType: e.target.value })}>
            <option value="">Select service…</option>
            {serviceTypes.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div className="crit-row">
          <label className="crit-label">Access medium</label>
          <select value={f.medium} onChange={(e) => set({ medium: e.target.value })}>
            <option value="">Select medium…</option>
            {transportMediums.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </div>
        <div className="crit-row">
          <label className="crit-label">Identity evidence source</label>
          <input type="text" style={{ flex: 1, minWidth: 220 }} value={f.identityEvidence} onChange={(e) => set({ identityEvidence: e.target.value })} placeholder="e.g. carrier inventory export, invoice" />
        </div>
      </Section>

      <Section title="Local loop" open={!!open.loop} onToggle={() => toggle('loop')}
        filled={filled(f.accessType === 'type2' ? [f.accessType, f.providerText, f.accessCircuitId, f.clliText, f.loopEvidence] : [f.accessType, f.clliText, f.loopEvidence])}
        total={f.accessType === 'type2' ? 5 : 3}>
        <div className="crit-row">
          <label className="crit-label">Loop ownership</label>
          <div style={{ display: 'flex', gap: 6 }}>
            {[['onnet', 'On-net'], ['type2', 'Type II (leased access)']].map(([v, l]) => (
              <button key={v} className={`btn ${f.accessType === v ? 'btn-primary' : ''}`} onClick={() => set({ accessType: v })}>
                {l}
              </button>
            ))}
          </div>
        </div>
        {f.accessType === 'type2' && (
          <>
            <div className="crit-row">
              <label className="crit-label">Access provider</label>
              <RegistryPicker registry={registry} kind="accessVendor" listId={`vendors-${site.id}`} text={f.providerText} onText={(v) => set({ providerText: v })} addLabel="Add vendor" />
            </div>
            <div className="crit-row">
              <label className="crit-label">Access circuit ID</label>
              <input type="text" className="mono" style={{ flex: 1, minWidth: 220 }} value={f.accessCircuitId} onChange={(e) => set({ accessCircuitId: e.target.value })} placeholder="Underlying access provider circuit ID" />
            </div>
          </>
        )}
        <div className="crit-row">
          <label className="crit-label">Serving wire center CLLI</label>
          <div style={{ flex: 1, minWidth: 220 }}>
            <input type="text" className="mono" style={{ width: '100%' }} value={f.clliText} onChange={(e) => set({ clliText: e.target.value.toUpperCase() })} placeholder="e.g. DNVRCO" />
            <ClliStatus registry={registry} text={f.clliText} />
          </div>
        </div>
        <div className="crit-row">
          <label className="crit-label">Loop evidence source</label>
          <input type="text" style={{ flex: 1, minWidth: 220 }} value={f.loopEvidence} onChange={(e) => set({ loopEvidence: e.target.value })} placeholder="e.g. DLR, LOA/CFA response, KMZ" />
        </div>
      </Section>

      <Section title="Building entrance" open={!!open.entrance} onToggle={() => toggle('entrance')}
        filled={filled([f.conduit, f.demarc, f.riser, f.power, f.entranceEvidence])} total={5}>
        <div className="crit-row">
          <label className="crit-label">Conduit</label>
          <input type="text" style={{ flex: 1, minWidth: 220 }} value={f.conduit} onChange={(e) => set({ conduit: e.target.value })} placeholder="e.g. North vault, Race St conduit" />
        </div>
        <div className="crit-row">
          <label className="crit-label">Demarc location</label>
          <input type="text" style={{ flex: 1, minWidth: 220 }} value={f.demarc} onChange={(e) => set({ demarc: e.target.value })} placeholder="e.g. MPOE room 014, rack B3" />
        </div>
        <div className="crit-row">
          <label className="crit-label">Riser path</label>
          <input type="text" style={{ flex: 1, minWidth: 220 }} value={f.riser} onChange={(e) => set({ riser: e.target.value })} placeholder="e.g. East riser, floors 1-6" />
        </div>
        <div className="crit-row">
          <label className="crit-label">Power feed</label>
          <input type="text" style={{ flex: 1, minWidth: 220 }} value={f.power} onChange={(e) => set({ power: e.target.value })} placeholder="e.g. A-feed only / A+B diverse" />
        </div>
        <div className="crit-row">
          <label className="crit-label">Entrance evidence source</label>
          <input type="text" style={{ flex: 1, minWidth: 220 }} value={f.entranceEvidence} onChange={(e) => set({ entranceEvidence: e.target.value })} placeholder="e.g. site walk photos, building riser diagram" />
        </div>
      </Section>

      {f.accessType === 'type2' && (
        <Section title="NNI" open={!!open.nni} onToggle={() => toggle('nni')}
          filled={filled([f.nniClli, f.nniIdText, f.nniEvidence])} total={3}>
          <div className="crit-row">
            <label className="crit-label">NNI location CLLI</label>
            <div style={{ flex: 1, minWidth: 220 }}>
              <input type="text" className="mono" style={{ width: '100%' }} value={f.nniClli} onChange={(e) => set({ nniClli: e.target.value.toUpperCase() })} placeholder="e.g. DNVRCOMA" />
              <ClliStatus registry={registry} text={f.nniClli} />
            </div>
          </div>
          <div className="crit-row">
            <label className="crit-label">NNI ID</label>
            <RegistryPicker registry={registry} kind="nniId" listId={`nni-${site.id}`} text={f.nniIdText} onText={(v) => set({ nniIdText: v })} addLabel="Add NNI" />
          </div>
          <div className="crit-row">
            <label className="crit-label">NNI evidence source</label>
            <input type="text" style={{ flex: 1, minWidth: 220 }} value={f.nniEvidence} onChange={(e) => set({ nniEvidence: e.target.value })} placeholder="e.g. carrier NNI records response" />
          </div>
        </Section>
      )}

      <Section title="Route" open={!!open.route} onToggle={() => toggle('route')}
        filled={filled([f.kmzReceived !== 'unknown', f.kmzFileRef, f.overlapSegments, f.routeEvidence])} total={4}>
        <div className="crit-row">
          <label className="crit-label">KMZ received</label>
          <TriState value={f.kmzReceived} onChange={(v) => set({ kmzReceived: v })} />
        </div>
        <div className="crit-row">
          <label className="crit-label">KMZ file reference</label>
          <input type="text" className="mono" style={{ flex: 1, minWidth: 220 }} value={f.kmzFileRef} onChange={(e) => set({ kmzFileRef: e.target.value })} placeholder="e.g. den014-carrierA-route.kmz · sha or share path" />
        </div>
        <div className="crit-row">
          <label className="crit-label">Overlap segments found</label>
          <input type="text" style={{ flex: 1, minWidth: 220 }} value={f.overlapSegments} onChange={(e) => set({ overlapSegments: e.target.value })} placeholder="GIS overlay result — segments where routes share path" />
        </div>
        <div className="crit-row">
          <label className="crit-label">Route evidence source</label>
          <input type="text" style={{ flex: 1, minWidth: 220 }} value={f.routeEvidence} onChange={(e) => set({ routeEvidence: e.target.value })} placeholder="e.g. carrier KMZ under NDA, GIS overlay report" />
        </div>
      </Section>

      <Section title="POP / node" open={!!open.pop} onToggle={() => toggle('pop')}
        filled={filled([f.popClli, f.routerNode, f.shelfCardPort, f.popEvidence])} total={4}>
        <div className="crit-row">
          <label className="crit-label">POP CLLI</label>
          <div style={{ flex: 1, minWidth: 220 }}>
            <input type="text" className="mono" style={{ width: '100%' }} value={f.popClli} onChange={(e) => set({ popClli: e.target.value.toUpperCase() })} placeholder="e.g. DNVRCOMA" />
            <ClliStatus registry={registry} text={f.popClli} />
          </div>
        </div>
        <div className="crit-row">
          <label className="crit-label">Router / node</label>
          <input type="text" className="mono" style={{ flex: 1, minWidth: 220 }} value={f.routerNode} onChange={(e) => set({ routerNode: e.target.value })} placeholder="e.g. den-edge-01" />
        </div>
        <div className="crit-row">
          <label className="crit-label">Shelf / card / port</label>
          <input type="text" className="mono" style={{ flex: 1, minWidth: 220 }} value={f.shelfCardPort} onChange={(e) => set({ shelfCardPort: e.target.value })} placeholder="e.g. shelf 2 / card 4 / port 12" />
        </div>
        <div className="crit-row">
          <label className="crit-label">POP evidence source</label>
          <input type="text" style={{ flex: 1, minWidth: 220 }} value={f.popEvidence} onChange={(e) => set({ popEvidence: e.target.value })} placeholder="e.g. carrier POP/node records response" />
        </div>
      </Section>

      <Section title="Logical" open={!!open.logical} onToggle={() => toggle('logical')}
        filled={filled([f.asnText, f.bgpMultihoming !== 'unknown', f.tracerouteDivergence !== 'unknown', f.logicalEvidence])} total={4}>
        <div className="crit-row">
          <label className="crit-label">Egress ASN observed</label>
          <AsnPicker registry={registry} text={f.asnText} onText={(v) => set({ asnText: v })} />
        </div>
        <div className="crit-row">
          <label className="crit-label">BGP multihoming confirmed</label>
          <TriState value={f.bgpMultihoming} onChange={(v) => set({ bgpMultihoming: v })} />
        </div>
        <div className="crit-row">
          <label className="crit-label">Traceroute divergence observed</label>
          <TriState value={f.tracerouteDivergence} onChange={(v) => set({ tracerouteDivergence: v })} />
        </div>
        <div className="crit-row">
          <label className="crit-label">Logical evidence source</label>
          <input type="text" style={{ flex: 1, minWidth: 220 }} value={f.logicalEvidence} onChange={(e) => set({ logicalEvidence: e.target.value })} placeholder="e.g. looking-glass capture, traceroute logs" />
        </div>
      </Section>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12 }}>
        <button className="btn btn-primary" onClick={save}>Save circuit</button>
        <button className="btn" onClick={onDone}>Cancel</button>
        {notice && <span className="small danger">{notice}</span>}
      </div>
    </div>
  )
}

// --- circuit pairs & grade matrix ---

const GRADE_ORDER = ['VERIFIED_DIVERSE', 'CLAIMED_UNVERIFIED', 'UNKNOWN', 'SHARED_FATE_CONFIRMED']
const GRADE_COLORS = {
  VERIFIED_DIVERSE: '#0b7261',
  CLAIMED_UNVERIFIED: '#c07f16',
  UNKNOWN: '#6b7280',
  SHARED_FATE_CONFIRMED: '#a83228',
}

function layerSummary(registry, c, layerId) {
  if (!c) return '—'
  const L = c.layers[layerId] || {}
  const clli = (ref) => (registry.clli.find((e) => e.id === ref) || {}).key || ''
  const tri = (v, label) => (v && v !== 'unknown' ? `${label} ${v}` : '')
  const parts = {
    identity: [L.circuit_id, entityLabel(registry, 'carrier', L.carrier_ref), L.service_type],
    loop: [L.access_type === 'type2' ? 'Type II' : L.access_type === 'onnet' ? 'On-net' : '', entityLabel(registry, 'accessVendor', L.access_provider_ref), clli(L.wire_center_ref)],
    entrance: [L.conduit, L.demarc, L.power],
    nni: [clli(L.nni_clli_ref), entityLabel(registry, 'nniId', L.nni_id_ref)],
    route: [tri(L.kmz_received, 'KMZ'), L.overlap_segments],
    pop: [clli(L.pop_clli_ref), L.router_node, L.shelf_card_port],
    logical: [entityLabel(registry, 'asn', L.egress_asn_ref), tri(L.bgp_multihoming, 'BGP'), tri(L.traceroute_divergence, 'TR div')],
  }[layerId] || []
  return parts.filter(Boolean).join(' · ') || '—'
}

function GradeEditor({ layerLabel, existing, onSave, onCancel }) {
  const [grade, setGrade] = useState(existing ? existing.grade : null)
  const [evidenceRef, setEvidenceRef] = useState(existing ? existing.evidence_ref : '')
  const [note, setNote] = useState(existing ? existing.confidence_note : '')
  const [notice, setNotice] = useState('')

  const save = () => {
    if (!grade) return setNotice('Pick a grade.')
    if (!evidenceRef.trim()) return setNotice('Evidence reference required — a grade without evidence is an attestation, not a finding.')
    onSave(grade, evidenceRef.trim(), note.trim())
  }

  return (
    <div style={{ background: 'var(--canvas)', borderRadius: 6, padding: '10px 12px', marginTop: 8 }}>
      <p className="small" style={{ fontWeight: 600, margin: '0 0 8px' }}>Grade · {layerLabel}</p>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        {GRADE_ORDER.map((g) => (
          <button
            key={g}
            className="btn"
            style={grade === g ? { background: GRADE_COLORS[g], borderColor: GRADE_COLORS[g], color: '#fff' } : undefined}
            onClick={() => setGrade(g)}
          >
            {GRADES[g].label}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        <input type="text" style={{ flex: 2, minWidth: 220 }} value={evidenceRef} onChange={(e) => setEvidenceRef(e.target.value)} placeholder="Evidence reference (required) — e.g. DLR response 2026-07-02" />
        <input type="text" style={{ flex: 2, minWidth: 220 }} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Confidence note (optional)" />
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="btn btn-primary" onClick={save}>Save grade</button>
        <button className="btn" onClick={onCancel}>Cancel</button>
        {notice && <span className="small danger">{notice}</span>}
      </div>
    </div>
  )
}

const CHECK_RESULT_META = {
  match: { pill: 'pill-red', label: 'shared-fate indicator' },
  no_match: { pill: 'pill-teal', label: 'no match' },
  insufficient_data: { pill: 'pill-gray', label: 'insufficient data' },
  not_applicable: { pill: 'pill-gray', label: 'n/a — on-net' },
}

const HINT_META = {
  review: { pill: 'pill-amber', label: 'review needed' },
  info: { pill: 'pill-blue', label: 'info' },
  insufficient: { pill: 'pill-gray', label: 'insufficient data' },
}

function PairCard({ registry, pair, circuits }) {
  const [editingLayer, setEditingLayer] = useState(null)
  const [proposal, setProposal] = useState(null)
  const [exam, setExam] = useState(null)
  const a = circuits.find((c) => c.id === pair.circuit_a_id)
  const b = circuits.find((c) => c.id === pair.circuit_b_id)
  const cid = (c) => (c && c.layers.identity.circuit_id) || 'missing circuit'

  const counts = { ungraded: 0 }
  GRADE_ORDER.forEach((g) => { counts[g] = 0 })
  LAYERS.forEach((l) => {
    const g = pair.grades[l.id]
    if (g) counts[g.grade]++
    else counts.ungraded++
  })

  const saveGrade = (layerId, grade, evidenceRef, note) => {
    savePair({ ...pair, grades: { ...pair.grades, [layerId]: makeGrade(grade, evidenceRef, note) } })
    setEditingLayer(null)
    setProposal(null)
  }

  const propose = (chk) => {
    setProposal({ layerId: chk.layer, grade: 'SHARED_FATE_CONFIRMED', evidence_ref: chk.evidence, confidence_note: '' })
    setEditingLayer(chk.layer)
  }

  return (
    <div className="row-item">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <span className="mono" style={{ fontWeight: 600, fontSize: 13.5 }}>{cid(a)} × {cid(b)}</span>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {GRADE_ORDER.filter((g) => counts[g] > 0).map((g) => (
            <Pill key={g} kind={GRADES[g].pill}>{counts[g]} {GRADES[g].label.toLowerCase()}</Pill>
          ))}
          {counts.ungraded > 0 && <span className="small faint">{counts.ungraded} ungraded</span>}
          <button className="btn" style={{ padding: '4px 10px', fontSize: 13 }} onClick={() => setExam(exam ? null : { checks: runChecks(registry, pair, circuits), hints: manualHints(pair, circuits) })}>
            {exam ? 'Hide cross-exam' : 'Run cross-exam'}
          </button>
        </div>
      </div>

      {exam && (
        <div style={{ background: 'var(--canvas)', borderRadius: 6, padding: '10px 12px', marginTop: 8 }}>
          <p className="small" style={{ fontWeight: 600, margin: '0 0 6px' }}>Cross-examination · automated checks on structured fields</p>
          {exam.checks.map((chk) => (
            <div key={chk.num} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', padding: '5px 0', borderTop: '1px solid var(--line)' }}>
              <span className="small" style={{ flex: '0 0 190px', fontWeight: 600 }}>{chk.num}. {chk.name}</span>
              <span className="small muted mono" style={{ flex: 1, minWidth: 160 }}>
                {chk.result === 'not_applicable' ? '—' : `A: ${chk.a || '—'} · B: ${chk.b || '—'}`}
              </span>
              <Pill kind={CHECK_RESULT_META[chk.result].pill}>{CHECK_RESULT_META[chk.result].label}</Pill>
              {chk.result === 'match' && (
                <button className="btn" style={{ padding: '4px 10px', fontSize: 13 }} onClick={() => propose(chk)}>Propose grade</button>
              )}
            </div>
          ))}
          {exam.hints.map((h) => (
            <div key={h.num} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', padding: '5px 0', borderTop: '1px solid var(--line)' }}>
              <span className="small" style={{ flex: '0 0 190px', fontWeight: 600 }}>{h.num}. {h.name}</span>
              <span className="small muted" style={{ flex: 1, minWidth: 160 }}>{h.text}</span>
              <Pill kind={HINT_META[h.status].pill}>{HINT_META[h.status].label}</Pill>
            </div>
          ))}
          <p className="small faint" style={{ margin: '6px 0 0' }}>
            The engine proposes; the auditor saves. Matches pre-fill a SHARED_FATE_CONFIRMED grade — nothing is graded automatically.
          </p>
        </div>
      )}
      <div style={{ marginTop: 8 }}>
        {LAYERS.map((l) => {
          const g = pair.grades[l.id]
          return (
            <div key={l.id} style={{ borderTop: '1px solid var(--line)', padding: '8px 0' }}>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ flex: '0 0 120px', fontWeight: 600, fontSize: 13 }}>{l.label}</span>
                <span className="small muted" style={{ flex: 1, minWidth: 160 }}>A: {layerSummary(registry, a, l.id)}</span>
                <span className="small muted" style={{ flex: 1, minWidth: 160 }}>B: {layerSummary(registry, b, l.id)}</span>
                {g ? <Pill kind={GRADES[g.grade].pill}>{GRADES[g.grade].label}</Pill> : <span className="small faint">ungraded</span>}
                <button className="btn" style={{ padding: '4px 10px', fontSize: 13 }} onClick={() => setEditingLayer(editingLayer === l.id ? null : l.id)}>
                  {g ? 'Regrade' : 'Grade'}
                </button>
              </div>
              {g && (
                <p className="small faint mono" style={{ margin: '4px 0 0', fontSize: 12 }}>
                  evidence: {g.evidence_ref} · verified {g.verified_date}{g.confidence_note ? ` · ${g.confidence_note}` : ''}
                </p>
              )}
              {editingLayer === l.id && (
                <GradeEditor
                  layerLabel={l.label}
                  existing={proposal && proposal.layerId === l.id ? proposal : g}
                  onSave={(gr, ev, nt) => saveGrade(l.id, gr, ev, nt)}
                  onCancel={() => { setEditingLayer(null); setProposal(null) }}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

const KMZ_CHIP = {
  yes: { pill: 'pill-teal', label: 'KMZ ✓' },
  no: { pill: 'pill-amber', label: 'KMZ —' },
  unknown: { pill: 'pill-gray', label: 'KMZ ?' },
}

function SiteBlock({ registry, site, circuits, pairs }) {
  const [editing, setEditing] = useState(false)
  const [fields, setFields] = useState({ name: site.name, address: site.address, coords: site.coords || '' })
  const [formFor, setFormFor] = useState(null) // null | 'new' | circuit id
  const [formSection, setFormSection] = useState(null)
  const [pairSel, setPairSel] = useState({ a: '', b: '' })

  const mediumLabel = (id) => (transportMediums.find((m) => m.id === id) || {}).label || ''
  const cidOf = (c) => c.layers.identity.circuit_id || c.id

  const svcCounts = {}
  circuits.forEach((c) => {
    const svc = (c.layers.identity.service_type || '').split(' (')[0]
    if (svc) svcCounts[svc] = (svcCounts[svc] || 0) + 1
  })
  const carriers = [...new Set(circuits.map((c) => entityLabel(registry, 'carrier', c.layers.identity.carrier_ref)).filter(Boolean))]
  const servicesLine = circuits.length
    ? [
        `${circuits.length} circuit${circuits.length > 1 ? 's' : ''}`,
        ...Object.entries(svcCounts).map(([svc, n]) => `${svc} ×${n}`),
        carriers.join(', '),
      ].filter(Boolean).join(' · ')
    : ''

  const definePair = () => {
    if (!pairSel.a || !pairSel.b || pairSel.a === pairSel.b) return
    savePair(makePair(site.id, pairSel.a, pairSel.b))
    setPairSel({ a: '', b: '' })
  }

  return (
    <div className="card">
      {editing ? (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
          <input type="text" style={{ flex: 1, minWidth: 160 }} value={fields.name} onChange={(e) => setFields({ ...fields, name: e.target.value })} />
          <input type="text" style={{ flex: 2, minWidth: 220 }} value={fields.address} onChange={(e) => setFields({ ...fields, address: e.target.value })} />
          <input type="text" className="mono" placeholder="Lat / long" style={{ flex: 1, minWidth: 140 }} value={fields.coords} onChange={(e) => setFields({ ...fields, coords: e.target.value })} />
          <button className="btn btn-primary" onClick={() => { updateSite(site.id, fields); setEditing(false) }}>Save</button>
          <button className="btn" onClick={() => setEditing(false)}>Cancel</button>
        </div>
      ) : (
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
          <div>
            <p className="card-title" style={{ margin: 0 }}>{site.name}</p>
            <p className="small muted" style={{ margin: '2px 0 0' }}>
              {site.address || 'No address recorded'}
              {site.coords && <span className="mono" style={{ fontSize: 12 }}> · {site.coords}</span>}
            </p>
            {servicesLine && <p className="small faint" style={{ margin: '2px 0 0' }}>{servicesLine}</p>}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={() => { setFields({ name: site.name, address: site.address, coords: site.coords || '' }); setEditing(true) }}>Edit site</button>
            <button className="btn btn-primary" onClick={() => { setFormSection(null); setFormFor('new') }}>Add circuit</button>
          </div>
        </div>
      )}

      {circuits.length === 0 ? (
        <p className="small muted" style={{ margin: 0 }}>No circuits yet.</p>
      ) : (
        <div className="row-list">
          {circuits.map((c) => {
            const id = c.layers.identity
            const loop = c.layers.loop
            return (
              <div key={c.id} className="row-item">
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span className="mono" style={{ fontWeight: 600, fontSize: 13.5 }}>{id.circuit_id}</span>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <Pill kind={loop.access_type === 'type2' ? 'pill-amber' : 'pill-blue'}>
                      {loop.access_type === 'type2' ? 'Type II' : 'On-net'}
                    </Pill>
                    <button
                      title="Route / KMZ status — open the Route section"
                      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                      onClick={() => { setFormSection('route'); setFormFor(c.id) }}
                    >
                      <Pill kind={KMZ_CHIP[(c.layers.route || {}).kmz_received || 'unknown'].pill}>
                        {KMZ_CHIP[(c.layers.route || {}).kmz_received || 'unknown'].label}
                      </Pill>
                    </button>
                    <button className="btn" style={{ padding: '5px 10px', fontSize: 13 }} onClick={() => { setFormSection(null); setFormFor(c.id) }}>Edit</button>
                  </div>
                </div>
                <p className="small muted" style={{ margin: '4px 0 0' }}>
                  {entityLabel(registry, 'carrier', id.carrier_ref) || 'No carrier'} · {id.service_type || 'no service type'} · {mediumLabel(id.access_medium) || 'no medium'}
                </p>
                <p className="small muted" style={{ margin: '2px 0 0' }}>
                  {loop.access_type === 'type2' && `via ${entityLabel(registry, 'accessVendor', loop.access_provider_ref) || 'unknown provider'} · `}
                  wire center: {(registry.clli.find((e) => e.id === loop.wire_center_ref) || {}).key || 'unknown'}
                  {id.evidence_source || loop.evidence_source ? '' : ' · no evidence sources'}
                </p>
                <p className="small faint mono" style={{ margin: '2px 0 0', fontSize: 12 }}>
                  {layerCompletion(c).map((l) => `${l.label} ${l.filled}/${l.total}`).join(' · ')}
                </p>
              </div>
            )
          })}
        </div>
      )}

      {formFor && (
        <div style={{ marginTop: 12 }}>
          <CircuitForm
            key={`${formFor}-${formSection || ''}`}
            registry={registry}
            site={site}
            circuit={formFor === 'new' ? null : circuits.find((c) => c.id === formFor)}
            onDone={() => { setFormFor(null); setFormSection(null) }}
            initialSection={formSection}
          />
        </div>
      )}

      {circuits.length >= 2 && (
        <div style={{ marginTop: 16 }}>
          <p className="card-sub" style={{ marginBottom: 8 }}>Circuit pairs · graded per layer with evidence</p>
          {pairs.length > 0 && (
            <div className="row-list" style={{ marginBottom: 10 }}>
              {pairs.map((p) => (
                <PairCard key={p.id} registry={registry} pair={p} circuits={circuits} />
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <select value={pairSel.a} onChange={(e) => setPairSel({ ...pairSel, a: e.target.value })}>
              <option value="">Circuit A…</option>
              {circuits.map((c) => (
                <option key={c.id} value={c.id}>{cidOf(c)}</option>
              ))}
            </select>
            <select value={pairSel.b} onChange={(e) => setPairSel({ ...pairSel, b: e.target.value })}>
              <option value="">Circuit B…</option>
              {circuits.filter((c) => c.id !== pairSel.a).map((c) => (
                <option key={c.id} value={c.id}>{cidOf(c)}</option>
              ))}
            </select>
            <button className="btn btn-primary" onClick={definePair} disabled={!pairSel.a || !pairSel.b}>Define pair</button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Intake() {
  const s = useStore()
  const eng = activeEngagement(s)
  const [siteName, setSiteName] = useState('')
  const [siteAddress, setSiteAddress] = useState('')
  const [siteCoords, setSiteCoords] = useState('')

  if (!eng) return <DemoIntake />

  const addNewSite = () => {
    if (!siteName.trim()) return
    addSite(siteName.trim(), siteAddress.trim(), siteCoords.trim())
    setSiteName('')
    setSiteAddress('')
    setSiteCoords('')
  }

  return (
    <div>
      <PageHead
        eyebrow="Intake and validation"
        title={`Site intake · ${eng.name}`}
        sub="The site address is the join key for everything downstream. Every layer records where its facts came from — a field without an evidence source cannot support a graded finding."
      />

      <div className="card">
        <p className="card-title">Add site</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input type="text" placeholder="Site name (e.g. DEN-014 · Denver plant)" style={{ flex: 1, minWidth: 180 }} value={siteName} onChange={(e) => setSiteName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addNewSite()} />
          <input type="text" placeholder="Full street address" style={{ flex: 2, minWidth: 220 }} value={siteAddress} onChange={(e) => setSiteAddress(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addNewSite()} />
          <input type="text" className="mono" placeholder="Lat / long (optional)" style={{ flex: 1, minWidth: 150 }} value={siteCoords} onChange={(e) => setSiteCoords(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addNewSite()} />
          <button className="btn btn-primary" onClick={addNewSite}>Add site</button>
        </div>
      </div>

      {eng.sites.length === 0 ? (
        <p className="small muted">No sites yet — add the first site above to begin circuit intake.</p>
      ) : (
        eng.sites.map((site) => (
          <SiteBlock
            key={site.id}
            registry={s.registry}
            site={site}
            circuits={eng.circuits.filter((c) => c.site_id === site.id)}
            pairs={eng.pairs.filter((p) => p.site_id === site.id)}
          />
        ))
      )}
    </div>
  )
}

// --- demo content (shown only when no engagement is active) ---

const demoCircuits = [
  { id: 'CKT-88213', fmt: 'CLCI serialized', carrier: 'Carrier one', access: 'Lit fiber · on-net', entry: 'North vault', status: 'valid', note: 'ID format matches billed carrier; wire center Curtis St confirmed' },
  { id: 'CKT-91077', fmt: 'CLCI serialized', carrier: 'Carrier two', access: 'Fiber · type II leased', entry: 'North vault', status: 'mismatch', note: 'Billed as carrier two but ID format and CLLI indicate underlying carrier one facility — diversity claim suspect' },
  { id: 'CKT-40551', fmt: 'Non-standard', carrier: 'Unknown', access: 'DIA over cable', entry: 'Unrecorded', status: 'invalid', note: 'ID fails all known format checks; no LOA/CFA on file; cannot be scored until validated' },
]

const demoStatusMeta = {
  valid: { pill: 'pill-teal', label: 'Validated' },
  mismatch: { pill: 'pill-amber', label: 'Carrier mismatch' },
  invalid: { pill: 'pill-red', label: 'Unverifiable' },
}

function DemoIntake() {
  const [cid, setCid] = useState('101/T3/DNVRCOMA/CHCGILCD')
  const [result, setResult] = useState(() => parseCircuitId('101/T3/DNVRCOMA/CHCGILCD'))

  return (
    <div>
      <PageHead
        eyebrow="Intake and validation"
        title="Site intake · DEN-014"
        sub="The site address is the join key for everything downstream — geocode, wire center lookup, serviceability. Validation is a hard gate: unvalidated circuits cannot be scored."
      />

      <div className="card" style={{ borderColor: 'var(--teal)' }}>
        <p className="small muted" style={{ margin: 0 }}>
          <strong style={{ color: 'var(--ink)' }}>Demo data.</strong> Create or select an engagement in the Engagements view to begin real circuit intake.
        </p>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <p className="card-title" style={{ margin: 0 }}>DEN-014 · Denver plant</p>
            <p className="small muted" style={{ margin: '2px 0 0' }}>4900 Race St, Denver, CO 80216 · <span className="mono" style={{ fontSize: 12 }}>39.784 / -104.966</span></p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Pill kind="pill-teal">Address validated</Pill>
            <Pill kind="pill-red">Risk score 38 · critical</Pill>
          </div>
        </div>
      </div>

      <div className="card">
        <p className="card-title">Circuit inventory validation</p>
        <p className="card-sub">Circuit IDs parsed, formats detected, and billed carrier cross-checked against the facility the ID actually describes</p>
        <div className="row-list">
          {demoCircuits.map((c) => (
            <div key={c.id} className="row-item">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <span className="mono" style={{ fontWeight: 600, fontSize: 13.5 }}>{c.id}</span>
                <Pill kind={demoStatusMeta[c.status].pill}>{demoStatusMeta[c.status].label}</Pill>
              </div>
              <p className="small muted" style={{ margin: '4px 0 0' }}>{c.fmt} · {c.carrier} · {c.access} · entry: {c.entry}</p>
              <p className="small muted" style={{ margin: '2px 0 0' }}>{c.note}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="two-col" style={{ marginBottom: 16 }}>
        <div className="card" style={{ margin: 0 }}>
          <p className="card-title">North vault · Race St conduit</p>
          <p className="small muted" style={{ margin: '4px 0 0' }}>
            Serves CKT-88213 and CKT-91077. Two circuits, one entrance: a single dig event severs both.
          </p>
          <p className="small danger" style={{ margin: '6px 0 0', fontWeight: 600 }}>Shared entry — single point of failure</p>
        </div>
        <div className="card" style={{ margin: 0 }}>
          <p className="card-title">South vault · 49th Ave conduit</p>
          <p className="small muted" style={{ margin: '4px 0 0' }}>
            Built and unused. Candidate landing point to split the circuit pair across entrances.
          </p>
          <p className="small ok" style={{ margin: '6px 0 0', fontWeight: 600 }}>Available — remediation path exists</p>
        </div>
      </div>

      <div className="card">
        <p className="card-title">Circuit ID parser</p>
        <p className="card-sub">Paste any Telcordia-style serialized circuit ID to detect format, endpoints, and likely carrier</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          <input
            type="text"
            className="mono"
            style={{ flex: 1, minWidth: 260 }}
            value={cid}
            onChange={(e) => setCid(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && setResult(parseCircuitId(cid))}
          />
          <button className="btn btn-primary" onClick={() => setResult(parseCircuitId(cid))}>Parse</button>
        </div>
        <div style={{ background: 'var(--canvas)', borderRadius: 6, padding: '12px 14px', fontSize: 13.5 }}>
          {result.valid ? (
            <>
              <p style={{ margin: '0 0 4px' }}><span className="muted">Format</span> — {result.format}</p>
              <p style={{ margin: '0 0 4px' }}><span className="muted">Serial / prefix</span> — <span className="mono">{result.serial}</span></p>
              <p style={{ margin: '0 0 4px' }}><span className="muted">Facility</span> — {result.facility}</p>
              <p style={{ margin: '0 0 4px' }}><span className="muted">A location</span> — <span className="mono">{result.aLoc.code}</span> ({result.aLoc.place})</p>
              <p style={{ margin: '0 0 4px' }}><span className="muted">Z location</span> — <span className="mono">{result.zLoc.code}</span> ({result.zLoc.place})</p>
              <p style={{ margin: 0 }}><span className="muted">Inference</span> — {result.inference}</p>
            </>
          ) : (
            <p className="warn" style={{ margin: 0 }}>{result.message}</p>
          )}
        </div>
      </div>
    </div>
  )
}
