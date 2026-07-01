# B Corp Certification: Have vs Need

## Integration test on alkatera Drinks Co (1 Jul 2026) — 2 bugs found + fixed

Ran the real `buildAnswerKey` + `buildRequirementAnswerForCode` against a seeded
"alkatera Drinks Co" (recertification, size large) in LOCAL supabase. Result:
89 applicable rows (size-personalised from 121), **17 auto-filled** from platform
data (15 Complete, 1 Partial, 1 Manual), real synthesised answers for governance
policies, wage records, the emissions target (+ "no method" gap), and manual
evidence. Rosa's `get_bcorp_requirement` resolved and drafted correctly.

Testing on real data surfaced two **pre-existing** code-vs-DB mismatches that
made the whole thing look empty in production:

1. **Auto-evidence keyed on obsolete codes.** The DB / current framework uses
   B Lab v2.1 codes (CA1.1, PSG1.1, FW…); auto-evidence resolves via each
   requirement's `probe` (`getBcorpV21Requirement(code).probe`). My synthesiser
   called the legacy `queryPlatformEvidence` (old IT-codes) → **0 matches** for
   every requirement. Fixed with `lib/certifications/bcorp-auto-evidence.ts`
   (mirrors the auto-evidence route exactly); wired into both builder functions.
   Before: 0 auto-filled. After: 17/89.
2. **Guidance keyed on obsolete codes.** `requirement-guidance.ts` BY_CODE /
   TEMPLATES are keyed by old IT-codes, so every v2.1 code fell through to
   generic evidence/pitfalls/templates (summary survived via the v2.1 defs).
   Fixed by resolving each requirement's `legacy` code for the lookup. Covered
   by `requirement-guidance.test.ts`.

Both fixes also benefit the requirement dialog + `get_bcorp_readiness` (shared
`getRequirementGuidance`). Cert unit suite now 25 green.

---

Prep for the customer call. Framing from the interview:

- **Customer**: existing B Corp, **recertifying** under the new v2.1 (2025/26) standard
- **Deadline**: looming (recert due within a few months, urgency high)
- **Workflow**: works **alongside B Lab's own platform** (fills B Lab's questionnaire directly; alka**tera** supplies the data and evidence)
- **User**: brand self-serve (their own sustainability lead)
- **Wow they want to feel**: evidence auto-filled, clear next steps, credible time estimate, Rosa hand-holding
- **Lifecycle we must cover eventually**: get certified faster, recertify under v2.1, ongoing Year 3/5 compliance, assess-if-worth-it

---

## 1. What we HAVE (and it is a lot)

The system is mature for **first-time Year 0 readiness** and already covers most of what a recertifier needs:

| Capability | Status | Where |
|---|---|---|
| v2.1 scoring engine, 140+ requirements, size-personalised | Shipped | `lib/certifications/scoring.ts`, `frameworks/bcorp-v2.ts` |
| Risk Tool gating extra due-diligence requirements | Shipped | `RiskToolWizard.tsx`, `risk-tool-questions.ts` |
| Auto-evidence from platform data (18 probes, ~70% coverage) | Shipped | `platform-probes.ts`, `platform-data.ts`, `AutoEvidencePanel.tsx` |
| Manual evidence upload + verification workflow | Shipped | `EvidenceLinker.tsx`, `evidence/route.ts` |
| Prioritised roadmap (next 5 actions) | Shipped | `roadmap.ts`, `RoadmapCard.tsx` |
| Per-requirement guidance (summary, pitfalls, templates) | Shipped | `requirement-guidance.ts`, `RequirementActionPlan.tsx` |
| Effort/time estimate ("~X weeks to submit") | Shipped | `effort-estimate.ts`, `EligibilityEstimateCard.tsx` |
| Momentum tracking (readiness trend) | Shipped | `MomentumCard.tsx`, `score/route.ts` |
| Anonymised peer benchmark | Shipped | `benchmark/route.ts` |
| **Recert deltas** (new / changed / carried-over vs old standard) | Shipped | `recert-deltas.ts`, `RecertDeltaCard.tsx` |
| **Deadline plan** (backward-planned milestones from recert date) | Shipped | `deadline-plan.ts`, `DeadlinePlanCard.tsx` |
| Recert readiness report PDF (Y3/Y5 met, health trend) | Shipped | `recert-report/route.ts` |
| Audit package ZIP, organised by Impact Topic | Shipped | `audit-package.ts`, `render-audit-html.ts` |

**Bottom line**: for this customer, the *readiness assessment, recert-delta awareness, deadline planning and auto-evidence* are all built. Three of their four "wow" factors (auto-fill, next steps, time estimate) already exist and demo well today.

