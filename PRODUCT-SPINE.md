# PRODUCT-SPINE.md
Version 1.2 · July 2026 · This document governs every build session. Read it before writing code. If an instruction in any prompt conflicts with this document, STOP on that item and report the conflict — do not improvise architecture.

v1.1 change: the unit of capture is the L1–L3 infrastructure element graph, not circuit pairs. Pairs are a derived analysis lens.
v1.2 change: three-ring ontology, capture modes, promotion-on-collision, adjacent-infrastructure tag, evidence-state synonyms. Full reference ontology lives at docs/ONTOLOGY-L1-L3.md (non-binding for capture).

---

## 1 · Positioning and perimeter

**Category:** Infrastructure Dependency Assurance.
**Mechanism (the differentiator):** Shared-Fate Intelligence — capturing an enterprise's L1–L3 infrastructure as an element graph and determining whether apparently separate services secretly depend on the same physical route, building entrance, conduit, access provider, wire center, NNI, POP or carrier hotel, backbone, ASN, facility hardware (HA posture), or carrier-controlled evidence chain.
**Identity (four layers, priced separately, never collapsed):** Platform · Methodology · Registry · Managed assurance service. This is not self-service SaaS alone; professional intervention is the product, not a workaround.

**Services perimeter.** The following depend on supplied evidence, carrier cooperation, professional review, external data, or site work — the platform structures this work, it does not replace it: physical route validation; entrance-facility independence; KMZ and route-record interpretation; underground/aerial path-separation validation; currency of carrier records; reconciliation of contradictory provider evidence; investigation of unknowns; remediation-design validation. This perimeter is restated in every SOW and in the deliverable's methodology preface.

**Prohibited claims.** The brand never claims: continuous live telemetry · automated physical-route discovery · automated validation of all carrier assertions · "AI-powered analysis" · regulatory certification · guaranteed circuit independence · full application/cyber/identity/business-service resilience · a completed multi-tenant enterprise platform · a formal independent audit opinion. Approved substitute phrasings live in the claims register (Prohibited Claims section). The always-safe formulations: "point-in-time verification with defined validity windows"; "evidence-graded findings with source attribution"; "AI-assisted, human-verified capture; deterministic, auditable scoring"; "verified as of date, to stated provenance, with unknowns enumerated."

---

## 2 · Operating rules

