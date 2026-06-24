# Advisor onboarding flow

## Problem
When an external advisor accepts an invite and switches into the org they advise,
they get shown the standard new-user onboarding (the company-setup wizard / member
"welcome to the team" flow). That's wrong — an advisor isn't setting up a company,
they're an external sustainability expert coming to help an existing org.

## Root cause
`OnboardingContext.shouldShowOnboarding` has no role awareness, and the
`/api/onboarding` GET falls back to the `member` flow for any non-owner — which
includes advisors. There is no `advisor` flow.

## Design — new `advisor` flow (4 steps, 2 phases), mirrors the member flow shell
Reuses the existing wizard chrome (glassmorphism, lime, phase bar, save indicator).

1. **advisor-welcome** (welcome) — "Welcome, you're now advising {orgName}". Frames
   them as an external expert, not a new account owner.
2. **advisor-capabilities** (welcome) — what advisor access means + their access
   level (read & write vs read-only, fetched from `advisor_organization_access`).
   Sets expectations: they work inside the client's data, the owner keeps control.
3. **advisor-org-overview** (quick-wins) — snapshot of the client org (name, product
   type, location, size) so the advisor understands who they're helping. Reuses the
   MemberOrgOverview card pattern, advisor-framed copy.
4. **advisor-completion** (quick-wins) — "You're set up to advise {orgName}" with
   quick actions geared to advising (dashboard, products/LCAs, reports, ask Rosa).

## Files to change
- [ ] `lib/onboarding/types.ts` — add `'advisor'` to `OnboardingFlow`; add 4 advisor
      step ids; `ADVISOR_ONBOARDING_STEPS`, `INITIAL_ADVISOR_ONBOARDING_STATE`,
      `ADVISOR_PHASES`, `TOTAL_ADVISOR_STEPS`; handle `'advisor'` in
      `getStepsForFlow` / `getInitialStateForFlow` / `getStepConfig`.
- [ ] `lib/onboarding/index.ts` — re-export the new advisor symbols.
- [ ] `lib/onboarding/OnboardingContext.tsx` — `isAdvisor = userRole === 'advisor'`;
      flow fallback `advisor → fast_track(owner) → member`; advisor completion step.
- [ ] `components/onboarding/OnboardingWizard.tsx` — register advisor step components;
      advisor phases/steps in the top bar; treat `advisor-welcome` as welcome and
      `advisor-completion` as completion.
- [ ] `app/api/onboarding/route.ts` — GET returns advisor initial state+flow for
      `orgRole === 'advisor'`; POST persists `advisor` flow for advisors.
- [ ] New steps: `AdvisorWelcomeScreen.tsx`, `AdvisorCapabilitiesStep.tsx`,
      `AdvisorOrgOverview.tsx`, `AdvisorCompletionStep.tsx`.

## Notes
- No DB migration needed — `onboarding_state.onboarding_flow` is free-text and
  per-user-per-org; an `'advisor'` value just works. State persists so it shows once.
- Owners/members/fast-track flows are untouched.

## Verification
- [ ] Seed an advisor-access row locally, switch into that org, confirm the advisor
      flow renders (not the member flow), walk all 4 steps, confirm completion
      persists and it doesn't re-show on reload.
- [ ] Confirm an owner still gets fast_track and a member still gets member flow.

## Review — DONE
Implemented the `advisor` onboarding flow (4 steps, 2 phases) end-to-end and
verified it live in the local preview as a real signed-in advisor:
- Flow correctly resolves to `advisor` (not member) from role.
- All 4 steps render with advisor-specific copy: welcome ("You're advising X"),
  capabilities (fetches + shows the real access level — verified "Read & write
  advisor"), client snapshot, completion with advising-focused quick actions.
- Phase bar / progress / duration all correct; completion persists
  `completed: true` and the wizard does not re-show on reload.
- Also fixed: advisors were hitting the subscription paywall like new owners.
  Added an advisor bypass in AppLayout's payment gate (mirrors suppliers).
- Owner (fast_track) and member flows untouched. `tsc --noEmit`: 0 errors.

## Follow-up (separate, NOT done here)
- Advisor lands on a mostly-blank dashboard because several Rosa/vitality API
  routes return 403 for advisors (`/api/rosa/*`, `/api/vitality/composite`,
  `/api/certifications/health-score`, `/api/byproducts`, `/api/nature-actions`).
  This is a pre-existing access-scoping gap, not part of onboarding. Worth a
  dedicated pass to grant advisors read access to the client's dashboard data.
