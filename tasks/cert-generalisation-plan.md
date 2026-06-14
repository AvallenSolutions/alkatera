# Generalise the B Corp experience to ISO 14001, ISO 50001 & EcoVadis

User decision: apply the full B Corp experience (refined 4-tab UI, graded readiness, roadmap, guidance, action plans, one-pager, momentum, benchmark, auto-update) to the three checklist-style frameworks, **full depth** (incl. per-framework requirement content + auto-evidence mappings).

## Critical finding
`iso14001`, `iso50001`, `ecovadis` exist as `certification_frameworks` rows but have **no requirements seeded** (no `certification_framework_requirements`). The B Corp scoring engine + UI are hardcoded to `bcorp_2026`. So this is: generalise the engine, AND author each standard's requirement set + guidance + auto-evidence. ISO/EcoVadis text is copyrighted → **paraphrase clause structure, never copy standard wording**.

## What's reusable vs new
- Reusable (parameterise by framework): graded readiness (`scoring.ts`/`readiness.ts`), roadmap, effort-estimate, action plans (gap_analyses), one-pager, momentum, benchmark, evidence library, recalc/auto-update.
- New per framework: requirement set (seed migration), guidance content, platform→requirement auto-evidence mappings.
- Drop for non-B-Corp: Year 0/3/5 progression, recert-vs-BIA deltas, ECGT, risk tool (B Corp-specific).

## Phases
1. **Engine generalisation** — `readiness.ts` keyed by framework code (not just bcorp); `scoring.ts` handles frameworks with no year-progression (all requirements "current"); `recalculate.ts` + crons generalised to recompute any active framework.
2. **Generic UI** — a reusable `CertificationExperience` (Overview/Requirements/Evidence/Audit) used by the three frameworks; route `iso14001|iso50001|ecovadis` to it from the `[code]` page. Overview shows momentum, roadmap, platform health, eligibility estimate, one-pager (no recert/year cards).
3. **ISO 14001 content** — seed requirements (paraphrased Annex SL clauses 4–10), guidance, auto-evidence mappings (e.g. EMS scope ← facilities; objectives ← targets; operational control ← activity data; monitoring ← metric snapshots).
4. **ISO 50001 content** — seed requirements (energy management system clauses), guidance, auto-evidence (energy review ← utility data; EnPIs ← metric snapshots; energy objectives ← targets).
5. **EcoVadis content** — seed the 21 criteria across Environment / Labour & Human Rights / Ethics / Sustainable Procurement, guidance, auto-evidence (environment ← emissions/water/waste; labour ← people; ethics ← governance; procurement ← supplier ESG).
6. Per-framework guidance + auto-evidence + verify + commit.

Build order: engine + generic UI first (benefits all three), then ISO 14001 end-to-end as the proof, then ISO 50001, then EcoVadis.
