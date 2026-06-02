# Plan: wire supplier ESG survey results into the brand's B Corp certification

Goal: when a brand (e.g. Everleaf) sends the ESG self-assessment to its suppliers and
those suppliers complete it, the results should feed the brand's own B Corp 2026
certification readiness on alkatera, as supply-chain due-diligence evidence.

This is the "v2 bonus" already anticipated in `lib/supplier-esg/attestation-types.ts`
("as the supplier ESG form gains adoption, those scores will layer on top").

## How the two systems work today (verified)

B Corp certification:
- Experience at `/certifications/[code]` (code `bcorp_2026`), gated by `bcorp_tracking`.
  Orchestrator: `components/certifications/BcorpExperience.tsx`.
- Requirements live in `certification_framework_requirements` (+ synced
  `framework_requirements`); pass/fail per requirement across year bands 0/3/5.
- **Integration seam:** `lib/certifications/platform-data.ts` maps a requirement code
  to a `query(supabase, orgId)` returning `{ found, completeness, completenessNote, items }`
  (`Completeness = 'complete' | 'partial' | 'missing'`).
- Nightly cron `app/api/cron/refresh-auto-evidence` calls `queryPlatformEvidence` for every
  mapped code, writes `certification_auto_evidence` rows (status `suggested`), and recomputes
  readiness. `computePlatformHealth` aggregates module completeness for the health score.
- TWO requirements already map to suppliers but only check *presence* of supplier rows:
  - `IT4-Y0-002` Human Rights — forced/child labour + supply-chain due diligence (Year 0)
  - `IT4-Y3-001` Human Rights — due diligence (Year 3)

Supplier ESG survey:
- `supplier_esg_assessments` (one row per `suppliers.id`): `answers` jsonb; per-section scores
  `score_labour/environment/ethics/health_safety/management` (0-100); `score_total`;
  `score_rating` (`leader`/`progressing`/`needs_improvement`/`not_assessed`); `submitted`;
  `is_verified` + `verified_by/at/notes` (alkatera-admin verified).
- Scoring: `lib/supplier-esg/scoring.ts` (yes=2, partial=1, no=0, na=excluded; rating leader>=75,
  progressing 50-74, needs_improvement <50).
- Four newest questions are B Corp-aligned: `lhr_11` (living income in supply chain),
  `lhr_12` (country/site-level human-rights & living-wage risk), `env_11` (Scope 3),
  `env_12` (science-based 1.5C target).
- Brand reads a single supplier's result via `/api/suppliers/detail` (service-role + org context),
  surfaced on the supplier detail ESG tab via `hooks/data/useOrganizationSupplierDetail.ts`.
- Org-level precedent already exists: `app/api/vitality/composite` counts
  `suppliers_with_esg_form / suppliers_total` and feeds the Social pillar.
- Coverage is naturally org-scoped: `supplier_esg_assessments.supplier_id -> suppliers.id`,
  and `suppliers.organization_id` is the brand. The `supplier_tier` column we just added
  (`tier_1/2/3`) lets us prioritise DIRECT suppliers, exactly as B Corp human-rights due
  diligence expects.

## Design decisions (recommended defaults; confirm before build)

1. **Coverage denominator = Tier 1 (direct) suppliers** (`suppliers.supplier_tier = 'tier_1'`).
   Fallback to all suppliers when no tiers are set, and nudge the brand to classify tiers.
   Rationale: B Corp focuses due diligence on the highest-risk, most-direct suppliers.
2. **Audit-grade "complete" requires VERIFIED assessments** (`is_verified = true`), not merely
   `submitted`. Submitted-but-unverified counts as `partial`. This keeps self-reported data from
   inflating a certifiable status, and reuses the existing admin verification queue.
3. **Completeness thresholds** (configurable constant):
   - `missing`: 0 assessed suppliers
   - `partial`: some assessed, but verified coverage < target (default 80%) OR only submitted
   - `complete`: >= 80% of Tier-1 suppliers VERIFIED
