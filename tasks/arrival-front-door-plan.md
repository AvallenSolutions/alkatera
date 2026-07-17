# The arrival owns the front door: org creation folded into the ritual

**Worktree:** `.claude/worktrees/redesign` (branch `redesign`). Deploys to staging automatically on push (Vercel git integration). Plan copy lands as `tasks/arrival-front-door-plan.md`.

## Context

Tim logged into staging as a brand-new user and landed in the legacy journey: dark-glass `/create-organization` (asks name + product type), then the card-required `/complete-subscription` Stripe wall, and only then the studio arrival ritual, which re-asks the name and product type. The org-less state renders a blank page mid-redirect. The rule for the redesign: **ask the minimum, extract the maximum, and never arrive at an empty desk.** All the extraction machinery exists (website scrape → name/logo/brand colour/products/country/sector/year; report migration; instant estimate; ask queue). The fix is sequencing: the arrival ritual becomes the front door itself, org creation happens silently inside it, and the card step moves to the end, after the user has seen their number.

**Decisions (Tim):** website-first opening question; Stripe card step after the estimate, before the desk.

## The new journey (6 steps, all studio)

Login (org-less) → arrival mounts full-screen immediately (no redirect, no blank flash):

1. **`arrival-website` — "Where can we find you?"** One URL input. On submit: derive a provisional org name from the domain, call the existing `create-organization` edge function silently (status stays `pending`), hydrate `OrganizationContext` via the existing `mutate()`, and fire the existing `POST /api/products/import-from-url` scrape in the background (butterfly progress already built). Quiet fallback link "We do not have a website." → single name field, same silent creation, no scrape.
2. **`arrival-persona`** — unchanged one-tap step.
3. **`arrival-confirm` — "Here is what we found."** Rework of the company step: every field prefilled from the scrape with the existing "From your website." chips (name editable inline, logo, country, founding year, description; product type derived from the scraped products' categories where confident). Only unfound fields ask. Team size stays as one-tap chips. The "Already have a sustainability report? Drop it here." migration door stays here.
4. **`arrival-reveal`** — unchanged (tickable product drafts + brand-colour "paint my house").
5. **`arrival-estimate`** — unchanged (volumes → instant estimate → estimate PCFs).
6. **`arrival-plan` — the restyled trial step.** Studio screen presenting the trial/plan (reuse `app/complete-subscription/page.tsx`'s `handleStartTrial`/`handleSelectPlan` logic verbatim → `POST /api/stripe/create-checkout-session` → hosted checkout). Stripe `success_url` returns into the arrival completion: "Your forest has started." → `/desk/`.

## Implementation

1. **Org-less mount.** `components/layouts/AppLayout.tsx`: where `AppLayoutInner` currently `router.push('/create-organization')` + `return null` (lines ~129-133, 195-197), instead render the arrival experience full-screen for authed org-less non-supplier users (advisors keep their redirect). The wizard shell (`OnboardingWizard` quiet-flow chrome) already renders full-screen; mount it with a pre-org mode flag.
2. **Pre-org wizard state.** `lib/onboarding/OnboardingContext.tsx`: `shouldShowOnboarding` requires `currentOrganization`; add a pre-org branch — until an org exists, the wizard runs on local in-memory state starting at `arrival-website`; once the org is created mid-step-1, the context's org-change refetch must NOT reset the flow (write-through the in-memory state to `/api/onboarding` after creation, then continue). Guard the existing debounced save until `organizationId` exists.
3. **New steps.** `lib/onboarding/types.ts`: `ARRIVAL_STEPS` becomes the 6 steps above (`arrival-website` new, `arrival-company` → `arrival-confirm`, `arrival-plan` new); update `INITIAL_ARRIVAL_STATE`, wizard step map, and `app/api/onboarding/route.ts` fresh-owner default. In-flight arrival users on the old 5-step shape: map `arrival-company` → `arrival-confirm` on load (one-line compat in `getStepConfig`/state load).
4. **`arrival-website` step component** (new `components/onboarding/steps/ArrivalWebsiteStep.tsx`): URL input, domain→name derivation, calls the edge function exactly as `app/create-organization/page.tsx` does today (bearer token + `mutate()`), then triggers the scrape with the same payload `FastTrackSetupStep` uses. Product type is NOT asked (arrives via scrape or confirm screen).
5. **`arrival-confirm`** — refactor `FastTrackSetupStep` usage: it already autofills from the scrape with chips and writes `organizations` columns; the change is presentation-order (confirm-not-ask framing, fields already answered collapse to confirmed rows) plus product-type derivation from `guessBeverageTypeFromProducts` (exists in that file) and removing the duplicate name emphasis.
6. **`arrival-plan` step component** (new `ArrivalPlanStep.tsx`): studio restyle of the complete-subscription options (trial-first framing), reusing its checkout-session calls; `success_url` → `/desk/?arrival=complete` and the wizard's completion handler treats a `subscription_status` of `trial`/`active` + `arrival=complete` as final (fires `/api/onboarding/complete` as today).
7. **Payment gate resequencing.** `AppLayoutInner`'s gate (lines ~136-159) bounces `pending` orgs to `/complete-subscription`; change: while the arrival flow is incomplete, `pending` is allowed to remain inside the wizard (which now includes the plan step); after arrival completion, `pending` still bounces (unchanged safety). `/complete-subscription` page stays for legacy/edge cases (mid-flight users, failed webhooks).
8. **Legacy cleanup.** `app/create-organization/page.tsx` becomes a thin redirect to `/desk/` (the arrival mounts from AppLayout); `components/auth/SignupForm.tsx` redirect target `/create-organization` → `/desk/`. `/signup` orphan page keeps working (its AuthForm posts to the same signup).
9. **Copy** throughout: studio voice, British English, no em dashes, plain language.

## Files

`components/layouts/AppLayout.tsx` · `lib/onboarding/{types.ts,OnboardingContext.tsx,index.ts}` · `app/api/onboarding/route.ts` · `components/onboarding/OnboardingWizard.tsx` · new `components/onboarding/steps/{ArrivalWebsiteStep,ArrivalPlanStep}.tsx` · `components/onboarding/steps/FastTrackSetupStep.tsx` (confirm-mode) · `app/create-organization/page.tsx` · `components/auth/SignupForm.tsx` · reuse: `supabase/functions/create-organization` (unchanged), `app/complete-subscription/page.tsx` logic, scrape + reveal + estimate machinery (unchanged).

## Verification

- Local: tsc + `vitest run lib/onboarding`; browser walk on :8895 with a fresh org-less user (delete the membership row for a test user): login → website question → persona → confirm (chips) → reveal → estimate → plan step renders (Stripe checkout stubbed locally if no test keys) → desk.
- Staging: push (auto-deploys), then Tim's existing org-less `tim@alkatera.com` staging login IS the perfect test: login should land directly in the new arrival; walk it end to end with a real website and real Stripe test checkout; confirm the desk arrives prefilled (drafts, estimate, forest sprouts, asks).
- Regressions: existing org user still bypasses the wizard; member/advisor flows unchanged; invite-accept unchanged; `pending` org outside arrival still bounces to complete-subscription.

## Risks

- OnboardingContext refetch race when the org appears mid-flow (mitigated by write-through + not resetting in-memory step).
- Stripe webhook lag after checkout return: treat `?arrival=complete` return as provisional success while status flips (the gate already tolerates `trial`).
- In-flight 5-step arrival users on staging/local: compat mapping in step 3.
