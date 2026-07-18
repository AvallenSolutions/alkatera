# Report sections: render them, and be honest about what is missing

Worktree: `/Users/timej/Documents/GitHub/alkatera/.claude/worktrees/redesign` (branch `redesign`, staging auto-deploy).

## Context

Tim asked for a warning when a section is included but its data is incomplete (his example: gender diversity inside People & Culture). Investigating that premise found something bigger: **five sections never render at all.** `assembleReportData` never fetches people / governance / community / suppliers / facilities data; each page renderer early-returns empty when it is missing; and the section is skipped entirely because `dataAvailability.hasPeopleCulture` and siblings are never set. So a user ticks People & Culture, the funnel says "Data ready", and the report simply has no such page. Facilities has no renderer written at all. This predates Phase C.

Tim's decisions: fix all four social/value-chain sections AND build the facilities page; missing blocks print **"not yet measured" in place** rather than vanishing or printing N/A.

Four further silent failures found while planning, all fixed here because these files are open anyway:
- `SECTION_TO_TOPIC` (renderer :617-627) maps to topic ids that do not exist in `lib/materiality/topic-library.ts` for governance, community and supply-chain, so **materiality callouts can never appear on those pages** however complete the assessment.
- `renderTargetsPage` reads `data.governance?.climateCommitments`, never populated, so **every report ever generated** prints "No climate commitments have been recorded yet".
- `app/api/reports/preview-data/route.ts` counts four tables that do not exist and has zero callers. Delete.
- `app/api/reports/sample/route.ts` passes 0-1 values (`0.88`) where the renderer expects 0-100, printing "1% data completeness". Fix, and set the contract: **every score, rate and completeness on the report payload is 0-100.**

## Design

### 1. Fetchers (`lib/reports/sections/*.ts`, new)

One module per area, following the `lib/provenance/rollup.ts` house pattern: `gatherX(supabase, orgId, year)` does I/O and **never its own auth** (the assembler passes an RLS client from routes, service-role from Inngest), plus a pure exported `mapX(raw)` that is unit-testable without Supabase. `lib/reports/sections/types.ts` holds the five renderer-facing interfaces lifted out of the renderer, so fetcher and renderer cannot drift again.