---

## 2. What we NEED (the gaps that matter for THIS customer)

### Gap A — Structured, question-level export for the "alongside B Lab" workflow  ★ highest value

The customer fills B Lab's questionnaire by hand. Our current export (`audit-package.ts`, BIA layout) organises evidence **files** by Impact Topic and produces `bcorp_evidence_map.pdf` saying which file goes in which section. Good, but it stops at the file.

What it does **not** give the person sat in front of B Lab's form:
- The **answer/value to type in** (e.g. the actual Scope 1/2/3 tonnes, the living-wage %, the policy name) rather than just a filename.
- A **per-requirement / per-question row** they can work through top to bottom.
- A **spreadsheet** (CSV/XLSX) they can filter and tick off. Today it is PDF only.

This is the single biggest lever on "does alka**tera** actually save me time on my recert". Turns us from "a folder of files" into "your answer key for the B Lab form".

### Gap B — Rosa for B Corp (a named wow, currently absent)

Rosa guides other modules (`emissions-guide.ts`, `search-guide.ts`) but is **not wired into B Corp**. The customer explicitly wants conversational hand-holding: "explain this requirement", "draft my answer for PSG1 from my data", "why did this fail". Infrastructure exists; the B Corp binding does not.

### Gap C — Ongoing Year 3 / Year 5 UX (for the lifecycle, not this call)

Year 3/5 requirements and scoring exist; the *guidance UX* to actively drive improvement work between certifications is thin. Matters for "ongoing compliance", less urgent for a deadline-driven recert.

### Lower-priority gaps
- Template coverage: only 4 requirements have starter text (`requirement-guidance.ts`).
- Clarification back-and-forth with auditor: create/respond works, full loop unfinished.
- Sector-specific carve-outs: defined in data, not enforced in scoring.
- No B Lab API (two-way sync) — not needed if we nail the structured export.

---

## 3. Have vs Need, mapped to the four wow factors

| Wow factor | Have? | Need |
|---|---|---|
| Evidence auto-filled | ✅ Strong (18 probes) | Surface the **value**, not just "evidence exists", so it flows into the export |
| Clear next steps | ✅ Strong (roadmap) | Recert-delta-first ordering so they see only what changed |
| Effort/time estimate | ✅ Built | Tune copy for recertifiers (they are not starting from zero) |
| Rosa hand-holding | ❌ Missing | Build B Corp binding (Gap B) |

---

## 4. Prioritised build plan

Sequenced for a deadline-looming recertifier working alongside B Lab. Effort is rough (S = ~1-2 days, M = ~3-5 days, L = ~1-2 weeks).

### P0 — Structured question-level export  (M)  ✅ BUILT (1 Jul 2026)
Shipped as the **B Corp answer key**: one row per applicable requirement with a
paste-ready answer synthesised from platform data, exportable as XLSX or CSV.
- Pure serialisers: `lib/certifications/answer-key-format.ts` (+ unit tests)
- Data builder (server-only): `lib/certifications/answer-key.ts` — readiness +
  `queryPlatformEvidence` values + manual evidence, ordered by B Corp section
- Route: `app/api/certifications/answer-key/route.ts` (`?format=xlsx|csv`,
  export-permission gated)
- UI: `components/certifications/AnswerKeyButton.tsx`, wired into the Audit tab
- Follow-ups: richer answer synthesis for the ~120 requirements with no probe
  mapping (currently fall back to manual evidence descriptions); per-B-Lab-
  question-code column once we have the v2.1 question map.

Original scope, for reference:
- Add a **CSV/XLSX export** alongside the ZIP: one row per applicable requirement with columns: `code`, `requirement`, `impact topic`, `status`, `your answer / value`, `evidence file`, `source module`, `last updated / staleness`.
- Generate the **"your answer" string** from probe data where we have it (e.g. emissions probe -> "Scope 1: X t, Scope 2: Y t, Scope 3: Z t (FY24, verified)"). This is the reusable core, see P1.
- Build on `audit-package.ts` + `requirement-guidance.ts`; new renderer sibling to `render-audit-html.ts`. New route `app/api/certifications/answer-key/route.ts`.
- **Demo value**: "here is your B Lab form, pre-answered, as a spreadsheet."

### P1 — Answer/value synthesiser  (S-M)  ✅ BUILT (1 Jul 2026)
Extracted the inline synthesis from P0 into a pure, reusable, tested helper.
- `lib/certifications/answer-synthesiser.ts` — `synthesiseRequirementAnswer(input)`
  returns `{ answer, dataPoints, confidence, gap, dataSource, dataQuality }`.
  Pure (takes already-fetched platform result + evidence + guidance), so both
  the export (P0) and Rosa (P2) can call it.