4. **The 4 B Corp questions** map as supplementary evidence: `lhr_11`/`lhr_12` -> IT4 (human
   rights); `env_11`/`env_12` -> IT5 (climate, value-chain) as ADDITIVE supply-chain signal,
   never replacing the org's own emissions/targets evidence.

## Decisions confirmed (Tim, 2026-06-02)
- Denominator: Tier-1, fallback to all. Threshold: 80%. Gate: SUBMITTED is enough
  (verified shown as stronger signal, not gating). Climate: env_11/env_12 -> IT5 NOW.

## STATUS: Phase 1 SHIPPED & verified (2026-06-02)
- New `lib/certifications/supplier-esg-evidence.ts`: pure `summariseSupplierEsg` (IT4) +
  `summariseSupplierClimate` (IT5 Scope 3) + DB fetch helpers. Tier-1 denominator w/ all-suppliers
  fallback, submitted=assessed, 80% threshold, verified tracked for display.
- `lib/certifications/platform-data.ts`: `IT4-Y0-002` + `IT4-Y3-001` now backed by supplier ESG
  coverage (per-supplier evidence items for auditor traceability); NEW `IT5-Y3-001` (Scope 3)
  mapping backed by supplier value-chain climate engagement (env_11/env_12), clearly supplementary.
  The existing nightly cron + readiness/health pick these up automatically. No new tables/migration.
- Tests: `lib/certifications/__tests__/supplier-esg-evidence.test.ts` (9 cases, all pass).
- typecheck + eslint (touched files) + build all green.
- Confirmed real requirement codes from seed: IT4-Y0-001/002, IT4-Y3-001, IT4-Y5-001;
  IT5-Y0-001/002, IT5-Y3-001 (Scope 3, was unmapped), IT5-Y3-002, IT5-Y5-001.
- Note/optimisation: the 3 supplier mappings each refetch supplier rows per cron run (small N,
  nightly — fine; memoise per (org) later if needed). IT5-Y3-001 groups under the "Suppliers"
  module in platform-health (source-accurate).

## STATUS: Phase 2 SHIPPED & verified (2026-06-02)
- Read API `app/api/certifications/supplier-esg-coverage/route.ts`: GET, auth via
  getSupabaseAPIClient (returns a service-role DB client after verifying the user, so it can read
  the RLS-protected supplier_esg_assessments), org-scoped via resolveUserOrganization. Returns
  `{ esg, climate }` coverage summaries + per-supplier breakdown.
- `components/certifications/SupplyChainEsgCard.tsx`: coverage headline + status badge + Progress,
  rating distribution, avg labour/ethics, value-chain climate (Scope 3) line, "suppliers to follow
  up", and a "Send ESG survey" CTA reusing SendEsgSurveyDialog (refetches on send) + link to
  /suppliers. Empty state when no suppliers. Client component; types declared locally (the helper
  module is server-only).
- Slotted into `BcorpExperience.tsx` gap-analysis tab (active-certification branch), after the
  GapAnalysisView. One import + one line.
- Per-supplier evidence traceability (plan item 3): already delivered by Phase 1 — the cron emits
  per-supplier auto-evidence rows that flow through the existing accept -> certification_evidence_links
  path. No separate writer needed.
- The "nudge" lives in-context as the card's Send CTA (better placed than a global dashboard tile).
  NOTE: there is no generatePriorityActions in lib/dashboard-guide.ts (only the onboarding tour),
  so a global dashboard tile would need new plumbing — deferred as an optional follow-up.
- Verified: typecheck + eslint (touched files) + build all green. Runtime not exercised locally
  (local env points at prod; needs a live session + a B Corp cert), consistent with prior phases.

