import { useState } from 'react'
import { parseCircuitId } from '../lib/circuitParser'
import { PageHead, Pill } from '../components/ui'

const circuits = [
  { id: 'CKT-88213', fmt: 'CLCI serialized', carrier: 'Carrier one', access: 'Lit fiber · on-net', entry: 'North vault', status: 'valid', note: 'ID format matches billed carrier; wire center Curtis St confirmed' },
  { id: 'CKT-91077', fmt: 'CLCI serialized', carrier: 'Carrier two', access: 'Fiber · type II leased', entry: 'North vault', status: 'mismatch', note: 'Billed as carrier two but ID format and CLLI indicate underlying carrier one facility — diversity claim suspect' },
  { id: 'CKT-40551', fmt: 'Non-standard', carrier: 'Unknown', access: 'DIA over cable', entry: 'Unrecorded', status: 'invalid', note: 'ID fails all known format checks; no LOA/CFA on file; cannot be scored until validated' },
]

const statusMeta = {
  valid: { pill: 'pill-teal', label: 'Validated' },
  mismatch: { pill: 'pill-amber', label: 'Carrier mismatch' },
  invalid: { pill: 'pill-red', label: 'Unverifiable' },
}

export default function Intake() {
  const [cid, setCid] = useState('101/T3/DNVRCOMA/CHCGILCD')
  const [result, setResult] = useState(() => parseCircuitId('101/T3/DNVRCOMA/CHCGILCD'))

  return (
    <div>
      <PageHead
        eyebrow="Intake and validation"
        title="Site intake · DEN-014"
        sub="The site address is the join key for everything downstream — geocode, wire center lookup, serviceability. Validation is a hard gate: unvalidated circuits cannot be scored."
      />

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
          {circuits.map((c) => (
            <div key={c.id} className="row-item">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <span className="mono" style={{ fontWeight: 600, fontSize: 13.5 }}>{c.id}</span>
                <Pill kind={statusMeta[c.status].pill}>{statusMeta[c.status].label}</Pill>
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
