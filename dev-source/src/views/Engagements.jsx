import { useRef, useState } from 'react'
import {
  useStore, createEngagement, renameEngagement, selectEngagement,
  exportEngagement, exportRegistry, importEngagement, registryCount,
} from '../lib/store'
import { PageHead, Metric, Pill } from '../components/ui'

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

export default function Engagements() {
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
        eyebrow="Engagement workspace"
        title="Engagements"
        sub="Each audit engagement is a separate client workspace stored in this browser. The registry — canonical CLLIs, carriers, vendors — is shared across engagements and compounds with every audit."
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

      <div className="card">
        <p className="card-title">Transfer</p>
        <p className="card-sub">
          Engagement files are self-contained JSON (client data + registry). The registry export carries only
          canonical entities — no client data, no grades — for seeding the next engagement.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button className="btn btn-primary" onClick={() => fileRef.current.click()}>Import engagement…</button>
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