## STATUS: Phase 3 (3.1 + 3.2) SHIPPED & verified (2026-06-02); 3.3 recommended for deferral
- 3.1 Question tagging + meaningful use:
  - `EsgQuestion.bcorpRequirement` added; lhr_11/lhr_12 -> IT4-Y3-001, env_11/env_12 -> IT5-Y3-001.
    Helper `getBcorpQuestionIds(code)` in questions.ts.
  - IT4-Y3-001 now uses the tags: Year-3 due-diligence coverage counts ONLY suppliers who affirm a
    deeper due-diligence practice (living income lhr_11 / country-level risk lhr_12), a higher bar
    than IT4-Y0-002's basic submitted coverage. `summariseSupplierEsg` gained
    `requireAnyAffirmed` + `coverageLabel` opts; `DUE_DILIGENCE_QUESTION_IDS` derived from the tags.
- 3.2 Recompute-on-change:
  - New `recalculateBcorpForSupplier(supabase, supplierId)` in recalculate.ts (resolves org +
    active B Corp cert, calls recalculateAndNotify; best-effort, never throws).
  - Called from `/api/supplier-esg/submit` (submission flips coverage) and `/api/supplier-esg/verify`
    on both verify and request_revision. So the buyer's readiness updates immediately, not just on
    the nightly cron. (The live SupplyChainEsgCard already reflects current state on load.)
- Tests: extended to 13 cases (requireAnyAffirmed boundary, coverageLabel, tag resolution). All pass.
- typecheck + eslint (touched files) + build all green.

### 3.3 Trend snapshot — RECOMMEND DEFER (not built)
A daily supplier-ESG-coverage snapshot needs a new table (migration) + a writer, but nothing
consumes a trend yet (the card + readiness already show current state). Building write-only schema
now would be speculative. Defer until there's a trend consumer (e.g. a health-score trajectory
panel or a coverage-over-time chart); then add the table, piggyback the upsert on the existing
refresh-auto-evidence cron, and surface it. Flagged for Tim's call.

## Phase 0 — confirm requirement codes (DONE, see above)
Query prod `certification_framework_requirements` for the Human Rights / supply-chain topic
(`topic_area`/`section`) to confirm the exact codes and names (working assumption: `IT4-Y0-002`,
`IT4-Y3-001`, and any Year-3 supply-chain code). Adjust mappings to the real codes.

## Phase 1 — feed supplier ESG into IT4 readiness (small, high value)
Reuses the auto-evidence cron, readiness engine, and gap-analysis UI. No new tables.

1. New `lib/certifications/supplier-esg-evidence.ts`:
   - `computeSupplierEsgCoverage(supabase, orgId)` -> `{ denominator, tierBasis: 'tier_1'|'all',
     total, assessed, verified, coveragePct, avgLabour, avgEthics, avgEnvironment,
     distribution: {leader,progressing,needs_improvement}, weakest: [{name, score}],
     completeness, note }`.
   - Pure scoring/threshold logic split into a testable helper
     `summariseSupplierEsg(rows, opts)` (no DB) for unit tests.
2. Upgrade `lib/certifications/platform-data.ts`:
   - Replace the `IT4-Y0-002` and `IT4-Y3-001` `query()` bodies to call the coverage helper.
     Set `completeness` from coverage; build `items` as the per-supplier evidence
     (name + "ESG self-assessment verified, labour 78 / ethics 80"); `completenessNote` like
     "8 of 12 Tier-1 suppliers have a verified ESG self-assessment (avg labour 76)".
   - Keep behaviour graceful when there are zero suppliers (missing + helpful note).
3. Tests: unit-test `summariseSupplierEsg` (tier fallback, submitted-vs-verified, threshold
   boundaries, empty). Re-use the scratch-DB harness pattern from the ESG-survey work to assert
   the cron writes sensible `certification_auto_evidence` for IT4 given seeded ESG rows.

Outcome: the existing nightly cron + readiness automatically reflect supplier ESG; the gap
analysis shows IT4 moving from "supplier records on file" to "verified supply-chain ESG coverage".