- Confidence ladder: `strong` (complete probe) / `partial` (probe with a caveat)
  / `manual` (user evidence only) / `none` (nothing yet).
- Honest `gap`: partial probes surface their completeness note; empty rows get
  an actionable "Not in alkatera yet. Evidence B Lab will accept: …" from the
  guidance; attached-but-unverified evidence warns to verify.
- `answer-key.ts` now delegates to it and appends the gap as a ⚠ note, so the
  ~120 unmapped requirements are actionable instead of blank.
- Tests: `lib/certifications/__tests__/answer-synthesiser.test.ts` (7 cases).

### P2 — Rosa for B Corp  (M)  ✅ BUILT (1 Jul 2026)
Bound Rosa to B Corp requirements, grounded in the P1 synthesiser.
- New Rosa tool `get_bcorp_requirement` (`lib/rosa/tools.ts`): deep-dives ONE
  requirement and returns guidance + the org's real data points + evidence +
  confidence + gap, so Rosa can explain AND draft an answer from actual data
  (never invents figures). Complements the existing `get_bcorp_readiness`
  (overall picture). Lights up in the streaming chat + the /rosa hub because
  both use the shared `ROSA_TOOLS` / `executeTool`.
- `buildRequirementAnswerForCode()` (`answer-key.ts`) resolves a code/topic and
  synthesises one requirement's answer; matching extracted to a pure, tested
  `requirement-match.ts` (exact-code-wins, unmet-before-met, earliest-year).
- System prompt: added a "Certification" tool family (`app/api/rosa/chat`)
  telling Rosa to ground drafts in the returned data and state gaps plainly.
- UI: "Draft with Rosa" pill (`AskRosaButton`) in the B Corp requirement dialog
  (`GapAnalysisView.tsx`) — pins the requirement + seeds a draft prompt. Rosa
  provider/drawer are already global in `AppLayout`, so no mounting needed.
- Tests: `requirement-match.test.ts` (6). Total cert-answer suite 19 green.
- Follow-up ✅ BUILT: Rosa can now save a drafted answer back onto the
  requirement (see below).

### P2b — Rosa saves the drafted answer  (1 Jul 2026)  ✅ BUILT
New confirmation-gated action tool `propose_save_bcorp_answer` (the standard
Rosa propose → Confirm → apply pattern):
- `lib/rosa/tools.ts`: added to `ACTION_TOOL_NAMES`, tool def, dispatch case,
  `buildActionPreview` + `validateActionInput` (requirement_code + answer).
- `lib/rosa/actions.ts`: `execSaveBcorpAnswer` resolves the bcorp_2026
  framework + requirement code, inserts a `certification_evidence_links` row as
  an **unverified note** (`source_module: 'rosa'`, `verification_status:
  'pending'`) — a draft never marks a requirement met — then runs
  `recalculateAndNotify`. Mirrors the evidence-POST route.
- System prompt Certification family updated so Rosa offers to save only on
  request and tells the user it still needs verifying.
- UI: none needed — the generic ActionProposalCard renders the Confirm/Cancel.
- Verified end-to-end against local supabase: propose → executeAction → a
  pending 'rosa' note is written; the requirement flips to `in_progress` (not
  passed) and the note appears in the per-requirement view as "(pending)".

### P3 — Recertifier framing polish  (S)
- Make the B Corp landing default to **recert-delta-first** for orgs with `certification_type = 'recertification'`: show what changed under v2.1 before the full list.
- Confirm `DeadlinePlanCard` is seeded with their real recert date and drives the milestone countdown.
- Recert-tuned copy on the effort estimate.

### P4 — Template + guidance coverage  (M, ongoing)
- Expand `requirement-guidance.ts` templates beyond the current 4 to cover the manual Foundation + high-frequency Impact Topic requirements.

### Later (lifecycle, not this call)
- Year 3/5 improvement UX (Gap C).
- Auditor clarification loop completion.
- Sector-specific applicability enforcement.

---

## 5. To confirm on the call
- Exactly how they submit to B Lab today (portal fields? upload? their consultant?) — validates the P0 export shape (CSV vs XLSX vs paste-per-question).
- Their real recert deadline and cycle start date — seeds the deadline plan.
- Which Impact Topics they historically scored weakest on — tells us where the answer synthesiser matters most.
- Whether a B Leader/consultant is in the loop (changes nothing self-serve, but affects export format).
