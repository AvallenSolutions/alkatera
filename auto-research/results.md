# Auto Research Engineer — Results Log

**Optimising:** average First Load JS across the 18 main pages (KB). **Lower is better.**
**Scoring:** `auto-research/score.mjs` (locked). **Asset:** the shared shell + each main page's import graph (see `instructions.md`).

---

## Baseline (2026-06-28)

**Average First Load JS = 249.006 KB** across 18 main routes. _(official, scored by `score.mjs`)_

| Route | First Load JS (KB) | Own JS |
|---|---:|---:|
| /pulse | 462 | 73.6 kB |
| /performance | 413 | 76.3 kB |
| /products | 367 | 23.2 kB |
| /settings | 305 | 39 kB |
| /suppliers | 289 | 17.2 kB |
| /company/facilities | 275 | 3.53 kB |
| /people-culture | 234 | 11 kB |
| /nature-assessment | 230 | 12.9 kB |
| /certifications | 225 | 7.89 kB |
| /community-impact | 223 | 12.8 kB |
| /knowledge-bank | 216 | 5.98 kB |
| /governance | 215 | 14.6 kB |
| /data/sources | 208 | 14.4 kB |
| /epr | 207 | 14.3 kB |
| /evidence-library | 190 | 5.65 kB |
| /reports | 177 | 11.8 kB |
| /hospitality | 158 | 12 kB |
| /dashboard | 88.1 | 194 B |

**Read of the levers:**
- `/company/facilities` is 275 KB with only 3.5 KB of own JS → ~271 KB is **shared chunk**. The shared chunk rides on *every* page, so trimming it improves the average 18×. Highest leverage.
- `/pulse` (73.6) and `/performance` (76.3) carry heavy own JS — likely recharts / react-grid-layout / maps eagerly imported. Dynamic-import candidates.

---

## Rounds

| # | Hypothesis | Change | Before (KB) | After (KB) | Result |
|---|-----------|--------|------------:|-----------:|--------|
| 1 | The shared chunk's conditionally-shown overlays inflate first load | `dynamic()` import `OnboardingWizard` + `SupplierOnboardingWizard` + `RosaDrawer` in `AppLayout` | 249.006 | 249.511 | ❌ **reverted** (+0.5; loader overhead > savings — overlays weren't in the eager chunk) |
| 2 | `/pulse`'s react-grid-layout bundle shouldn't be in first load | `dynamic({ssr:false})` import of `PulseGrid` in `PulseShell` | 249.006 | 248.25 | ✅ **kept** (`/pulse` 462→438, −24 KB) |
| 3 | `/performance`'s 8 deep-dive/sheet panels only show on expand — recharts shouldn't be in first load | `dynamic({ssr:false})` import of all 8 vitality DeepDive/Sheet components | 248.25 | 238.594 | ✅ **kept** (`/performance` 413→237, **−176 KB**) |
| 4 | `/products` portfolio matrix (recharts, behind a tab) + import wizard (modal) needn't be in first load | `dynamic({ssr:false})` import of `ProductPortfolioMatrix` + `WebsiteImportFlow` | 238.594 | 232.544 | ✅ **kept** (`/products` 368→258, **−110 KB**) |
| 5 | Only one `/settings` tab shows at a time — the other 7 panels needn't be in first load | `dynamic({ssr:false})` import of all 8 settings tab panels | 232.544 | 228.95 | ✅ **kept** (`/settings` 307→236, **−71 KB**) |
| 6 | `/pulse`'s ~24 widget drill/expanded slots only render on drill — recharts shouldn't be in first load | `dynamic({ssr:false})` import of `WidgetDrillOverlay` + `WaterfallSlotMount` + 22 `ExpandedSlot`s | 228.95 | 225.644 | ✅ **kept** (`/pulse` 438→368, **−70 KB**) |
| 7 | `/company/facilities`'s add-wizard (open-gated modal) pulls Google Maps via LocationPicker into first load | `dynamic({ssr:false})` import of `AddFacilityWizard` | 225.644 | 223.2 | ✅ **kept** (`/company/facilities` 277→237, **−40 KB**) |
| 8 | `/suppliers`' gated panels + ESG modal needn't be in first load | `dynamic({ssr:false})` import of `SuppliersByEmissions` + `SupplierTieringPanel` + `SendEsgSurveyDialog` | 223.2 | 221.761 | ✅ **kept** (`/suppliers` 292→266, **−26 KB**) |
| 9 | `/people-culture`'s 4 dashboards each live in a non-default tab | `dynamic({ssr:false})` import of `FairWork`/`Diversity`/`Training`/`Wellbeing` dashboards | 221.761 | 221.1 | ✅ **kept** (`/people-culture` 236→221, −15 KB; avg held down by reshuffle) |
| 10 | `/governance`'s policy + board-composition panels live in non-default tabs | `dynamic({ssr:false})` import of `PolicyDashboard` + `BoardCompositionChart` | 221.1 | 220.772 | ✅ **kept** (`/governance` 218→210, −8 KB) |
| 11 | The shared chunk (all 18 pages) can shed `Header`'s command palette + feedback dialog | `dynamic({ssr:false})` import of `CommandPalette` + `FeedbackDialog` in `Header` | 220.772 | 220.883 | ❌ **reverted** (+0.1; shared chunk already lean — these were pre-split, loader overhead only) |

