# Auto Research Engineer — Results Log (/rosa hub)

**Optimising:** First Load JS of `/rosa` (KB) — the first page users land on. **Lower is better.**
**Scoring:** `auto-research/score-rosa.mjs` (locked, single route). **Rules:** same as `instructions.md`.
**Asset:** the `/rosa` import graph (`RosaCanvas` + the conditionally-rendered things it pulls).
Default-visible content (`ForYouToday` home cards) is OUT of bounds — lazy-loading above-the-fold
content games the proxy without making the page faster.

---

## Baseline

| | |
|---|---|
| Score (First Load JS of `/rosa`) | **293 KB** (official, scored by `score-rosa.mjs`) |
| Captured | 2026-06-28 |

---

## Rounds

| # | Hypothesis | Change | Before (KB) | After (KB) | Result |
|---|-----------|--------|------------:|-----------:|--------|
| 1 | `RosaQueue` only renders on the `?view=queue` surface, not the default landing | `dynamic({ssr:false})` import of `RosaQueue` in `RosaCanvas` | 293 | 252 | ✅ **kept** (**−41 KB**) |
| 2 | `HubSetupWizard` only renders first-visit (early-return); returning users never see it | `dynamic({ssr:false})` import of `HubSetupWizard` in `ForYouToday` | 252 | 251 | ✅ **kept** (−1 KB) |
| 3 | `VitalityBreakdownModal` (in the hero) is open-gated — its breakdown deps needn't be in first load | `dynamic({ssr:false})` import of `VitalityBreakdownModal` in `VitalityHero` | 251 | 224 | ✅ **kept** (**−27 KB**; also lightens `/performance` + other `VitalityHero` pages) |
| 4 | `OnboardingResumeBanner` self-gates to null once onboarding's done | `dynamic({ssr:false})` import of `OnboardingResumeBanner` in `ForYouToday` | 224 | 220 | ✅ **kept** (−4 KB) |

**Running baseline: 220 KB. (−73 KB / −24.9% from start.)**

---

## Summary (after 4 rounds)

**293 KB → 220 KB First Load JS on /rosa. −73 KB / −24.9%. 4 kept, 0 reverted.**
All applied in the working tree (uncommitted).

| Round | Change | Cut |
|---|---|--:|
| 1 | lazy `RosaQueue` (`?view=queue` surface) | **−41 KB** |
| 3 | lazy `VitalityBreakdownModal` (open-gated, in hero) | **−27 KB** |
| 4 | lazy `OnboardingResumeBanner` (self-gates) | −4 KB |
| 2 | lazy `HubSetupWizard` (first-visit only) | −1 KB |

Same winning pattern as the 18-page loop: defer heavy components that are only shown on a
non-default surface / modal / first-visit. /rosa beat the app average (−24.9% vs −11.3%)
because two fat offenders (the queue + the vitality breakdown modal) were sitting in the
landing page's first load.

**Off-limits (left untouched, by design):** `ForYouToday`'s default home cards
(`VitalityHero`, `CertificationHealthWidget`, and the layout-config widgets — all
`visible: true` by default). Lazy-loading above-the-fold landing content would lower the
score without making the page faster. No internal modals remain in the default widgets.

Files touched: `components/rosa/RosaCanvas.tsx`, `components/rosa/ForYouToday.tsx`,
`components/vitality/VitalityHero.tsx` (the last also benefits `/performance`).

---

_One hypothesis, one change, scored by `score-rosa.mjs` only. Kept if strictly lower than
the running baseline, otherwise reverted._
