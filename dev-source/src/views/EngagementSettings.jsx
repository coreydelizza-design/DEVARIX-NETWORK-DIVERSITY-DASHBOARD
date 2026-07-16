import { useRef, useState } from 'react'
import {
  useStore, createEngagement, renameEngagement, selectEngagement,
  exportEngagement, exportRegistry, importEngagement, registryCount,
  setEngagementDoc, addCarrierRequest, setRequestItem,
} from '../lib/store'
import { ENGAGEMENT_DOCS, DOC_STATUS, ASK_LIST, REQUEST_STATUS, normalizeKey } from '../lib/schema'
import { PageHead, Metric, Pill } from '../components/ui'

function DocIndicators({ documents }) {
  return (
    <span style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap' }}>
      {ENGAGEMENT_DOCS.map((d) => {
        const st = ((documents || {})[d.id] || {}).status || 'missing'
        return <Pill key={d.id} kind={DOC_STATUS[st].pill}>{d.label}</Pill>
      })}
    </span>
  )
}

function EngagementWorkflow({ registry, eng }) {
  const docs = eng.documents || {}
  const requests = eng.requests || []
  const [carrierText, setCarrierText] = useState('')

  const carrierLabel = (ref) => (registry.carrier.find((c) => c.id === ref) || {}).label || ref
  const carrierMatch = registry.carrier.find(
    (c) => c.key === normalizeKey(carrierText) || c.label.toLowerCase() === carrierText.trim().toLowerCase()
  )

  const elapsed = Math.max(0, Math.floor((new Date() - new Date(eng.created_date)) / 86400000))
  const pct = Math.min(100, (elapsed / 90) * 100)

  return (
    <>
      <div className="card">
        <p className="card-title">Engagement documents</p>
        <p className="card-sub">The LOA is the engine of the audit — no records demands without it; the NDA typically gates KMZ release</p>
        {ENGAGEMENT_DOCS.map((d) => {
          const st = (docs[d.id] || {}).status || 'missing'
          return (
            <div key={d.id} className="crit-row">
              <span className="crit-label"><strong style={{ color: 'var(--ink)' }}>{d.label}</strong> · {d.full}</span>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                {Object.entries(DOC_STATUS).map(([k, meta]) => (
                  <button key={k} className={`btn ${st === k ? 'btn-primary' : ''}`} style={{ padding: '4px 10px', fontSize: 13 }} onClick={() => setEngagementDoc(d.id, k)}>
                    {meta.label}
                  </button>
                ))}
                {(docs[d.id] || {}).date && <span className="small faint mono">{docs[d.id].date}</span>}
              </div>
            </div>
          )
        })}
      </div>

      <div className="card">
        <p className="card-title">Engagement timeline</p>
        <p className="card-sub">A Diversity Assurance Audit runs 60–90 days from kickoff</p>
        <div className="bar-track" style={{ height: 10, borderRadius: 5, position: 'relative' }}>
          <div className="bar-fill" style={{ width: `${pct}%`, background: elapsed > 90 ? 'var(--red)' : 'var(--teal)' }} />
          <div style={{ position: 'absolute', left: `${(60 / 90) * 100}%`, top: -2, bottom: -2, width: 2, background: 'var(--muted)' }} title="Day 60" />
        </div>
        <p className="small muted" style={{ margin: '6px 0 0' }}>
          Day {elapsed} · started {eng.created_date} · day-60 marker shown; day 90 is the outer bound{elapsed > 90 ? ' — engagement is past its window' : ''}
        </p>
      </div>

      <div className="card">
        <p className="card-title">Carrier records requests</p>
        <p className="card-sub">The 8-item ask list per carrier, demanded under LOA. Received items become selectable evidence references when grading.</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          <input type="text" list="req-carriers" placeholder="Carrier to request records from…" style={{ flex: 1, minWidth: 220 }} value={carrierText} onChange={(e) => setCarrierText(e.target.value)} />
          <datalist id="req-carriers">
            {registry.carrier.map((c) => (
              <option key={c.id} value={c.label} />
            ))}
          </datalist>
          <button className="btn btn-primary" disabled={!carrierMatch} onClick={() => { addCarrierRequest(carrierMatch.id); setCarrierText('') }}>
            Open request
          </button>
        </div>
        {requests.length === 0 ? (
          <p className="small muted" style={{ margin: 0 }}>No carrier requests opened yet.</p>
        ) : (
          requests.map((r) => {
            const received = ASK_LIST.filter((a) => r.items[a.id].status === 'received').length
            return (
              <div key={r.id} style={{ border: '1px solid var(--line)', borderRadius: 6, padding: '10px 12px', marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{carrierLabel(r.carrier_ref)}</span>
                  <Pill kind={received === ASK_LIST.length ? 'pill-teal' : 'pill-amber'}>{received}/{ASK_LIST.length} received</Pill>
                </div>
                {ASK_LIST.map((a) => {
                  const item = r.items[a.id]
                  return (
                    <div key={a.id} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', padding: '5px 0', borderTop: '1px solid var(--line)' }}>
                      <span className="small" style={{ flex: '0 0 220px', fontWeight: 600 }}>{a.label}</span>
                      <select value={item.status} onChange={(e) => setRequestItem(r.id, a.id, e.target.value)} style={{ flex: '0 0 150px' }}>
                        {Object.entries(REQUEST_STATUS).map(([k, meta]) => (
                          <option key={k} value={k}>{meta.label}</option>
                        ))}
                      </select>
                      <Pill kind={REQUEST_STATUS[item.status].pill}>{REQUEST_STATUS[item.status].label}</Pill>
                      <span className="small faint mono">
                        {item.requested_date && `req ${item.requested_date}`}
                        {item.received_date && ` · rcvd ${item.received_date}`}
                      </span>
                    </div>
                  )
                })}
              </div>
            )
          })
        )}
      </div>
    </>
  )
}

function download(filename, text) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

function slug(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'engagement'
}

export default function EngagementSettings() {
  const s = useStore()
  const [name, setName] = useState('')
  const [client, setClient] = useState('')
  const [editing, setEditing] = useState(null)
  const [notice, setNotice] = useState('')
  const fileRef = useRef(null)

  const create = () => {
    if (!name.trim()) return
    createEngagement(name.trim(), client.trim())
    setName('')
    setClient('')
    setNotice('')
  }

  const saveEdit = () => {
    renameEngagement(editing.id, editing.name.trim(), editing.client.trim())
    setEditing(null)
  }

  const onImport = (e) => {
    const file = e.target.files[0]
    e.target.value = ''
    if (!file) return
    file.text().then((text) => {
      try {
        importEngagement(text)
        setNotice('Engagement imported.')
      } catch (err) {
        setNotice(`Import failed: ${err.message}`)
      }
    })
  }

  return (
    <div>
      <PageHead
        eyebrow="Engagement settings"
        title="Engagement settings"
        sub="Client record, documents, records-request tracker, and import/export for the active engagement. The registry — canonical CLLIs, carriers, elements — is shared across engagements and compounds with every audit."
      />

      <div className="metric-grid">
        <Metric label="Engagements" value={s.engagements.length} />
        <Metric label="Registry entities" value={registryCount(s)} />
        <div className="metric">
          <p className="metric-label">Active engagement</p>
          <p style={{ margin: 0 }}>
            {s.active_engagement_id
              ? <Pill kind="pill-teal">{(s.engagements.find((e) => e.id === s.active_engagement_id) || {}).name}</Pill>
              : <Pill kind="pill-gray">None selected</Pill>}
          </p>
        </div>
      </div>

      <div className="card">
        <p className="card-title">New engagement</p>
        <p className="card-sub">Name the engagement and the client it belongs to</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="Engagement name (e.g. ACME Q3 diversity audit)"
            style={{ flex: 2, minWidth: 220 }}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && create()}
          />
          <input
            type="text"
            placeholder="Client name"
            style={{ flex: 1, minWidth: 140 }}
            value={client}
            onChange={(e) => setClient(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && create()}
          />
          <button className="btn btn-primary" onClick={create}>Create</button>
        </div>
      </div>

      <div className="card">
        <p className="card-title">Engagements in this browser</p>
        {s.engagements.length === 0 ? (
          <p className="small muted" style={{ margin: 0 }}>None yet. Create one above or import an engagement file.</p>
        ) : (
          <div className="row-list">
            {s.engagements.map((e) => (
              <div key={e.id} className="row-item">
                {editing && editing.id === e.id ? (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <input
                      type="text"
                      style={{ flex: 2, minWidth: 200 }}
                      value={editing.name}
                      onChange={(ev) => setEditing({ ...editing, name: ev.target.value })}
                    />
                    <input
                      type="text"
                      style={{ flex: 1, minWidth: 120 }}
                      value={editing.client}
                      onChange={(ev) => setEditing({ ...editing, client: ev.target.value })}
                    />
                    <button className="btn btn-primary" onClick={saveEdit}>Save</button>
                    <button className="btn" onClick={() => setEditing(null)}>Cancel</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{e.name}</span>
                      <div className="small muted">
                        {e.client.name || 'No client set'} · created {e.created_date} · {e.sites.length} sites · {e.pairs.length} pairs
                      </div>
                      <div style={{ marginTop: 4 }}>
                        <DocIndicators documents={e.documents} />
                      </div>
                    </div>
                    {e.id === s.active_engagement_id ? (
                      <Pill kind="pill-teal">Active</Pill>
                    ) : (
                      <button className="btn" onClick={() => selectEngagement(e.id)}>Select</button>
                    )}
                    <button className="btn" onClick={() => setEditing({ id: e.id, name: e.name, client: e.client.name })}>
                      Rename
                    </button>
                    <button className="btn" onClick={() => download(`devarix-${slug(e.name)}.json`, exportEngagement(e.id))}>
                      Export
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {s.active_engagement_id && (
        <EngagementWorkflow
          registry={s.registry}
          eng={s.engagements.find((e) => e.id === s.active_engagement_id)}
        />
      )}

      <div className="card">
        <p className="card-title">Transfer</p>
        <p className="card-sub">
          Engagement files are self-contained JSON (client data + registry). The registry export carries only
          canonical entities — no client data, no grades — for seeding the next engagement.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button className="btn btn-primary" onClick={() => fileRef.current.click()}>Import engagement JSON…</button>
          <span style={{ border: '1px dashed var(--line-strong)', borderRadius: 6, padding: '4px 10px' }} className="small muted">XLSX workbook import lands with the intake template — use JSON today <Pill kind="pill-gray">XLSX · soon</Pill></span>
          <button className="btn" onClick={() => download('devarix-registry.json', exportRegistry())}>Export registry</button>
          <input ref={fileRef} type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={onImport} />
          {notice && <span className="small muted">{notice}</span>}
        </div>
      </div>

      <p className="small faint" style={{ maxWidth: '70ch' }}>
        Data lives in this browser's localStorage under a versioned schema. Export before clearing browser data or
        switching machines.
      </p>
    </div>
  )
}
