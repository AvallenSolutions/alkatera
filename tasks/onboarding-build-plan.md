# Build plan: The First Hour

**Builds:** `tasks/onboarding-uxui-spec.md` (+ prototype `tasks/prototypes/first-hour-prototype.html`).
**Where:** the `redesign` branch/worktree only (dev :8891). Never merged to main before the go-live pass.
**Shape:** seven phases. Each phase ships something verifiable on its own and the ritual keeps working after every phase, so we can stop or reorder at any phase boundary. Phases 1 and 2 can run in parallel; everything else is sequenced.

Rough sizing: S = half a day to a day, M = 2 to 4 days. Total is roughly 3 working weeks of focused build plus the Phase 0 harness work.

---

> **Progress (2026-07-23):**
> - **Phase 0: COMPLETE.** Stripe test webhook + staging env (Option A, same var names) + Companies
>   House key + Gemini confirmed + redeployed; staging smoke-checked live. Guide: redesign
>   `tasks/phase-0-setup.md`.
> - **Phase 1 · doorstep slice: DONE + verified on :8896.** `lib/enrich/{domain,companies-house,
>   arrival-handoff}.ts` (+ 22 passing vitest); SignupForm recognises the work-email domain on blur
>   (stashes the guess, shows the recognition line) and the "Min 8"→"Min 10" copy bug is fixed;
>   ArrivalWebsiteStep pre-fills the URL from the stash. Browser-verified: work email → line + stash;
>   consumer email → line hidden + stash cleared; typecheck clean on touched files.
> - **Phase 1 · Companies House slice: DONE.** Authed `GET /api/enrich/company` (401 without auth,
>   `{profile:null}` on miss/no-key); ArrivalWebsiteStep fires the CH lookup in parallel (both the
>   website and no-website paths) and stashes it to `personalization.companiesHouse`; the confirm step
>   (FastTrackSetupStep) consumes it via an effect, filling year-founded and country when the scrape
>   didn't, with a source-aware "From Companies House." chip (existing "From your website." behaviour
>   untouched). Typecheck clean; 22 enrich tests green; route smoke-tested. Live chip shows on a full
>   cold-signup walk (needs `COMPANIES_HOUSE_API_KEY` + a real UK entity).
> - **Phase 1 COMPLETE + COMMITTED** to redesign (`ad5ecbf2`, not pushed, not main).
> - **Phase 2.1 · warmth meter: BUILT (uncommitted).** `components/onboarding/WarmthMeter.tsx` —
>   seven room marks (reusing the studio shapes + STUDIO colours) pinned at the foot of every arrival
>   screen, each lighting only on a real-data predicate from the onboarding context (wiring=org,
>   cellar=products, evidence=estimate, library=category; workbench/network/today light as Phase 3/5
>   wire their sources). Mounted in `OnboardingWizard` arrival-only, with `pb-28` so nothing hides
>   behind it. Typecheck clean. Live visual pending the cold-signup walk (needs the authed ritual; the
>   preview pane won't render isolated files this session). Mark geometry is adapted from the proven
>   `components/studio/mark.tsx`.
> - **Phase 2.2 · working ticker: BUILT (uncommitted).** `components/onboarding/WorkingTicker.tsx` —
>   one mono line showing the latest real background event (Reading {host}. → Companies House: {name},
>   incorporated {year}. → Found N products.), polling the same `GET /api/products/import-from-url/
>   [jobId]` the confirm step uses + the stashed CH facts; renders nothing until there's something
>   honest to say, stops quietly on a failed scrape. Mounted on the persona screen (the one background-
>   work screen with no existing indicator). Typecheck clean.
> - **Phase 2 COMPLETE + COMMITTED** to redesign (`553fa7b1`, not pushed, not main).
> - **Phase 3.3 · facility step: BUILT (uncommitted).** New `arrival-facility` step folded into the
>   ritual between reveal and estimate: `components/onboarding/steps/ArrivalFacilityStep.tsx`
>   (confirm-first from the Companies House registered address, else LocationPicker, plus a contract-
>   producer path). Inserts the `facilities` row, links this session's draft products, backfills coords
>   via `/api/facilities/geocode`, and stashes `facilityId`/`facilityCountry` to personalization — which
>   lights the **workbench** mark on the warmth meter and gives the estimate a real country grid factor.
>   Wired into `ARRIVAL_STEPS` (reindexed to 7 steps), the `OnboardingStep` union, `STEP_COMPONENTS`, and
>   `WarmthMeter`. Resume-safe (getStepConfig finds it; in-flight users skip it). Typecheck clean.
>   Correction: soil/land-cover is farmland-specific (not facilities), so the cascade is geocode + grid.
> - **Phase 3.3 · facility step COMMITTED** to redesign (`a31a97d6`).
> - **Phase 3.5 · plan step upgrade: BUILT (uncommitted).** `ArrivalPlanStep` now: recommends a tier
>   computed from the ritual's own data (products, facility, team size) with a reasoning band that names
>   the numbers ("You have 3 products, one site and a small team. Seed covers it with room to grow.");
>   fuller tier cards showing each tier's caps (`PRICING_TIERS.limits`); a softened covenant (no auto-
>   charge ever, a reminder before the exact trial-end date, data stays readable). Recommendation logic
>   extracted to a pure module `lib/onboarding/tier-recommendation.ts` with **8 passing vitest cases**;
>   typecheck clean. Delivers the recommended-plan feature from Tim's round-1 feedback.
> - **Phase 3.5 · plan step COMMITTED** to redesign (`1d90938e`).
> - **Phase 3.4 · estimate upgrades: BUILT (uncommitted).** `ArrivalEstimateStep` now sprouts a
>   lightweight forest strip on screen (self-contained, motion-safe — the aha lands before the card
>   ask), adds a room-attribution line, and records the facility country in the PCF methodology note.
>   Correction: the headline stays benchmark-driven — the house rule is grid intensity is additive
>   Scope 2 and never touches the headline, and lib/energy is UK-only, so a country grid multiplier
>   would be pseudo-precision. Country recorded as context, not fabricated into the number.
> - **Phase 3.1 · no-website archetype path: BUILT (uncommitted).** `ArrivalWebsiteStep`'s no-website
>   mode is now a three-tap flow (company name + country → drink type → volume bucket) that seeds
>   beverageTypes + country + annualProductionBucket, so the confirm screen reads warm and the estimate
>   step's benchmark path gives a real, bucket-driven number. No product seeding (the estimate ignores
>   the bucket once products exist, so seeding would make the chosen volume silently not count — a
>   deliberate deferral to avoid pseudo-accuracy). Typecheck clean; 30 tests green.
> - **Phase 3.1 + 3.4 COMMITTED** to redesign (`f8d266fa`).
> - **Phase 3.2 · migration door: DONE + COMMITTED** (`8b60d47f`). The "already measured before?"
>   affordance on the confirm screen promoted from a quiet link to a real dashed drop target
>   (heading + sentence). Wiring unchanged (UniversalDropzone → /api/ingest/auto → migrate-report).
> - **PHASE 3 COMPLETE.** Commits: `a31a97d6` (3.3), `1d90938e` (3.5), `f8d266fa` (3.1+3.4),
>   `8b60d47f` (3.2).
> - **PHASE 4 COMPLETE + COMMITTED** (`21d80682`). `components/onboarding/TheWalk.tsx` — the
>   house-explainer screen + six full-screen room cards, each with its real data; auto-advance +
>   keyboard; marks copied verbatim from the proven mark.tsx geometry. Return-path hardened in
>   `ArrivalPlanStep`: the walk replaces the 'checking' spinner and plays while the subscription poll
>   runs behind it (up to ~4 min), and "Go to your desk" is gated on `subscriptionReady` so a paid user
>   is never bounced to /complete-subscription. `desk-welcome.tsx` demoted: no auto-open, a quiet
>   always-available "Show me around" re-run instead. Typecheck clean; 30 tests green. Live in-ritual
>   visual awaits the cold-signup walk; the walk design matches the prototype Tim approved.
> - **Phase 5.1 + 5.3 DONE + COMMITTED** (`33fb7b00`). `first-week-card.tsx`: a first-seven-days
>   checklist that reuses the desk's growth signals for honest auto-ticking (early items pre-ticked
>   because the ritual genuinely did them; open items carry time + impact; retires at 5/5 or day 8).
>   `provenance-score.tsx`: "N% of your footprint is confirmed" under the greeting, from /provenance.
>   Both wired into the desk page. Typecheck clean; 30 tests green.
> - **Phase 5.2 · flagship-recipe ask: DONE + COMMITTED** (`47b9e5f8`). Done the right way — a new
>   'flagship_recipe' link ask in the generator (lib/asks/generate.ts), not a manual seed (the sweep
>   auto-resolves rows it didn't produce). It targets the biggest-footprint estimate-only product,
>   carries a real impact_share so it ranks top on arrival, deep-links to /products/[id]/recipe, and
>   self-cleans once the recipe is confirmed. /api/onboarding/complete now runs sweepAsks so it exists
>   on the first desk visit. 4 new tests; 63 green; typecheck clean.
> - **PHASE 5 COMPLETE.** Commits: `33fb7b00` (5.1 + 5.3), `47b9e5f8` (5.2).
> - **PHASE 6 COMPLETE + COMMITTED** (`09281dd1`). 6.1: the onboarding drip (send-onboarding-drip edge
>   fn) rewritten to the house voice — Day 1 "What we found in your house" leads with the real estimate;
>   Day 3 names the single weakest room + its one action; Day 7 reframes around estimates→evidence.
>   Retired #ccff00 neon removed (forest on paper), all em dashes and decorative emoji gone, links →
>   /desk/. 6.2 (day-23 reminder) needed **no code**: trial-reminders.ts already sends trial_ending_soon
>   at 7/3/1 days (7 = day 23, Visa-compliant) with warm copy (exact date, no auto-charge, data safe).
>   Flagged separately: send-subscription-email still uses retired neon across ~15 templates (out of
>   onboarding scope).
> - **PHASE 7 COMPLETE + COMMITTED** (`048487a9`). 7.1: /create-organization already a thin redirect;
>   /complete-subscription post-payment landings → /desk/ (full thinning deferred — it's also the Stripe
>   cancel target + cancelled re-subscribe surface + gate bounce target, so a naive redirect risks a
>   payment-gate loop). 7.2: §11 telemetry — recognition rate, time-to-first-number, card-step
>   conversion, scrape success (step drop-off already fires from the wizard); rooms-lit-at-desk +
>   flagship-confirm-within-48h noted as follow-ups (need desk/ask surfaces). 7.3: @deprecated markers
>   on the 14-step owner + 8-step fast-track flows.
>
> ## ALL SEVEN PHASES COMPLETE (redesign branch, 11 commits)
> `ad5ecbf2` P1 · `553fa7b1` P2 · `a31a97d6` P3.3 · `1d90938e` P3.5 · `f8d266fa` P3.1+3.4 ·
> `8b60d47f` P3.2 · `21d80682` P4 · `33fb7b00` P5.1+5.3 · `47b9e5f8` P5.2 · `09281dd1` P6 ·
> `048487a9` P7. All typecheck-clean; 63 unit tests green. Not pushed, not main (redesign go-live gate).
>
> ## Phase 8 · migration-arrival orientation (added after Tim's cutover question)
- **DONE + COMMITTED** (`32355de2`, local, not yet pushed). Existing/migrated customers keep their data
  and paid plan, so the ritual is skipped and they land on the desk cold. `DeskArrivalWalk` auto-plays
  the same walk on their first desk visit (introSeen falsy, wizard not open), then marks it seen; once
  seen it's a quiet "Show me around" re-run. The arrival walk now also sets `rooms.desk.introSeen` so
  new signups don't see it twice. Replaces the demoted DeskWelcome popover as the desk's orientation.
  **Persistence:** introSeen is server-side (onboarding_state via /api/onboarding), so a completed walk
  never replays on next login, on any device. Typecheck clean.
  - Follow-up (noted): for migrated users TheWalk shows generic room purpose lines (personalization is
    empty for them); could fetch live /api/desk/counts to show their real data. Nav teaching works
    either way. DeskWelcome (desk-welcome.tsx) is now unmounted/dead — removable in a later cleanup.

## Still needs Tim / a real environment (not code)
> - **The staging cold-signup E2E recording (Phase 0.2)** — the one thing that visually confirms the
>   whole ritual end to end (recognition line, warmth meter, ticker, Companies House chip, facility
>   step, estimate + sprout, plan/covenant, the walk, the desk). Needs a real cold signup + test card
>   on staging; I can drive/observe the browser with Tim once staging has the new commits deployed.
> - **Push the redesign branch** to deploy these commits to staging (currently local commits only).
>
> ## Deferred / follow-ups (flagged honestly, out of scope)
> - Full thinning of /complete-subscription (needs a coordinated AppLayout gate + ritual-remount change).
> - send-subscription-email still uses the retired #ccff00 neon across ~15 templates (design cleanup).
> - rooms-lit-at-desk + flagship-confirm-within-48h telemetry (desk/ask surfaces).

## Phase 0 · Harness and decisions (before any build)

The research found the highest-risk parts of the current arrival are exactly where this plan builds, so prove the ground first.

- [ ] **0.1 Stripe TEST-mode webhook for staging.** Add a Stripe test-mode webhook endpoint pointing at the staging URL (the handoff's known prerequisite). Without it the payment return path cannot be exercised anywhere real.
- [ ] **0.2 Baseline cold-signup click-through.** One true cold signup on staging with a test card, recorded end to end: signup → arrival ritual → checkout → return → desk. This is the "before" film and will surface the webhook-lag bounce and any DeskWelcome timing bugs before we change anything.
- [ ] **0.3 Decisions from Tim** (spec §12): Companies House UK-only at launch (recommended: yes); walk auto-advance 8s vs tap-only (recommended: auto with tap-to-skip); volumes stay on the estimate step (recommended: yes); target-setting stays out of the ritual (recommended: yes); DeskWelcome popover retired to a "Show me around again" re-run (recommended: yes).
- [ ] **0.4 Env keys.** `COMPANIES_HOUSE_API_KEY` (free) added to local + staging env; confirm `GEMINI_API_KEY` on staging so live Rosa can be exercised in the click-throughs.

**Exit test:** the baseline recording exists and staging can complete a paid arrival with a test card.

---

## Phase 1 · Enrichment before you ask (S+S)

**1.1 The doorstep.** In `components/auth/SignupForm.tsx`:
- Covenant copy replaces the hero ("Give us ten minutes. We will give you your footprint.").
- Fix the password helper copy ("Min 8 chars" → 10, matching validation).
- On work-email blur, fire a new `GET /api/enrich/domain?d=…`: candidate website (https://{domain}), site reachability, favicon/logo URL, and a Companies House candidate for UK entities. Consumer domains (gmail, outlook, etc.) skip silently. Result stashed client-side (sessionStorage) and handed to the arrival ritual after auth; nothing blocks signup.

**1.2 Companies House module.** New `lib/enrich/companies-house.ts`: search by name/domain, fetch registered name, company number, incorporation year, registered address. Pure mapper + fetch wrapper, no-op when the key is missing. Wire into:
- `ArrivalWebsiteStep` (fires alongside the scrape),
- `FastTrackSetupStep` confirm mode (new "Companies House." provenance chips),
- the facility step in Phase 3 (registered address as the pre-fill candidate).
Storage: results land in `onboarding_state.state.personalization` plus `organizations` columns that already exist (founding_year, country); the company number goes in `state` only for now (no migration).

**Verify:** vitest on the CH mapper and domain-guess logic; browser: type an @avallenspirits.com email, see the recognition card pre-filled in step 1 and CH chips in step 3.

---

## Phase 2 · Ritual chrome: warmth meter + working ticker (M)

**2.1 Warmth meter.** New `components/onboarding/WarmthMeter.tsx`, mounted by `OnboardingWizard` above the ink band on every arrival screen. Seven room marks (reuse `components/studio/mark.tsx` shapes + `STUDIO` colours). A room lights only when a real row exists: wiring = org row confirmed, cellar = draft products inserted, workbench = facility row, evidence = estimate PCF rows, network = supplier matches, library = always after category known, today = seeded cards at completion. Light state derives from `onboarding_state` + cheap count queries (extend `/api/onboarding` GET rather than new endpoints). Mono label "The house is warming · N of 7 rooms lit."

**2.2 Working ticker.** New `components/onboarding/WorkingTicker.tsx`: one mono line cycling real job events. Sources: the existing `product_import_jobs` polling the arrival already does, plus migration-engine job status when a report is dropped. Failure = the line quietly disappears; the ticker never blocks progression. Rendered by the steps that have background work (persona, confirm, facility).

**Verify:** browser click-through with a real scrape: ticker lines appear in order, meter fills at steps 1/4/5/6 per spec §8; kill the scrape mid-flight and confirm the ritual continues clean.

---

## Phase 3 · The ritual steps (M, the biggest phase)

All in `components/onboarding/steps/` + `lib/onboarding/types.ts`.

**3.1 No-website archetype path.** Replace the single name-field fallback in `ArrivalWebsiteStep` with the three tile screens (name+country, drink type, volume bucket). On completion, seed the archetype: draft products with category-typical pack formats from `lib/product-templates.ts`, benchmark estimate inputs from `lib/industry-benchmarks.ts`, all provenance `estimated`.

**3.2 Migration door promoted.** On `arrival-confirm`, the "drop your old report" affordance becomes a visible `GiveDoor`-style drop target wired to the existing migration engine (`lib/ingest/migrate-report.ts`), feeding ticker lines.

**3.3 NEW facility step.** `ArrivalFacilityStep.tsx`, inserted into `ARRIVAL_STEPS` between reveal and estimate (order bump in `types.ts` + `STEP_COMPONENTS`; the state machine must tolerate in-flight users who lack the step — resume logic appends it, never crashes).
- Pre-filled one-tap card: CH registered address, else address scraped from the website contact page, else empty `LocationPicker` (`/api/places/autocomplete`).
- "A partner makes it for us" → partner name (optional) + country; `operational_control: 'third_party'`.
- On confirm: insert the `facilities` row, then fire the background cascade (geocode → grid region via `lib/energy`, `lookupPoint` for SoilGrids + WorldCover into `geo_point_cache`). Fire-and-forget with surfaced-nowhere failures; the ritual never waits on geo.
- Skippable ("I'll place it later.").

**3.4 Estimate step upgrades.** `ArrivalEstimateStep`: use the facility country's grid factor when present instead of the fixed split; volume defaults from the archetype bucket; the forest sprout strip (`GrowthFieldMount`) grows on screen as PCF rows write; room-attribution line under the number.

**3.5 Plan step upgrades.** `ArrivalPlanStep`: covenant fact rows (exact computed trial-end date); recommended tier chip + one-sentence reason from plain threshold logic over the ritual's own counts vs `subscription_tier_limits` caps; fuller tier cards (caps + one headline capability) rendered from `lib/stripe/pricing-tiers.ts` + the same limits source as enforcement.

**Verify:** vitest for recommendation thresholds, archetype seeding, and the step-resume tolerance; two full local cold click-throughs (website path and no-website path); confirm a mid-flight legacy `onboarding_state` row resumes without error.

---

## Phase 4 · The walk + return-path hardening (M)

**4.1 The walk.** New `components/onboarding/TheWalk.tsx`: the house-explainer screen ("This is a house, not a dashboard." + seven-room index) then six full-screen room cards (colour, mark, purpose, what-lives-here line, "Already inside" data panel). Content from `components/studio/platform-rooms.ts` + `/api/desk/counts` + the ritual's own state. Tap or 8s auto-advance, arrow keys, reduced-motion respected. Ends on the existing planting moment.

**4.2 Return-path hardening.** On Stripe return (`?arrival=complete`) mount the walk immediately; the `subscription_status` poll runs silently behind it. `AppLayout`'s payment gate: allow `pending` while the walk is in progress (extend the existing `arrivalInProgress` allowance); a user who has completed checkout is **never** bounced to `/complete-subscription` — if still `pending` at walk's end, show the quiet "Finishing your setup…" line and keep polling.

**4.3 DeskWelcome demoted.** The floating-popover tour no longer auto-fires post-arrival; it becomes the "Show me around again." affordance in the desk corner. `rooms.desk.introSeen` set by the walk instead.

**Verify:** locally simulate a slow webhook (delay the status flip by 90s) and confirm: walk plays, no bounce, desk lands cleanly; run the walk at reduced motion; confirm DeskWelcome no longer double-fires under the wizard.

---

## Phase 5 · The desk's first session (M)

**5.1 First Week card.** In `components/studio/desk-priorities.tsx`: for orgs younger than 8 days, a five-item card replacing the generic setup actions. Three items pre-ticked from real state (company confirmed, facility placed, estimate written); two open items (flagship recipe confirm, first utility bill) with time + impact framing, deep-linked. Auto-tick by reading the same growth signals the checklists already use; retire at 5/5 or day 8 with a brief forest-growth beat.

**5.2 Flagship Ask of the Day.** Extend `/api/onboarding/complete` day-one seeding: the top `agent_exceptions` ask is always the flagship-product recipe confirmation, deep-linking into the compose flow **pre-filled** from scraped ingredients/pack data in confirm mode (the L3 composition flow, `products/new/compose` lineage).

**5.3 Provenance scoreboard.** The `/api/provenance` rollup ("41% of your footprint is confirmed") rendered on the desk next to the room counts.

**Verify:** fresh local org lands with the card showing exactly 3 pre-ticks; tapping the flagship ask opens compose pre-filled; confirming a recipe moves the provenance number.

---

## Phase 6 · Lifecycle emails (S)

- **6.1** Rewrite `send-onboarding-drip` in the house voice with the org's real numbers: Day 1 "What we found in your house", Day 3 the weakest room + its one action, Day 7 the before/after number if anything was confirmed.
- **6.2** New `day_23_reminder` drip type (pre-conversion notice, warm tone, exact conversion date; satisfies the Visa 7-day rule), scheduled off `subscription_expires_at`.

**Verify:** render all four templates locally with a seeded org; trigger against a test inbox and check `email_delivery_events`.

---

## Phase 7 · Legacy cleanup + telemetry (S)

- **7.1** `/create-organization` and `/complete-subscription` become thin redirects into the ritual (kept only as post-trial re-subscribe surface for `cancelled` orgs).
- **7.2** Instrument spec §11 via `lib/onboarding/telemetry.ts`: time-to-first-number, recognition rate, rooms-lit-at-desk, step-level drop-off, card-step conversion, flagship-confirm-within-48h, scrape success rate.
- **7.3** Mark the legacy owner/fast-track flows deprecated in `types.ts` (kept for in-flight rows; removal is a later, separate cleanup).

**Verify:** old URLs redirect correctly for each org state (none, pending, trial, cancelled); telemetry events visible for a full click-through.

---

## Cross-cutting rules

- **Migrations:** none required. Everything lands in existing tables (`onboarding_state.state` jsonb, `organizations`, `facilities`, `product_carbon_footprints`, `agent_exceptions`). If we later want the company number as a real column, that is one small optional migration, posted in chat per the usual practice.
- **Background work:** the scrape and migration engine already run as background jobs; the geo cascade and CH lookup are sub-second calls made fire-and-forget. Nothing new needs Inngest, and nothing in the ritual ever blocks on a job.
- **Design language:** studio primitives only (`components/studio/`), paper theme, British English, no em dashes, Rosa never "AI". The prototype is the visual reference for every screen.
- **Testing rhythm:** scoped vitest per phase (never a bare full run), a browser click-through at every phase exit, and after Phase 4 the full staging E2E with a test card repeated as the standing regression.

## Rollout

1. Phases 1 to 5 behind the redesign branch as normal (it is not user-facing until cutover).
2. After Phase 4, repeat the Phase 0 staging E2E; after Phase 5, run a fresh-org click-through end to end including live Rosa and paint-my-house (both currently unverified).
3. The go-live pass for the redesign (existing programme) picks this up wholesale; no separate launch gate.
4. First 20 to 50 real signups get a personal follow-up (the Superhuman concierge lesson): watch the telemetry funnel per §11, note where they stall, fold fixes back in.

## Suggested order of attack

Week 1: Phase 0 + Phase 1 + Phase 2. Week 2: Phase 3. Week 3: Phase 4 + Phase 5. Week 4 (part): Phases 6 and 7 + the staging regression. Phases 1 and 2 are independent; if the Stripe staging webhook (0.1) drags, everything except 4.2's verification can proceed without it.