Extract `calculateGovernanceScore` out of `app/api/governance/score/route.ts` into `lib/governance/score.ts` (mirrors the existing `lib/community-impact/score.ts`). Reuse the already-importable `lib/calculations/people-culture-score.ts` helpers (`calculatePeopleCultureScore`, `analyzeLivingWageCompliance`, `calculateGenderPayGap`, `calculatePayRatios`) and `lib/community-impact/score.ts` (alias its `CommunityImpactData`, which name-collides with the renderer's).

**Compute live from raw tables; never read the persisted `*_scores` snapshots** (they refresh only when a user visits that page, so a scheduled report would cite a months-old score — the reason `lib/community-impact/score.ts` exists).

Critical mappings, each a place to get it wrong: `femalePercentage` over the `gender_data` jsonb denominator, not `total_employees`; `turnoverRate` derived as `departures/totalEmployees` (no column); `boardDiversityMetrics.femalePercentage` as a female share, NOT the route's `min(male,female)/total` balance ratio; board/policy renames (`member_name`→`name`, `meeting_attendance_rate`→`attendanceRate`, `policy_name`→`name`); `policy_score`→`policyCompleteness`; suppliers `industry_sector`→`category` (no `category` column exists); stories `story_type`→`category`, `media_urls[0]`→`photo`. **Highest-consequence line in the whole plan:** `facility_emissions_aggregated.total_co2e` is in **kg** while every other figure in the renderer is tonnes — divide by 1000, guarded on the `unit` column, or a single site publishes at 1000× the whole company.

Deliberately drop two invented fallbacks from the dashboard routes: `livingWageCompliance = 50` when no benchmarks, and `genderPayGapMean = 0` when no male salaries. Both are fabricated disclosures in a published report; return `null` and let the skeleton say so.

Year policy per area, stated in each module and on the page where it bites: people strict by `reporting_year`; governance "as at year end" with a page footnote; community strict except stories; suppliers none (current roster, footnoted); facilities by period overlap.

Fetches are gated on section selection, in one `Promise.all`, mirroring the existing products gate. Note `wantsGovernance` must also fire when `targets` is selected (Targets reads governance commitments), via a cheap `governance_mission`-only fast path.

### 2. Completeness seam (`lib/reports/section-completeness.ts`, new — pure)

```ts
interface SectionBlock { id: string; label: string; present: boolean; deepLink: string }
interface SectionCompleteness { sectionId: string; blocks: SectionBlock[]; presentCount: number; totalCount: number }
computeSectionCompleteness(sectionId, reportData): SectionCompleteness
computeAllSectionCompleteness(sections, reportData): Record<string, SectionCompleteness>
```

A declarative catalogue: per section, a list of `{ id, label, deepLink, predicate(reportData) }`. This is the **single oracle** for both the document and the builder, so a block can never be flagged complete in one and missing in the other. Block ids: people-culture `score|pillars|headcount|gender-diversity|hires-departures|turnover|living-wage|training|pay-gap|pay-ratio|engagement|dei-actions|benefits`; governance `board-composition|board-diversity|board-independence|board-attendance|policies|policy-score|mission|sdg-commitments|climate-commitments|ethics`; community-impact `score|pillars|donations|volunteering|local-employment|local-sourcing|impact-stories`; supply-chain `roster|categories|data-shared`; facilities `inventory|emissions|production|intensity`. Deep links to the real in-app pages (`/people-culture/diversity-inclusion`, `/governance/board`, `/community-impact/stories`, `/suppliers`, `/company/facilities`).

`assembleReportData` attaches the result as `reportData.sectionCompleteness`; the renderer reads it rather than re-deriving presence with its own null checks, with a local fallback so tests and the sample route still work.

### 3. Renderer (`render-sustainability-report-html.ts` + `studio-kit.ts`)

**`dataAvailability.hasX` stops being a render gate and becomes reporting only.** The renderer gates on section selection alone, and the four early-returns become defensive normalisation against an `EMPTY_*` constant, so a page function can never return `''`. This is the structural fix: the flag was set 1,800 lines from where it was read, and forgetting it failed silently and prettily. Five sections shipped with that defect; a sixth would too.

A selected section with genuinely zero data renders as an all-skeleton page, led by one honest line ("This section was included in the report, but none of its measures have been recorded for 2026 yet"), not omitted. The funnel signal cannot be trusted to catch it (one salary row flips "Data ready" green), an empty page is self-correcting where a missing page teaches nothing, and the confirmed-data gate already guards outbound publishing.

Two new studio-kit helpers, `notMeasuredTile(label, hint)` and `notMeasuredBlock(title, hint)`: the metric-card shell preserved so the grid never reflows, "Not yet measured" at 14px so a skeleton never out-shouts a real number, and a mono-caps hint naming where to add it. **`'N/A'` never appears again on these pages** — it reads as *not applicable*, a different and false claim. Applies to blocks that currently vanish (living wage, training, pay gap, mission, impact stories, empty tables) and to those that print `N/A` or a bare `0` (a zero is a claim; absent is not). While these pages are open, wire in `ceoWorkerPayRatio`, `engagementScore` and DEI actions, already fetched and typed but never rendered.

New `renderFacilitiesPage`: three tiles (sites, measured, site emissions), a mono coverage line, a hairline table (site, type, location, emissions, units, intensity) where an unmeasured row says so rather than printing 0, and a footnote that site emissions are scopes 1 and 2 only and do not sum to the headline figure. Added to the four `sectionOrder` arrays, but to no `defaultSections` (stays opt-in).

### 4. Surfacing in the builder

New `GET /api/reports/completeness?year=` (Bearer + RLS, replacing the deleted `preview-data`) runs the same gathers plus the same pure catalogue, so the builder and the document agree by construction. `FunnelSections` shows, under each selected section, `3 of 9 measures recorded` plus an expandable list of the missing ones with deep links, in the EPR page's existing gap-row idiom (Panel, `StateChip tone="attention"`, "Missing: …" rows linking to the fix, collapsed after five). The existing coarse `useReportDataAvailability` stays as-is for preselection and the "Data ready" chip; consolidating the three oracles is a follow-up, deliberately not in the same commit as the renderer change.

## Order (green at every step)

1. `sections/types.ts`, interfaces moved out of the renderer. No behaviour change.
2. Extract `lib/governance/score.ts` with a fixture test pinning current output (proves the move is behaviour-preserving).
3. The six section modules (fetchers + pure mappers) + mapper tests. Nothing renders differently yet.
4. `notMeasuredTile` / `notMeasuredBlock` in studio-kit, unused.
5. `section-completeness.ts` + tests. Still dark.
6. Renderer: normalisation, skeletons, de-gating, `SECTION_TO_TOPIC` fix (+ a test asserting every value exists in the topic library). **Behaviour changes here.**
7. Facilities page + style orders.
8. Wire the assembler (gated `Promise.all`, `dataAvailability` as reporting, `sectionCompleteness` attached) + a test pinning that an unselected section issues no queries.
9. `/api/reports/completeness` + FunnelSections gap rows.
10. Cleanup: delete `preview-data`, fix the sample route's 0-1 scale bug.

## Verification

- Scoped vitest only (`lib/reports`, `lib/pdf`, `lib/provenance`, `components/report-builder`, `lib/governance`), `npx tsc --noEmit` after steps 1, 6 and 8. Renderer tests follow `lib/pdf/__tests__/render-report-phase-d.test.ts` (literal config + data, substring and `indexOf` ordering assertions; titles are HTML-escaped). Pin: an all-null payload still renders the page with "Not yet measured" and zero `N/A`; a null `livingWageCompliance` renders a tile rather than dropping it; `total_co2e: 12500` renders `12.5`; an unmeasured facility row never prints `0`.
- Browser on local (Local Dev Co, org `11111111-1111-1111-1111-111111111111`: 1 facility, 3 products, thin social data — the skeletons are the feature, so thin data is the better test). Tick People & Culture with no people data and confirm the page now appears as a skeleton; add one `people_workforce_demographics` row via `/people-culture/diversity-inclusion` and confirm gender diversity and turnover populate while living wage, training and pay gap stay skeletons beside them — that mixed state is exactly what Tim described. Tick Governance and confirm the Targets page finally shows climate commitments. Check both the PDF and screen paths.

## Recorded, not in scope

`hasVineyards` gates the vineyards page with no section check (same family); the dashboards' invented fallbacks now disagree with the report (the report is the correct one); consolidating `useReportDataAvailability` + `sectionCompleteness` + `dataAvailability` into one oracle.
