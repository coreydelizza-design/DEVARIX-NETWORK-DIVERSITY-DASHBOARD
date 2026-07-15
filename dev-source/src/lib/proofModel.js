// The Resilience Proof Ledger: ten proof items with locked ids, labels,
// and coverage modes. Coverage is data — the Proof Center renders from
// this array only. The platform proves facts; it does not certify
// compliance.

export const COVERAGE_MODES = ['verified by platform', 'declared by customer', 'out of scope']

export const PROOF_ITEMS = [
  { id: 'map-services', label: 'Critical services and dependencies mapped', coverage: 'verified by platform', note: '' },
  { id: 'validate-providers', label: 'Provider, subcontractor, location and concentration data validated', coverage: 'verified by platform', note: '' },
  { id: 'identify-spof', label: 'Network and facility single points of failure identified', coverage: 'verified by platform', note: 'identity and application-layer SPOFs out of platform scope' },
  { id: 'failover-tested', label: 'Recovery and failover tested against business tolerances', coverage: 'declared by customer', note: '' },
  { id: 'monitoring-reporting', label: 'Monitoring supports regulatory reporting deadlines', coverage: 'out of scope', note: 'reporting-deadline monitoring is customer-owned; the platform supplies evidence exports only' },
  { id: 'incident-review', label: 'Major incidents and failed changes reviewed for recurring weakness', coverage: 'declared by customer', note: '' },
  { id: 'contract-provisions', label: 'Contracts include audit, incident, testing, portability and exit provisions', coverage: 'declared by customer', note: '' },
  { id: 'exit-tested', label: 'Highest-risk provider exit and transition scenarios tested', coverage: 'declared by customer', note: 'platform quantifies single-carrier capture as a concentration finding' },
  { id: 'gap-reporting', label: 'Management reporting shows unresolved gaps, owners, target dates', coverage: 'verified by platform', note: '' },
  { id: 'evidence-retained', label: 'Evidence retained demonstrating controls, tests and remediation occurred', coverage: 'verified by platform', note: '' },
]

// Customer attestation dates for declared-by-customer items —
// deterministic, and some deliberately stale: an honest gap is a
// feature, not a failure state.
export const DECLARED_DATES = {
  'failover-tested': '2026-03-30',
  'incident-review': '2026-05-14',
  'contract-provisions': '2025-12-01',
  'exit-tested': '2026-06-10',
}
