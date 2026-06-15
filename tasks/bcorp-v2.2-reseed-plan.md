# B Corp v2.2 full-fidelity re-seed plan

Goal: make our `bcorp_2026` framework faithfully match the B Lab Standards
(published 8 April 2025): Foundation Requirements + 7 Impact Topics, with the
real two-level sub-requirement IDs, per-requirement Year 0/3/5 phasing, 7 size
bands, and risk activation.

## Current state (what we have)
- 41 requirements: Foundation 8 (FR-E-001..003, FR-L-001..002, FR-R-001..003) +
  7 topics IT1..IT7 with 4-6 each, coded `IT{n}-Y{0,3,5}-NNN`.
- framework_id (bcorp_2026): `a1b2c3d4-e5f6-7890-abcd-ef1234567890`.
- Requirement row `id` is DB-generated (gen_random_uuid), NOT hardcoded.
  Evidence (`certification_evidence_links`), gap analyses and auto-evidence FK
  to that row UUID, matched in app code by **requirement_code**.

## Migration strategy (evidence-safe)
Because ids are generated and evidence FKs to them, DO NOT delete+reinsert.
Instead, in the seed migration:
1. UPDATE existing rows BY OLD `requirement_code` -> new code/name/summary/
   year/size/topic (preserves the UUID, so existing evidence + gap analyses +
   auto-evidence stay linked). Maintain an explicit old->new code map.
2. INSERT new rows for genuinely new sub-requirements (new generated UUIDs).
3. DELETE rows whose old code has no successor.
4. Re-sync `framework_requirements` (mirror table) the same way.
Idempotent (safe to re-run). Post SQL in chat for Tim to apply.

## v2.2 target structure (from B Lab official explainers; ESC/CA being confirmed
## by background research agent a278ecb8 from the PDF)
- Foundation: eligibility, ineligible industries, legal requirement, + RISK
  ASSESSMENT gateway (new; activates extra HR/ESC sub-reqs).
- PSG: PSG1.1, PSG2.1-2.5 (~6).
- Fair Work: FW1, FW2.1-2.8, FW3.1-3.2, FW4.1-4.4 (~16).
- JEDI: JEDI1(.1-.2), JEDI2 (menu: pick N of 19 by size/year).
- Human Rights: HR1.1-1.2, HR2.1-2.7, HR3.1-3.7, HR4.1-4.11 (~20, densest).
- Climate Action: CA1 measure, CA2 targets, CA3 transition plan (size-scaled;
  Large = 250 emp / $75M -> Scope 3 + third-party verify + SBTi-validated).
- ESC: ESC1-5 pillars (sub-points being confirmed; B Lab may not number them).
- GACA: GACA1.1-1.3, GACA2.1-2.6, GACA3.1-3.2 (incl. responsible tax, XXL only).

## Structural changes needed beyond content
- scoring.ts: 7 size bands (companies-without-workers, Micro, Small, Medium,
  Large, X Large, XX Large) replacing coarse small/medium/large; per-requirement
  size-band applicability; risk-activation gating. Keep readiness fields
  back-compat.
- Menu topics (JEDI2, GACA2): model as a single requirement each with a
  "pick N actions (scales by size/year)" note rather than building a new
  menu-selection UI subsystem (tracker, not the official submission tool).
- requirement-guidance.ts BY_CODE, platform-data.ts MAPPINGS, recert-deltas.ts
  are keyed on old IT codes -> remap to new codes.

## Phases (tasks #67-71)
P1 content module (source of truth) -> P2 size-band/risk engine -> P3 evidence-
safe migration -> P4 rewire guidance/auto-evidence/recert -> P5 verify + post.

## Confidence
Foundation/PSG/FW/JEDI/HR/GACA sub-IDs reliable from B Lab explainers. CA = CA1-3
reliable. ESC = pillar level only unless the PDF research confirms sub-points;
model honestly (mark indicative where unconfirmed).
