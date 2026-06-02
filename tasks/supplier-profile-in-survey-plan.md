# Plan: capture supplier profile data inside the survey flow

Goal: reduce drop-off before the ESG survey and collect the profile data brands need, by
turning the cold drop-into-37-questions into a short, guided, mostly pre-filled lead-in.

## The problem today (verified)
- ESG-survey invitees are deep-linked straight to `/supplier-portal/esg-assessment` and land on a
  37-question accordion with no warm-up.
- Their profile is almost empty at that point (only `name`, `contact_email`, `contact_name` from
  the invite). The full profile form at `/supplier-portal/profile` exists but needs manual
  navigation, so most suppliers never fill it.
- Result: suppliers feel they've hit a wall (clunky, drop-off), and brands see sparse supplier
  profiles (no description, industry, location/map, logo, website).

## What brands consume about a supplier (so this is the data worth asking for)
`useOrganizationSupplierDetail` / `/api/suppliers/detail` surface: name, contact_name,
industry_sector, country, address/city/country_code, lat/lng (map), website, phone, description,
logo_url, catalogue_url. All live on the `suppliers` table (supplier-owned, RLS `user_id = auth.uid()`).

## Proposed flow: "Step 1 of 2: About your business" → "Step 2 of 2: Sustainability survey"
On the ESG assessment page, show a short **About your business** lead-in ABOVE the question
accordion, framed as step 1 of 2 with a progress indicator, then the existing survey as step 2.
This keeps it on one route (the deep-link target already), reuses existing infra, and makes the
start feel quick and motivating ("this is your public profile that buyers see").

- **Never ask twice.** Pre-fill from everything we already hold (see "Pre-fill" below). The step is
  framed as "confirm your details and fill any gaps", not a blank form. A field we already have is
  shown for a quick confirm, not re-typed.
- Autosave each field to the `suppliers` table (same debounce pattern as ESG answers), so nothing
  is lost and there's no big "save" gate.
- **The core fields gate the survey** (DECISION) — BUT a pre-filled field already counts as
  satisfied. The gate only blocks on required fields that are *genuinely still empty* after
  pre-fill, so a supplier never re-enters what the brand already provided. In the common case where
  the brand already gave us name/sector/country, the supplier may only need to add a one-line
  description. Once the required basics are present, Step 1 collapses to a "✓ About your business —
  edit" summary and the survey appears below.
- Mark completion in `suppliers.onboarding_state` (JSONB already exists) so we don't re-prompt and
  can drive a "complete your profile" nudge.

## The questions (simple, plain language, mostly optional)
Keep it to ~5 prominent asks + 2 optional. Field -> input -> copy:

1. **Business name** -> text (prefilled) -> "Your business name" (we already have it; confirm/edit).
   Maps to `suppliers.name`.
2. **Your name** -> text (prefilled `contact_name`) -> "Who should buyers contact?" Optional role.
   Maps to `contact_name`.
3. **What do you supply?** [REQUIRED] -> short text -> "In a line, what does your business supply?"
   (e.g. "Organic botanicals for spirits"). Maps to `description`. High value: brands see who they are.
4. **Industry sector** [REQUIRED] -> dropdown (reuse `INDUSTRY_SECTORS` from suppliers/new) ->
   "Which sector best describes you?" Maps to `industry_sector`.
5. **Where are you based?** [REQUIRED] -> Google Places autocomplete (reuse the profile page's
   component + `useGoogleMapsKey`; key served at runtime via /api/config/maps — do NOT add a
   NEXT_PUBLIC key, it trips Netlify's secret scanner) -> one field fills `address`, `city`,
   `country`, `country_code`, `lat`, `lng`. Powers the supplier map, and country feeds B Corp
   country-risk (lhr_12) and Scope-3 logistics context.
6. **Website** (optional) -> url -> `website`.
7. **Logo** -> DEFERRED to Phase 2 (optional upload to the `supplier-logos` bucket -> `logo_url`).

Required to proceed: name, description, industry_sector, and a resolved location (at least
country) — but a pre-filled value satisfies the requirement, so the supplier only fills what's
genuinely missing. contact_name and website are optional. Validation runs before Step 2 unlocks
with a short, friendly message naming only the still-empty fields.

## Pre-fill: never ask twice (DECISION)
At Step 1 we already hold data from the brand's invite and prior records. Pre-fill each field from
the first non-empty source, in this precedence (supplier-entered data always wins):

1. The supplier's own org-scoped `suppliers` row (what the brand entered when adding/inviting them,
   e.g. via `suppliers/new`: name, contact_name, contact_email, industry_sector, country, website,
   plus anything the supplier saved earlier).
2. The supplier's OTHER `suppliers` rows for the same `user_id` (if they've completed a profile for
   another buyer, reuse it — input once across relationships).
3. The shared `platform_suppliers` directory entry (name, contact_email, contact_name,
   industry_sector, country, website, description, logo_url).
4. The `supplier_invitations` row (supplier_name, contact_person_name) and the signup `full_name`.

