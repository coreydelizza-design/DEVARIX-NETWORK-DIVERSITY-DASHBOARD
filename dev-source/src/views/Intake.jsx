import { useState } from 'react'
import { parseCircuitId } from '../lib/circuitParser'
import { normalizeKey, makeCircuit, transportMediums, serviceTypes } from '../lib/schema'
import { useStore, activeEngagement, addSite, updateSite, saveCircuit, addRegistryEntity } from '../lib/store'
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
}

function CircuitForm({ registry, site, circuit, onDone }) {
  const [f, setF] = useState(() => {
    if (!circuit) return emptyForm
    const id = circuit.layers.identity
    const loop = circuit.layers.loop
    return {
      circuitId: id.circuit_id || '',
      carrierText: entityLabel(registry, 'carrier', id.carrier_ref),
      serviceType: id.service_type || '',
      medium: id.access_medium || '',
      identityEvidence: id.evidence_source || '',
      accessType: loop.access_type || 'onnet',
      providerText: entityLabel(registry, 'accessVendor', loop.access_provider_ref),
      accessCircuitId: loop.access_circuit_id || '',
      clliText: (registry.clli.find((e) => e.id === loop.wire_center_ref) || {}).key || '',
      loopEvidence: loop.evidence_source || '',
    }
  })
  const [parsed, setParsed] = useState(null)
  const [notice, setNotice] = useState('')
  const set = (patch) => setF((prev) => ({ ...prev, ...patch }))

  const onCircuitId = (v) => {
    const p = parseCircuitId(v)
    setParsed(p.valid ? p : null)
    // CLCI-coded ids carry the serving wire center as the A-location CLLI.
    set(p.valid ? { circuitId: v, clliText: p.aLoc.code.substring(0, 6) } : { circuitId: v })
  }

  const save = () => {
    if (!f.circuitId.trim()) return setNotice('Circuit ID is required.')
    const carrier = resolveEntity(registry, 'carrier', f.carrierText)
    if (!carrier.ok) return setNotice('Carrier not in registry — use Add carrier to create it first.')
    const provider = f.accessType === 'type2' ? resolveEntity(registry, 'accessVendor', f.providerText) : { ok: true, ref: null }
    if (!provider.ok) return setNotice('Access provider not in registry — use Add vendor to create it first.')

    let clliRef = null
    const k = normalizeKey(f.clliText)
    if (k) {
      const ent = registry.clli.find((e) => e.key === k) || addRegistryEntity('clli', k, k)
      clliRef = ent.id
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
          wire_center_ref: clliRef,
          evidence_source: f.loopEvidence.trim(),
        },
      },
    }
    saveCircuit(next)
    onDone()
  }

  return (
    <div className="card" style={{ background: 'var(--canvas)' }}>
      <p className="card-title">{circuit ? 'Edit circuit' : 'New circuit'} · {site.name}</p>

      <p className="card-sub" style={{ marginTop: 10 }}>Identity layer</p>
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
        <p className="small ok" style={{ margin: '0 0 6px 212px' }}>
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

      <p className="card-sub" style={{ marginTop: 14 }}>Local loop layer</p>
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

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12 }}>
        <button className="btn btn-primary" onClick={save}>Save circuit</button>
        <button className="btn" onClick={onDone}>Cancel</button>
        {notice && <span className="small danger">{notice}</span>}
      </div>
    </div>
  )
}

function SiteBlock({ registry, site, circuits }) {
  const [editing, setEditing] = useState(false)
  const [fields, setFields] = useState({ name: site.name, address: site.address })
  const [formFor, setFormFor] = useState(null) // null | 'new' | circuit id

  const mediumLabel = (id) => (transportMediums.find((m) => m.id === id) || {}).label || ''

  return (
    <div className="card">
      {editing ? (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
          <input type="text" style={{ flex: 1, minWidth: 160 }} value={fields.name} onChange={(e) => setFields({ ...fields, name: e.target.value })} />
          <input type="text" style={{ flex: 2, minWidth: 220 }} value={fields.address} onChange={(e) => setFields({ ...fields, address: e.target.value })} />
          <button className="btn btn-primary" onClick={() => { updateSite(site.id, fields); setEditing(false) }}>Save</button>
          <button className="btn" onClick={() => setEditing(false)}>Cancel</button>
        </div>
      ) : (
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
          <div>
            <p className="card-title" style={{ margin: 0 }}>{site.name}</p>
            <p className="small muted" style={{ margin: '2px 0 0' }}>{site.address || 'No address recorded'}</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={() => { setFields({ name: site.name, address: site.address }); setEditing(true) }}>Edit site</button>
            <button className="btn btn-primary" onClick={() => setFormFor('new')}>Add circuit</button>
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
                    <button className="btn" style={{ padding: '5px 10px', fontSize: 13 }} onClick={() => setFormFor(c.id)}>Edit</button>
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
              </div>
            )
          })}
        </div>
      )}

      {formFor && (
        <div style={{ marginTop: 12 }}>
          <CircuitForm
            registry={registry}
            site={site}
            circuit={formFor === 'new' ? null : circuits.find((c) => c.id === formFor)}
            onDone={() => setFormFor(null)}
          />
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

  if (!eng) return <DemoIntake />

  const addNewSite = () => {
    if (!siteName.trim()) return
    addSite(siteName.trim(), siteAddress.trim())
    setSiteName('')
    setSiteAddress('')
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
          <button className="btn btn-primary" onClick={addNewSite}>Add site</button>
        </div>
      </div>

      {eng.sites.length === 0 ? (
        <p className="small muted">No sites yet — add the first site above to begin circuit intake.</p>
      ) : (
        eng.sites.map((site) => (
          <SiteBlock key={site.id} registry={s.registry} site={site} circuits={eng.circuits.filter((c) => c.site_id === site.id)} />
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
