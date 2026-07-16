# The data revolution: alkatera fills itself in

**Worktree:** `.claude/worktrees/redesign` (branch `redesign`, never main). Build phase by phase across sessions, committing per phase; this plan also lands in the worktree as `tasks/data-revolution-plan.md`.

## Context

The most common feedback: data entry is a huge amount of work and the platform is intimidating. Users are treated as sustainability clerks — expected to know where data goes and which emission factors apply. Exploration of all five rooms found the burden concentrated in per-row expert forms (`IngredientFormCard` 2,184 lines with a raw factor search, `PackagingFormCard` 1,841 lines with EPR jargon), the 14-step LCA wizard, the agriculture questionnaires, and the everyday `DirectDataEntry` tables, plus a "one dialog per record" tax across people/governance/community.

The raw material for the fix already exists but is fragmented: **four** separate document classifiers (Smart Upload/Claude with a mature learning loop; Rosa drawer/Gemini; website import; supplier smart-import) that don't share learning; **two** factor-resolution systems; **six** document buckets with no provenance graph; a unified review queue (`agent_exceptions`) that is pilot-flagged and only dispatches 3 of ~16 kinds; and three incompatible confidence/quality vocabularies. Meanwhile the gold-standard patterns are proven in pockets: the arrival ritual (bucketed choices, background enrichment, instant estimate), `IngredientComposer` (one-line add, auto-matched), `PackagingWizard` (typical weights, plausibility bands), hospitality's `quantities_status` placeholder→confirm model with `BulkQuantityGrid`, `AutoEvidencePanel` (proposes evidence from data we already hold), Xero AI classification + rules.

**Decisions made with Tim:** estimate-first for internal views only (dashboards/forest compute from labelled estimates; reports, exports and passports require confirmed data); email-in intake is a core pillar; factor gaps are resolved by Rosa proxies plus an alkatera-side admin queue — the user never sees a factor picker.

## The revolution in one sentence

**You never fill in an empty form: give us what you have — documents, a website, an email, a sentence to Rosa — and alkatera drafts everything, estimates the gaps honestly, and asks you only small questions that matter.**