Implementation: a `GET /api/supplier-profile/prefill` (service-role + the supplier's user) returns
the merged best-known values; the step renders them as confirmable defaults. We typically already
have **name** (always), and often **contact_name / industry_sector / country / website**, so the
genuinely-new asks are usually just **description** and a **precise location** (the brand's invite
rarely has a full address/lat-lng).

Edge cases:
- The quick ESG-send sets `name` to the email when the brand gave no company name. If `name` looks
  like an email, surface it but ask the supplier to confirm their real business name.
- Writes never overwrite a non-empty field with a blank.

## Reuse (no new infra needed)
- `components/wizards/WizardContainer.tsx` (step/progress/validation) OR simple inline cards — see decisions.
- Address autocomplete + `useGoogleMapsKey` from `/supplier-portal/profile/page.tsx`.
- `INDUSTRY_SECTORS` from `app/(authenticated)/suppliers/new/page.tsx` (hoist to a shared const).
- Logo upload helper + `supplier-logos` bucket from the profile page.
- `suppliers.onboarding_state` + `/api/supplier-onboarding` for completion state.

## Save mechanism
Small `POST /api/supplier-profile/save` (or reuse the profile page's direct-update pattern under
RLS) that writes the handful of fields to the caller's `suppliers` row and stamps
`onboarding_state.profile_basics_done = true`. Autosave per field (1s debounce), mirroring
`useSupplierEsgAssessment`. Idempotent; never overwrites a non-empty field with blank.

## Friction reduction on the invite -> signup path (lighter touches)
- Invite landing page: add a one-line "what to expect" ("Two quick steps: tell us about your
  business, then a short survey. Free, about 10 minutes.") so expectations are set before signup.
- After accept, the lead-in step IS the gentle start, replacing the cold accordion drop.

## Brand-side payoff
Richer supplier profiles immediately (description, sector, location on the map, website, logo),
which also strengthens the B Corp supply-chain evidence and the supplier directory.

## Phasing
- Phase 1: the "About your business" lead-in step (questions 1-6) + autosave + onboarding_state
  flag + "Skip for now" + the invite "what to expect" line. Core of the ask.
- Phase 2: optional logo/catalogue upload in the step; a dashboard + brand-card "profile X% complete"
  nudge for anything skipped.
- Phase 3: prefill `website`/`country` from the brand's invite + any distributor/scraped data we
  already hold, so even fewer fields need typing.

## STATUS: Phase 1 BUILT & verified (2026-06-02)
- `lib/suppliers/industry-sectors.ts` — shared INDUSTRY_SECTORS (suppliers/new now imports it).
- `GET /api/supplier-profile/prefill` — merges best-known values (supplier's rows -> platform
  directory -> invitation -> signup name); returns `complete` (required basics present + name isn't
  an email placeholder). Service-role via getSupabaseAPIClient, scoped to the supplier's user.
- `POST /api/supplier-profile/save` — writes only non-empty provided fields to ALL the supplier's
  org-scoped rows (input once across every buyer); never blanks existing data; leaves org-specific
  fields (annual_spend/tier/notes) untouched.
- `components/suppliers/SupplierProfileStep.tsx` — "Step 1 of 2: About your business" card.
  Pre-filled confirm-and-fill-gaps form (name, your name, what you supply, sector dropdown, website,
  Google Places location). Required: name (not an email), description, sector, country. Collapses to
  a "✓ name · sector · city (Edit)" summary once complete.
- esg-assessment page: renders the step above the survey; the survey (progress + accordion +
  submit) is gated behind `showSurvey = profileComplete || isSubmitted || isVerified`, with a
  "complete the step above to unlock the survey" placeholder until done.
- Invite landing page: ESG "what to expect" now sets the two-step, ~10-min, free expectation.
- Verified: typecheck + eslint (touched files, 0 errors) + build green. Runtime flow to be tested
  on deploy (local env points at prod).
- Deferred to Phase 2: logo/catalogue upload; dashboard + brand-card "profile X% complete" nudge;
  prefilling website/country from distributor/scraped data.

## STATUS: Phase 2 BUILT & verified (2026-06-02)
- Logo upload added to the "About your business" step (optional): uploads to the existing
  `supplier-logos` bucket, preview + replace, persisted via the save route (logo_url now accepted
  by save + returned by prefill).
- `lib/suppliers/profile-completeness.ts` — shared % over name/description/sector/country/website/logo.
- `components/suppliers/ProfileCompletenessCard.tsx` — supplier dashboard nudge ("Your profile is
  X% complete", lists what's missing, CTA to /supplier-portal/profile; hidden at 100%). Wired into
  the supplier dashboard (extended its supplier query to load the needed fields).
- Brand side: a compact "Profile X% complete" indicator on the supplier detail Company Details card.
- Verified: typecheck + eslint (touched files, 0 errors) + build green. (Also fixed a pre-existing
  unescaped apostrophe in the supplier detail page.)
- Phase 3 still deferred: prefill website/country from distributor/scraped data.

## STATUS: Phase 3 BUILT & verified (2026-06-02)
- The prefill route now enriches STILL-EMPTY fields (website, country, description, logo) from the
  canonical `brand_directory` + `scraped_brand_data` we already hold.
- Match is high-confidence only: EXACT normalised name (reusing `normalizeBrandName`) or EXACT
  website/email domain (generic mailbox domains excluded). No fuzzy matching, to keep false
  positives near zero. Never overrides data we already have; supplier still confirms everything.
- Best-effort (wrapped in try/catch) so the prefill never breaks if the directory is unavailable.
- Verified: typecheck + eslint + build green. No UI change needed (directory values appear as
  confirmable defaults in the step).

## Decisions (confirmed, Tim)
1. Placement: inline lead-in on the ESG page (Step 1 of 2).
2. Friction: require the core few (description, sector, location) before the survey unlocks.
3. Location: Google Places autocomplete (map + country in one field).
4. Logo/catalogue upload: deferred to Phase 2.