## Phase 2 — visibility, traceability & nudges
1. Read API `app/api/certifications/supplier-esg-coverage/route.ts` (service-role + org context,
   mirroring `/api/suppliers/detail`): returns the coverage summary + per-supplier breakdown.
2. UI: a "Supply chain ESG" card in `BcorpExperience.tsx` (under the Human Rights / IT4 area):
   coverage ring, leader/progressing/needs_improvement distribution, weakest suppliers, and a
   "Send ESG survey" CTA reusing `components/suppliers/SendEsgSurveyDialog.tsx` (now multi-select
   capable, or per-supplier from the list).
3. Per-supplier evidence links (auditor traceability): write `certification_evidence_links`
   rows with `evidence_type='data_link'`, `source_table='supplier_esg_assessments'`,
   `source_record_id=<assessment id>`, `verification_status` derived from `is_verified`, so an
   auditor can click from an IT4 requirement straight to each supplier's verified assessment.
4. Priority-action nudge in `lib/dashboard-guide.ts` `generatePriorityActions`: when Tier-1
   verified coverage < target, surface "Send the ESG survey to N direct suppliers for B Corp
   (IT4)" linking to `/suppliers` with the send dialog. Mirrors the existing supplier actions.

## Phase 3 — depth & freshness
1. Tag the B Corp questions: add optional `bcorpRequirement?: string` (or `bcorpTopic`) to
   `EsgQuestion` in `lib/supplier-esg/questions.ts` for `lhr_11/lhr_12/env_11/env_12`, and map
   `env_11/env_12` as supplementary evidence under IT5 (value-chain climate) without displacing
   the org's own data.
2. Recompute-on-verify: in `app/api/supplier-esg/verify/route.ts`, after an admin verifies a
   supplier assessment, enqueue a readiness/auto-evidence refresh for each brand org that lists
   that supplier (so the brand's B Corp status updates without waiting for the nightly cron).
3. Trend snapshot: add a daily supplier-ESG-coverage snapshot mirroring `lib/vitality/snapshot.ts`
   (`esg_score_snapshots` pattern) so the B Corp health-score trajectory can show supply-chain
   coverage improving over time.

## Edge cases & guardrails
- Org with no suppliers / no tiers -> `missing`, with a nudge; never error.
- Unverified self-reported data must not produce a `complete` status (decision 2).
- A supplier serving multiple brands: coverage is per requesting org via the org-scoped
  `suppliers` row, so no cross-brand leakage; confirm the join stays org-scoped.
- RLS: all reads run server-side (cron + readiness API + new coverage API are service-role),
  so brands never read supplier-owned tables directly.
- Declined/expired invitations and `not_assessed` ratings excluded from "assessed".
- Performance: a couple of indexed selects; cache via the existing readiness/health snapshot.

## Testing & rollout
- Unit: `summariseSupplierEsg` thresholds/fallbacks.
- Integration (scratch-DB harness): cron writes correct `certification_auto_evidence` for IT4.
- E2E: send surveys -> supplier completes -> admin verifies -> IT4 completeness flips to
  `complete`, gap analysis + readiness reflect it, evidence links resolve to the assessments.
- Migrations (if any in Phase 3 for question tags/snapshot): post full SQL in chat, verify on
  local scratch DB before prod (same workflow as the ESG-survey migrations).
- Rollout: Phase 1 is behaviour-additive behind the existing `bcorp_tracking` gate; ship first
  and validate against Everleaf's real supplier set before Phases 2-3.

## Rough effort
Phase 0: 0.5h. Phase 1: ~0.5 day. Phase 2: ~1.5 days. Phase 3: ~2 days.

## Open questions for Tim
- Coverage denominator: Tier-1 only (recommended) or all suppliers?
- Gate "complete" on admin-verified (recommended) or accept submitted-but-unverified?
- Target coverage % for "complete" (recommended 80%).
- Should env_11/env_12 (Scope 3 / SBTi) feed IT5 climate too, or keep supplier ESG scoped to IT4?