Principles: correcting beats authoring (every surface starts populated); one question at a time, in plain language, prioritised by footprint impact; provenance always visible (estimated / drafted / confirmed chips); expert forms demoted to a "full record" workshop view, never deleted (Tim's rule); the forest rewards every answer.

## The provenance model (foundation for everything)

Generalise hospitality's `quantities_status` into one platform vocabulary used by every record the engine touches:

- `estimated` — benchmark/archetype/typical value or Rosa proxy; computes into internal views, chipped.
- `drafted` — extracted from user evidence (document, website, email, integration), awaiting a look.
- `confirmed` — a human touched it (typed it, accepted it, or corrected it).

One shared lib (`lib/provenance/`): the enum, a 0–100 confidence scale mapping the three existing vocabularies onto it, chip components (studio `StateChip` tones), and a per-org rollup ("62% of your footprint is confirmed") that feeds the forest, reports gating (internal vs external), and the Ask Queue prioritiser. Additive columns only where a table lacks a status field; map existing fields (`pcf.status='estimate'`, `data_quality`, `ef_source_type`) rather than migrating them.

## Pillar 1 — One intake: give us anything

- **Consolidate the classifiers.** Rosa drawer uploads and supplier smart-import route through `lib/ingest/classify-document.ts` + `ingest-staging` + `ingest_jobs`, so all channels feed and benefit from the `ingest_document_profiles`/`ingest_feedback` learning loop. Website import stays its own extractor but adopts the shared job/inbox surface and writes provenance (`drafted`).
- **Email-in.** Per-org address (e.g. `{org-slug}@in.alkatera.com`), inbound webhook → attachment stash → the same ingest pipeline → Ask Queue items. The dead `source==='email'` code paths in `agent_exceptions` become real. Infra: an inbound-email provider webhook (evaluate Infomaniak first, SendGrid inbound parse as fallback) + a spoofing guard (sender must match an org member or an allow-list the user confirms once).
- **The give affordance everywhere.** The dropzone (plus "paste a link" and "tell Rosa") becomes a first-class door on the desk and every room landing — one component, room-aware default routing. `/uploads` becomes the complete inbox (all job tables, resumable handoffs).

## Pillar 2 — Draft-first: the platform fills itself in

- **Estimate-first defaults.** Facility archetype proxies, typical packaging weights, recipe starters, sector benchmarks and Xero spend-based numbers become the *default starting state* rather than opt-in escape hatches. Missing utility months roll forward from last year (`UtilityRolloverDialog` logic, automatic + chipped `estimated`). Internal views compute immediately; `enforceExportAllowed`-style gating extends to "requires confirmed data" for reports/passports/exports.
- **Factor selection abolished as a user task.** Confident auto-match applies silently with provenance; unconfident match → Rosa auto-proposes a conservative proxy (existing `propose_apply_proxy` machinery, uncertainty declared) so the record always computes, AND the item lands in a new alkatera-side admin queue (`/admin-tools/factor-queue`, fed by `openlca_no_match` + rejected matches). `InlineIngredientSearch` moves behind a quiet "Not right? Choose yourself." link.
- **Composer pattern rollout.** The `IngredientComposer` one-liner becomes the only *visible* add for ingredients, packaging, and the people/governance/community record families (name → one or two numbers → done; the platform infers the rest). Full cards remain via "Open the full record."
- **CSV anything.** Generalise the bulk-import column-mapper so any "one dialog per record" family (compensation, board members, donations) accepts a pasted spreadsheet with AI column mapping — one shared component.

## Pillar 2b — Bring your history: migration from existing reports and platforms

Critical for brands arriving with prior reports and data elsewhere (consultant LCAs, competitor-platform exports, B Corp impact reports, CDP/EcoVadis responses, GHG inventories in Excel). Today's historical import (`historical_sustainability_report`/`historical_lca_report` → `/api/ingest/historical` → `historical_imports` + bucket) extracts headline metrics only and stops. Upgrade it into a **migration engine**:

- **Deep extraction mode** for report-class documents: mine the document for company profile, facilities, annual utility/energy totals, product list with PCF values + system boundaries, baseline years, targets, certifications, supplier names and methodology notes — not just headlines. Reuse the ingest pipeline (Claude, big-document background path); a new `lib/ingest/migrate-report.ts` extraction schema.
- **Everything lands as `drafted` records via the intake engine**, never direct silent writes: facilities, products (with prior PCF values as labelled priors citing the source report), targets, certifications. The Ask Queue confirms in batches ("Your 2025 report mentions 3 facilities — still right?").
- **History seeds the trends**: prior-year footprints and metrics land as historical snapshots so year-on-year charts are populated from day one — upload last year's report, see your trajectory immediately. Provenance links every seeded number back to the stored source PDF (`historical_imports` linkage), so nothing is unauditable.
- **Format library**: recognition hints for common shapes (B Corp report, CDP response, EcoVadis scorecard, consultant LCA, competitor CSV/Excel exports) fed through the same `ingest_document_profiles` learning substrate so each new brand's format teaches the next import.
- Surfaced in the arrival ritual ("Already have a sustainability report? Drop it here.") and the desk give door.

## Pillar 4 — Rosa's self-learning flywheel (the Karpathy loop)

The data-engine pattern (deploy → harvest failures → curate → improve → eval-gate → redeploy) is already implemented for document classification (`ingest_feedback` → `ingest_document_profiles` → context injection → eval corpus + `scripts/ingest-eval.ts`). Generalise the same flywheel to Rosa herself. We don't retrain model weights; the "model" we improve is Rosa's context: org memory, global knowledge, exemplars, prompt — each change gated by evals.

1. **Capture** (production signals, mostly additive to existing tables): per-answer feedback chips on Rosa messages (helpful / not right / too vague — one tap, stored per message); implicit signals — user rephrases the same question, abandons the conversation, files a support ticket after an answer, cancels a proposal (confirm/cancel outcomes recorded on `rosa_pending_actions`), or corrects a value Rosa wrote (diff on edit, same pattern as `lib/ingest/feedback-diff.ts`); knowledge misses — `search_knowledge_bank` calls that return nothing get logged as wiki-gap events in `rosa_telemetry`.
2. **Curate** (the labelling step): a weekly Inngest sweep clusters the failure signals by kind (missing knowledge / wrong tool / wrong data / wrong tone) into an admin curation queue at `/admin/rosa-learning` (sibling of `/admin/ingest-learning`). Each case resolves to one of four levers: a new/edited wiki page or knowledge item (auto-syncs into Rosa's RAG via the existing wiki→`gaia_knowledge_base` sync), a curated exemplar, an org-memory correction, or a tool/code fix ticket.
3. **Feed back** (the weights-free "retrain"): new `rosa_exemplars` table — curated question → ideal answer/tool-trace pairs, injected into the system prompt by relevance with the same char-budget + injection-hardening pattern as `lib/ingest/org-context.ts`. Org-level learning continues through `rosa_memory`; global learning through the knowledge base.
4. **Evaluate** (gate every change): `rosa_eval_cases` golden corpus harvested from real conversations via a "promote to eval" button in the curation queue (mirror of the ingest eval promotion) — each case stores the question, context snapshot and expected behaviour (right tool called, key facts present, wiki cited, proposal-not-write). Scored by deterministic checks + an LLM judge in `scripts/rosa-eval.ts` (sibling of `ingest-eval.ts`, manual run, real tokens). No prompt/exemplar/knowledge-shape change ships without a corpus run.
5. **Measure**: helpfulness rate (explicit chips), proposal confirm rate, correction rate on Rosa-written data, knowledge-miss rate, support deflection (already counted) — trended on `/admin/rosa-learning` beside the eval scores.

Build-time verifications needed (believed absent, confirm before building): no per-message feedback UI exists today; no Rosa eval harness; proposal cancel reasons not captured.

## Pillar 3 — The Ask Queue: the platform asks, you answer

Invert the model: a single prioritised queue of small questions, each answerable in under 30 seconds (a number, a chip choice, a yes/no, a photo/doc request).

- **Make `agent_exceptions` real.** Ungate from the `managed_footprint_enabled` pilot; implement approve→write dispatch for every kind (today only the three bill types write); add working deep-links; sweep all job tables, not just `ingest_jobs`. This table (kind/source/confidence/title/summary/status/applied_to) is the Ask Queue's spine — extend it with `ask` kinds generated from: draft gaps (generalised quantities_status), low-confidence classifications, plausibility flags, EPR completeness, growth signals.
- **Impact prioritisation.** Each ask carries an estimated effect on footprint accuracy (derive from the material's share of aggregated impacts); the queue is ordered by it, so ten minutes of answers always buys maximum accuracy. "This question is worth 12% of your footprint."
- **Surfaces.** The desk's "What needs you today" and the room setup panels (both already built) draw from the queue; a full queue view lives on Today; Rosa walks it conversationally ("I have three quick questions about your gin") via a `get_next_asks` tool + existing proposal cards. Every answered ask nudges the forest.

## Phases

**A — Foundation (build first):** `lib/provenance/` (enum, confidence mapping, chips, org rollup); ungate + complete `agent_exceptions` dispatch for all existing kinds with deep-links; `/uploads` unified across all job tables. Mostly additive; no destructive migrations (post any SQL in chat).

**B — One intake:** Rosa uploads + supplier smart-import onto the ingest pipeline (keep old buckets readable); email-in webhook + org address + spoof guard; the give affordance on desk + room landings; website import provenance; **migration engine v1** (deep extraction for report-class documents, drafted records + historical snapshots, arrival-ritual "drop your old report" door).

**C — Draft-first entry:** estimate-first defaults (archetypes, rollover, typical weights) with chips; factor-picker demotion + Rosa auto-proxy + `/admin-tools/factor-queue`; composer rollout (ingredients, packaging, social/governance families); shared CSV column-mapper; **Rosa learning capture** (feedback chips, proposal outcomes, knowledge-miss logging, correction diffs).

**D — The asks, the flywheel + measurement:** ask generation from all sources; impact prioritisation; desk/room/Rosa surfacing; confirmed-share gating for external artefacts; **Rosa curation queue + exemplars + eval corpus + `scripts/rosa-eval.ts`**; migration format library learning; metrics — time-to-first-footprint, asks answered per session, % footprint confirmed, factor-queue latency, Rosa helpfulness/deflection/eval trend — wired into the existing admin pages.

Each phase: tsc + scoped vitest + browser walk on :8895, commit per phase, sync log updated. Key reuse: `classify-document.ts`, `ingest_document_profiles`, `save-extracted.ts`, `propose_apply_proxy`/`actions.ts`, `IngredientComposer`, `PackagingWizard` catalogue, `BulkQuantityGrid`, `AutoEvidencePanel`, `lib/industry-benchmarks.ts`, growth signals, desk priorities, room setup panels.


## BUILD LOG — all four phases SHIPPED 2026-07-16/17

- **Phase A** (3c89a852): lib/provenance (vocabulary, confidence mapping, ProvenanceChip, org rollup at /api/provenance); agent_exceptions ungated for all orgs, approve genuinely writes via lib/intake/dispatch.ts, deep links via lib/intake/deep-links.ts; /uploads unions all job tables. Migration 20260716120000 (dedupe indexes).
- **Phase B** (05cd8b82): one classifier (Rosa uploads + supplier smart-import through classify-document.ts + ingest_document_profiles, channel column, Gemini fallback documented); migration engine v1 (deep extraction, drafted records via the queue, trend seeding through historical_imports, arrival-ritual door); email-in (intake+{token}@alkatera.com, IMAP poller, spoof guard, DORMANT until EMAIL_INTAKE_* env vars); give door on desk + five rooms. Migrations 20260716130000/140000.
- **Phase C** (cf217747): auto-proxy factors + /admin-tools/factor-queue + picker demoted; utility rollover + provenance chips + 80% confirmed-share export gate (lib/provenance/gate.ts); PackagingComposer + quick-add rows + csv-paste-import + global drag layer; Rosa learning capture (rosa_message_feedback migration 20260716150000, learning.* telemetry). Found pre-existing bugs: staging_emission_factors RLS regression (global library unreadable — CHECK PROD), Next fetch-cache stale reads in hand-rolled admin clients (task chips spawned).
- **Phase D** (7ebfd3a3): ask generation (lib/asks: five sources, impact ordering, idempotent sweep with stale auto-resolve, migration 20260717130000), AskOfTheDay on the desk, inline queue answers, Rosa ask tools; flywheel (rosa_learning_cases/exemplars/eval_cases/eval_runs migrations 20260717100000-120000, /admin/rosa-learning, exemplar injection, scripts/rosa-eval.ts, stats strip).
- **Pending prod migrations** (all applied locally): 20260716120000, 130000, 140000, 150000, 20260717100000, 110000, 120000, 130000, plus phase-B-adjacent 20260712180000 (report-assets bucket) and 20260712170000 (growth snapshots).
- **Go-live for email-in**: create intake@alkatera.com in kSuite, set EMAIL_INTAKE_HOST/USER/PASSWORD (+ optional PORT/SECURE/ADDRESS) in Netlify; panel flips from coming-soon automatically.

## Verification

- Phase A: a seeded org shows provenance chips and a working queue that writes on approve for every kind (test each handler against local DB).
- Phase B: email a PDF bill to the test org's address → it appears in `/uploads`, classifies, lands as an ask, approves into `facility_activity_entries`. Rosa drawer upload teaches the supplier profile (check `ingest_document_profiles`).
- Phase C: new product via composer only — no factor picker ever appears; unmatched ingredient computes with a proxy chip and appears in the admin factor queue. Fresh org's internal dashboards show numbers day one; report generation blocks politely until confirmed share is met.
- Phase D: the desk asks the highest-impact question first; answering it moves the forest and the confirmed-share rollup.