1. **One app.** There is no demo/engagement mode split. The app always operates inside an open engagement. The demo is a seeded, read-only, watermarked engagement named "Sample — Meridian Industrial (synthetic)" available in the engagement picker, flagged `sample: true`, excluded from export, and visually watermarked on screen and in print.
2. **Capture-first.** This is a capture-and-scoring workbench for L1–L3 infrastructure. Bulk import (workbook/JSON) is ONE capture method; manual capture from LOA responses, carrier documents, interviews, site walks, and network observations is the primary ongoing workflow. Every field is enterable everywhere it appears.
3. **No naked facts.** A fact cannot be saved without: value · source (from the engagement's evidence inventory: carrier response, document ref, interview, observation, client declaration) · provenance grade · date. Capture and evidence-linking are the same gesture.
4. **Missing is a captured state.** Unknown always carries a reason: not yet requested · requested-pending (date + carrier) · carrier declined/unable · not applicable · client cannot say. Pending items age against the carrier clock; declined items are findings.
5. **Conflicts are first-class.** Source-vs-source contradictions on any element or edge are surfaced, never silently overwritten. Adjudication (which source prevailed, why, by whom, when) is itself a recorded fact.
6. **Deterministic scoring.** Scores, verdicts, shared-fate determinations, and derived labels are computed at render time from the stored graph. No stored verdicts, no stored scores, no model-generated numbers. LLMs may assist capture and drafting; they never score.
7. **Two honest numbers everywhere.** Score (measurement) and coverage (% of applicable facts captured) travel together. Verdict color encodes conformance, never raw score.
8. **Evidence decays.** Every evidenced fact carries a validity window; staleness degrades provenance (never outcome) and feeds the worklist and, later, the refresh/monitoring tier.

---

## 3 · Object model: the L1–L3 element graph

**Spine:** Engagement → Site → Service (circuit/connection) → Dependency edges → **Elements**. Shared fate is a computed property of the graph, never a stored table.

**Elements (nodes)** — the infrastructure inventory, organized by layer:
- **L1 · Physical:** entrance facility / vault / conduit segment · fiber route segment (KMZ-referenced) · serving wire center (CLLI) · POP / carrier hotel (address + floor/suite) · colo or data center facility · power feed · hardware chassis (router/switch; HA-required y/n, HA-actual y/n)
- **L2 · Transport:** access loop · Ethernet/wave service · NNI (location CLLI + ID) · backbone transport segment · MMR cross-connect
- **L3 · Network:** ASN · BGP posture / observed AS path · IP egress · cloud on-ramp / direct connect

Elements are registry entities: engagement-independent, deduped by canonical key (CLLI, ASN, normalized address, facility+floor, NNI ID). Free-text element entry is forbidden — capture either matches an existing element or mints one with a canonical key.

**Dependencies (edges):** a service traverses elements (`service —traverses→ element`); elements may nest (`element —within→ element`, e.g. suite within carrier hotel) and group into shared risk groups (same building, same conduit corridor, same power domain).

**Facts** attach to elements and edges. A fact carries: `value` · `outcome` (where applicable — diverse / shared / unknown) · `provenance` (inferred / declared / documented / verified) · `sourceRef` (into the engagement's evidence inventory) · `capturedDate` · `validityDays` · `missingReason?` (when unknown) · `conflictState?` · `adjudication?`. No naked facts: the write API rejects any fact lacking source + provenance + date.

**Three rings (the anti-CMDB rule — the ontology is vocabulary, never a capture requirement):**
- **Core ring (~25 types):** always captured, drives scoring — entrance facility/vault/conduit, riser, serving wire center, carrier PoP/hotel, fiber route segment, access provider + underlying provider, access loop, NNI, backbone span, ASN/egress, cloud region/AZ, cloud interconnect port + facility, router/firewall/SD-WAN chassis (HA-required/HA-actual), A/B power feed, transit/egress gateway.
- **Extended ring:** captured only when evidence surfaces or tier requires (L2 detail, optical inventory, modules/line cards, cloud networking internals, EoS/EoL dates).
- **Adjacent ring:** tagged `adjacent`, never labeled L1–L3 — control plane, orchestrators, DNS/NTP/identity, management systems. Note-level capture; shared adjacent dependencies are a named finding class.

**Capture modes per catalog type:** `element` (graph node with canonical key) · `attribute` (field on parent element) · `flag` (Y/N checklist item on parent) · `note`. **Promotion on collision:** a note/attribute (e.g. a splice enclosure named on a route) is promoted to a full element the moment two supposedly independent paths reference the same value, carrying the shared-fate relation with it. The graph grows exactly where risk lives.

The catalog is data: `lib/elementTypes.js` — `{id, name, layer, ring, captureMode, canonicalKey?, sharedFateDimensions, promotionRule?}` — seeded fully for the core ring, catalog-only for the rest.

**Evidence-state synonyms:** external documents' four states map onto the two-axis model for display only — Verified = verified · Provider-claimed = declared · Inferred = inferred · Unknown = unknown outcome. No third vocabulary may enter the codebase.

**Derived, never stored:** shared-fate determinations (N services sharing an element or risk group, at any layer); pairwise comparisons (a lens: filter the graph to two services); per-site scores and verdicts (domains are views over layer groupings; tier requirements express required independence per layer — e.g. T1: no shared L1 elements across primary delivery paths; T3: L1 sharing acceptable given diverse-media L2 backup); legacy grade labels (VERIFIED_DIVERSE etc.) derived from outcome × provenance for report copy. Cross-examination is element-collision detection over the graph plus source-vs-source conflict checks, generalizing the original seven pairwise checks.

Confirmed shared-fate relations write to the registry namespace as `{elementId(s), layer, relation, evidenceRef, engagementId, date}` — the compounding asset.

---

## 4 · Nav contract and screen inventory

Navigation is four nouns plus the engagement picker. Every screen names its object. No screen ships that "illustrates a concept" without operating on an object.

| Screen | Operates on | Contains | Explicitly absorbs |
|---|---|---|---|
| Sites | The engagement's site set (built for 1,000 rows) | Search, column sort, filters (region/tier/verdict/coverage/freshness), pagination or virtualization, bulk-status bar, CSV of current filter | Old Portfolio/dashboard |
| Site (tabs) | One site | **Overview:** identity, tier, verdict, score + coverage, top shared-fate findings. **Infrastructure & evidence:** the site's services and the L1–L3 elements they traverse, capture-enabled at every cell; element-collision (shared-fate) proposals and conflict queue in context; aging badges. **Simulate:** hypothesis controls seeded from actuals, delta strip, verdict/score/payback deltas, reset-to-actual | Site drill-down, standalone Scorer, standalone TCO, pair grade matrix |
| Evidence queue | The engagement's open work | Missing-by-reason worklist, pending requests aging vs carrier clock, conflicts awaiting adjudication, expiring evidence | RefreshQueue (until monitoring tier exists) |
| Deliverable | The engagement's findings | Methodology preface (services perimeter), executive summary (score + coverage + derived-grade counts), proof ledger, shared-fate findings by layer with sources, per-site element tables, cost-of-inertia, gap register, unknowns-with-reasons annex; print stylesheet; SAMPLE watermark on the sample engagement | Proof Center, FindingsReport, Reports |
| Engagement settings | One engagement | Client record, workbook/JSON import, LOA + NDA status, per-carrier records-request tracker (8-item ask list), timeline | Old Engagements + Intake-as-destination |

Simulate is the ONLY surface where hypothesis is entered; everywhere else, entry is capture with source discipline.

---

## 5 · Governance

1. **Screen test:** every surface must either capture an L1–L3 element or fact, score the graph, or report it. If it does none, it does not ship.
2. **Trigger rule:** every build prompt names its triggering business event in the header (e.g., "Demo must sell engagement #1," "Engagement #1 reaches month 10"). No event, no prompt.
3. **Session protocol:** every Claude Code session reads this file first; conflicts stop the run with a report, and completed runs print an acceptance checklist with pass/fail plus a MOVED/MERGED/DELETED map.
4. **One feature set per prompt.** Reconciliation sessions are labeled as such and prefer moves/merges over rewrites.
5. **Build hygiene:** `npm run build:deploy` regenerates the root single-file `index.html`; a session is not complete until it passes and the bundle is confirmed regenerated. No new dependencies without a named reason in the prompt.
6. **Vocabulary is locked** by this document and the claims register. New terms require editing this file in the same PR, so drift is visible in diff.

---

## Backlog triggers (reference)

| Item | Trigger |
|---|---|
| Spine rebuild (element-graph schema migration, Sites index, Site tabs, capture workbench, Deliverable restore w/ sample engagement) | Demo must sell engagement #1 |
| XLSX intake template + real import | First prospect says yes |
| Expiry engine + refresh surfaces | Engagement #1 ~month 10 |
| Branding config | Inside-vs-independent fork decision |
| Registry carry-forward + CLLI dataset | Engagement #2 pending, NDA carve-out final |
| Monitoring mode | First standing-LOA / refresh-pack customer |