**Running baseline: 220.772 KB. (−28.2 KB / −11.3% from start.)**

> Shared chunk verified already-optimised: posthog is deferred via idle-callback in `app/providers.tsx`, recharts is in `optimizePackageImports`. The ~89 KB floor is framework + essential providers. No easy give there (rounds 1 & 11 both confirmed). Remaining wins are per-page on the few still-heavy routes.

**Winning pattern confirmed:** heavy libs (recharts, react-grid-layout, modals) statically imported but only shown on a tab/expand/open → `dynamic({ssr:false})`.

> Note: per-page numbers wobble ~±0.5 KB when the module graph changes (webpack reshuffles the shared chunk). Strategy: chase big per-page cuts so the real saving dwarfs the reshuffle noise.

---

## Summary (after 11 rounds)

**249.006 KB → 220.772 KB average First Load JS. −28.2 KB / −11.3% across all 18 main pages.**
**9 kept, 2 reverted.** Every kept change is applied in the working tree (uncommitted).

Biggest single-page cuts:
- `/performance` 413 → 237 (**−176 KB**)
- `/products` 368 → 258 (**−110 KB**)
- `/settings` 307 → 236 (**−71 KB**)
- `/pulse` 462 → 368 (**−94 KB**, rounds 2+6)
- `/company/facilities` 277 → 237 (**−40 KB**)
- `/suppliers` 292 → 266 (**−26 KB**)
- `/people-culture` 236 → 221, `/governance` 218 → 210

**The winning pattern (9/9 keeps):** heavy bundles (recharts, react-grid-layout, Google
Maps, large tab/modal panels) that were statically imported but only render on a
tab/expand/drill/open → `dynamic({ssr:false})`.

**What didn't work (2 reverts):** deferring small React-component overlays already in
split chunks (rounds 1 & 11) — the dynamic loader cost more than it saved.

**Why the loop plateaued (honest):**
1. Shared chunk (~89 KB on every page) is already lean — posthog is deferred, recharts
   is tree-shaken. No easy give (rounds 1 & 11 proved it).
2. The remaining heavy pages' weight is now in **default-visible, above-the-fold**
   content (e.g. `/pulse` hero). Lazy-loading that would lower the score but just move
   the wait to post-hydration — gaming the proxy, not a real win. Out of bounds.
3. The 8 untouched mid pages are inline-heavy with **no separable components** to defer.

**To go further would need a bigger call (Tim's):** replace recharts with a lighter
chart lib across ~41 components, split inline JSX on the big pages, or switch the metric
to real LCP. All change risk/scope beyond the autonomous lazy-load loop.

---

_Each row: one hypothesis, one change, scored by `score.mjs` only. Kept if strictly
lower than the running baseline, otherwise reverted._
