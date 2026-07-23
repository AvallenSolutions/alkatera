# The First Hour: a world-class arrival for alka**tera**

**Status:** Design specification, drafted overnight 22 July 2026. Targets the redesign branch (studio design language, house of rooms). Companion prototype: `tasks/prototypes/first-hour-prototype.html`.

---

## 1. The promise

> **"By the time you sit down at your desk, the lights are on in every room."**

One sentence governs every screen: the user gives us one thing (a website URL), and we do the work. Every question we do ask must visibly change what they see. Every wait must show what we are doing for them. The aha moment (a real, provisional footprint number for *their* products) lands inside the first five minutes, before the card, and the card ask lands on a warm user who has already seen themselves in the product.

### Design principles (derived from research)

1. **Enrich before you ask.** Never ask a question the website, Companies House, or a benchmark can answer. Ask only to *confirm* or *tighten*. (Attio, Clay, FreeAgent)
2. **Estimate-first, always.** A provisional number with a confidence band beats a blank form. Every subsequent ask is framed as "tighten this number", never "fill this in". (Greenly, Watershed, and our own provenance system)
3. **The ritual teaches the house.** The spatial metaphor is unconventional, so the arrival must build the mental map by walking it, not by touring an empty desk afterwards. (The Arc lesson)
4. **Card after recognition.** The payment gate comes after the user has seen their company recognised and their first number, softened with the exact date, the no-auto-charge promise, and a designed return. (3 to 4x conversion of card-required trials, kept humane)
5. **Design the waits.** Scrape, enrichment and the Stripe webhook all take seconds to minutes. Every wait becomes a designed moment: a ticker of what we are finding, or the walk through the house itself. Never a spinner. (Mercury)
6. **Honest endowed progress.** The warmth meter starts above zero because we genuinely found things. Checklist items auto-tick when done organically. Nothing fake. (Asana, Drata)
7. **One skill per screen, full screen, fast.** Mandatory but never long. Superhuman moved setup completion from 30% to 98% by making it full-screen and opinionated.

---

## 2. The journey at a glance

```
ACT 0  The doorstep      /signup                       ~40 seconds
ACT 1  The threshold     arrival ritual (overlay)      ~4 minutes
       1 Where can we find you        (URL, org created silently, scrape fires)
       2 What do you do here          (persona tiles; scrape ticker runs behind)
       3 Here is what we found        (confirm enrichment; migration door)
       4 Here you are                 (reveal: logo, products, paint my house)
       5 Where do you make it         (first facility: one address field)
       6 Your first number            (the aha: ~N t CO2e with the forest sprouting)
       7 Choose how you continue      (trial/card, softened; Stripe checkout)
ACT 2  The walk          post-checkout return          ~90 seconds
       Six room cards, one per room, each showing ITS real data; covers webhook wait
       Ends: "Your forest has started." -> the desk
ACT 3  At the desk       /desk/                        first session
       Real counts, Ask of the Day, First Week checklist, flagship product deepening
```

Total time from signup to a personal footprint number: **under 5 minutes**. Time to the desk with every room warm: **under 8 minutes**.

---

## 3. Act 0: The doorstep (`/signup`)

Today's signup is already lean (name, email, password). Keep it to three fields, with three changes:

**3.1 Set the promise.** Replace generic hero copy with the covenant, in studio voice on paper:

> Eyebrow: `ARRIVING AT ALKATERA`
> Statement: **"Give us ten minutes. We will give you your footprint."**
> Sub: "alka**tera** reads what your business already publishes and turns it into a real sustainability picture. You confirm, we do the sums."

**3.2 Enrich from the email domain the moment it is typed.** On blur of a valid work-email field, fire a background lookup: domain → candidate website, company name, logo (favicon/clearbit-style), and a Companies House candidate for UK entities. Do not block, do not show anything yet; stash it. If the domain is a consumer provider (gmail, outlook), skip silently. This means step 1 of the ritual can open **already pre-filled**: "Is this you?" with their logo. The single highest-leverage moment in the whole flow.

**3.3 Fix the copy bug.** Password helper says "Min 8 chars"; validation requires 10 (`SignupForm.tsx:211` vs `:26`). Align to 10.

**Footprint-report inheritance (reply-hook).** When the signup arrives via the outbound footprint-report link, the token resolves the pre-computed report org: the arrival ritual opens at step 3 ("Here is what we found") with everything from the report already in place, and the estimate step shows the *same number they saw in the email*. The report morphs into the trial org; nothing is recomputed from scratch.

**Auth email.** The confirm-email step, where required, carries the same covenant copy and a note that "we are already reading your website" so even the inbox detour feels like progress.

---

## 4. Act 1: The threshold (the arrival ritual)

Builds on the existing 6-step ritual (`components/onboarding/OnboardingWizard.tsx`, `ARRIVAL_STEPS` in `lib/onboarding/types.ts`). Changes: one new step (facility), a persistent warmth meter, a working ticker, and a redesigned no-website path. Full-screen overlay on paper, mono step counter (`01 / 07`), studio ease, fade-in 500-700ms. Rosa present as a quiet line, never a mascot takeover.

### Persistent chrome (new)

- **The warmth meter.** A thin horizontal band at the foot of every ritual screen (above the ink band): a row of seven small room marks (circle, triangle, square, quarter, diamond, arch, ring) in hairline outline, each filling with its room colour as data lands in it. Label in mono: `THE HOUSE IS WARMING · 3 OF 7 ROOMS LIT`. This is the Drata readiness score translated into the house metaphor, and it is honest: a room only lights when a real row exists for it.
- **The working ticker.** Whenever background jobs run, a single mono line under the step content cycles what is actually happening: `Reading avallenspirits.com…` → `Found 6 products.` → `Found your logo.` → `Companies House: Avallen Solutions Ltd, incorporated 2018.` → `Checking your grid region…`. Sourced from real job events (`product_import_jobs`, ingest jobs), not fake. If a job fails, the line quietly disappears; nothing blocks.

### Step 1 · Where can we find you

As built (`ArrivalWebsiteStep`), plus:

- **Pre-filled from the doorstep enrichment.** If the domain lookup found a site: the input is pre-filled and a recognition card shows logo + "Is this you?" with one confirm tap. Zero typing for most users.
- **Companies House in parallel.** For UK domains/entities, fire the (free) Companies House API alongside the scrape: registered name, company number, incorporation year, registered address. These become provenance-chipped pre-fills in step 3 and seed the wiring room (legal entity) without a single question.
- **The no-website path, rebuilt.** Today this path lands on a sparse desk. Replace the single name field with three fast tiles (still under 30 seconds): company name + country, then "What do you make?" (the seven drink-type tiles), then "Roughly how much a year?" (four volume-bucket tiles: "a few thousand bottles" → "millions"). These three answers select a **benchmark archetype** (`lib/industry-benchmarks.ts`) that seeds draft products (e.g. "Your gin", 70cl glass), an estimate, and category-typical packaging, all provenance-marked `estimated`. The no-website desk is no longer sparse; it is archetype-warm with everything framed as "ours to correct".

Behind the scenes, unchanged: silent org creation (`create-organization` edge fn, status `pending`), scrape fired (`/api/products/import-from-url`).

### Step 2 · What do you do here

As built (`ArrivalPersonaStep`): four one-tap persona cards, skippable, re-weights desk order, writes Rosa memory. The scrape ticker runs beneath, so the "wait" for the scrape is spent on a question that personalises the product. No changes beyond the ticker.

### Step 3 · Here is what we found

As built (`FastTrackSetupStep` confirm mode), plus:

- **Companies House chips** alongside "From your website." chips: `From Companies House.` on legal name, incorporation year, registered address. One tap to accept all, per-field correction available.
- **The migration door promoted.** "Already have a sustainability report, a B Corp submission, or a consultant's LCA? Drop it here." moves from a quiet link to a visible third of the screen with the `GiveDoor` drop target. A dropped report fires the migration engine (`lib/ingest/migrate-report.ts`) and adds its own ticker lines ("Reading your 2024 report… found 12 confirmed figures."). This is the single biggest data-capture opportunity for switchers and it should not be hidden.
- Only unfound fields ask. Target: a website-path user confirms this screen in under 20 seconds.

### Step 4 · Here you are

As built (`FastTrackRevealStep`): logo, scraped product drafts, and **Paint my house** (brand colour → `room_palette`). The logo and the palette are pulled from the **website** during the scrape (brand metadata already returns `logo_url`; extend it to return a small palette sampled from the site's own CSS and imagery). Two additions:

- The warmth meter visibly jumps when products land (cellar mark fills plum) and when the brand colour applies (the whole meter tints). The paint moment is the emotional peak of Act 1; protect it.
- A quiet count under the products: "6 products, drafted from your website. You can correct anything later." No editing here; momentum matters more than perfection.

### Step 5 · Where do you make it (NEW)

The first facility enters the ritual. This fixes the biggest gap in the current arrival (facility creation deferred to the desk, workbench room cold on arrival). One screen, one real question:

> Eyebrow: `THE WORKBENCH`
> Statement: **"Where do you make it?"**
> One Places-autocomplete address field (reuse `LocationPicker` + `/api/places/autocomplete`), pre-filled with the Companies House registered address or the address scraped from the website contact page, as a one-tap confirm card: "Is this where production happens?" [Yes, that's us] [Somewhere else] [A partner makes it for us]

- **"A partner makes it for us"** → flips to contract-producer mode: partner name (optional) + country only. Facility row created with `operational_control: 'third_party'`.
- On confirm, the cascade fires silently: geocode the address to coordinates (`/api/facilities/geocode`), which stores lat/lng and gives the estimate a real **country grid factor** for Scope 2. One address answers a dozen future questions. Ticker: `Checking your grid region… UK grid, 2026 factors.` Workbench mark fills cobalt. (Note from build: SoilGrids soil-carbon and WorldCover land-cover are **farmland-specific** (vineyards, orchards, arable fields — separate land units), not production facilities, so they are not part of the facility cascade.)
- Skippable ("I'll place it later.") but the default path is one tap for most users because the address is pre-filled.

### Step 6 · Your first number

As built (`ArrivalEstimateStep`) with the facility now feeding it:

- Volumes: Breww auto-fill where linked; otherwise one volume field per drafted product with smart defaults from the archetype; the no-website path already answered the volume bucket so this screen may need zero input.
- The estimate records the **facility country** as real context in the PCF methodology note (tying the number to the site), and shows the number as built (`BigNumber`, ±30% band) plus a new one-line room attribution: "Most of this sits in your ingredients and your packaging. The cellar knows more." (Note from build: the headline stays benchmark-driven. The house rule is that grid intensity is *additive/enhanced Scope 2* and never touches the headline, and `lib/energy` is UK-only time-series data, not a cross-country benchmark multiplier — so baking a country grid factor into the headline estimate would be pseudo-precision. The country is recorded, not fabricated into the number.)
- **The forest sprouts on this screen.** A live `GrowthFieldMount` strip under the number: bare ground → first shoots as the estimate writes. The peak moment of the ritual belongs here, before payment, so the card ask lands after the aha.
- Per-product `product_carbon_footprints` rows written with `status='estimate'`, `estimate_source='arrival_onboarding'` as today.

### Step 7 · Choose how you continue

As built (`ArrivalPlanStep`) with the softening the research demands, plus a **recommended plan** computed from what the ritual already knows:

- **The recommendation.** Product count, facility count, team size and supplier matches are all in hand by this screen, so one tier carries a "Recommended for you" chip and a one-sentence honest reason: "You have 3 products, one distillery and a small team. Seed covers all of it with room to grow." The mapping is plain threshold logic against `subscription_tier_limits` caps (products over 10 or facilities over 2 → Blossom; over 30 or multi-site groups → Canopy), never a dark pattern: the reason names the numbers it used.
- **Fuller tier cards.** Each tier shows its real caps (products, LCAs, facilities, people, suppliers) and its one headline capability, drawn from the same `subscription_tier_limits` + feature-catalog source as the app, so the cards can never drift from enforcement.
- Above the CTA, a three-line covenant in fact-row style:
  - "Your card will not be charged automatically. Ever."
  - "We will email you before your trial ends on **21 August 2026**." (exact date, computed)
  - "If you stop, your data stays readable. Nothing is deleted."
- Primary CTA `Start your 30 days`, secondary tier cards as today. Keep Stripe `mode: 'setup'` (no auto-charge is a genuine differentiator; say it loudly).
- **Send the pre-conversion reminder email** at day 23 (Visa mandates 7 days notice; make it a warm "here is what your house looks like now" email, not a billing notice).

---

## 5. Act 2: The walk (post-checkout return)

Today the Stripe return polls `subscription_status` for up to 60 seconds behind a near-blank moment, and a timeout lands the user on the desk provisionally, where the next navigation can bounce them to `/complete-subscription`. Replace the wait entirely:

**On return (`/desk/?arrival=complete`), the walk begins immediately, regardless of webhook state.**

**First, one explainer screen: "This is a house, not a dashboard."** The navigation model is unlike conventional SaaS, so it gets named out loud before it is experienced: everything lives in one of seven rooms, every room keeps its colour, the desk is the hall, and Rosa can fetch from any room. A compact index shows all seven rooms (mark + colour + one plain sentence of what lives inside), then "Walk me through." This is the mental-map screen the Arc lesson demands.

Then six full-screen room cards, advanced by tap or an 8-second auto-advance. Each card carries four layers: the room's colour and mark, its one-sentence purpose, **a plain description of what lives in the room** (and its tab names, e.g. "In this room: Products · Liquids · Packs · Ingredients · LCAs"), and an "Already inside" panel with **its own real data**:

1. **The cellar** (plum) · "What we make." · Every product with its recipe, packaging and footprint · "6 products, drafted from your website. Your gin carries most of the footprint."
2. **The workbench** (cobalt) · "What we measure." · Sites and what they use: energy, water, waste, spend · "Your distillery in Somerset. UK grid, soil baseline mapped."
3. **The evidence** (brick) · "What we can prove." · Reports, certifications, targets; data becomes evidence once confirmed · "Your first estimate is in. Confirm data to make it reportable."
4. **The network** (ochre) · "Who we're talking to." · Suppliers and the asks that fill gaps · "3 likely suppliers matched from your ingredient list."
5. **The library** (teal) · "What we know." · Plain-language guides, no jargon · "Guides for distillers are on the shelf."
6. **Today** (forest) · "The day ahead." · Rosa's brief, each item priced in footprint impact · "Rosa has three things for you tomorrow morning."

The walk performs three jobs at once: it teaches the navigation model room by room (the Arc lesson), it proves the "lights on in every room" promise with real rows, and it absorbs webhook latency invisibly (the poll runs behind it; six cards at a human pace is 45 to 90 seconds, far beyond p99 webhook lag). If the webhook still has not landed at walk's end, only then show a quiet "Finishing your setup…" line; never bounce a user who has just paid to `/complete-subscription`.

**The walk ends on the planting moment** (as built): "Your forest has started." with the estimate, then `Go to your desk.`

Implementation note: this replaces the `DeskWelcome` floating-popover tour as the primary orientation (the popover machinery, a known fragility zone layered under the wizard, becomes a re-run affordance: "Show me around again." in the desk corner). The walk is a simple full-screen sequence, far less fragile than notch-pinned popovers over a live layout.

---

## 6. Act 3: At the desk (the first session)

The desk needs no structural change (never-empty priorities, forest, poster blocks all exist). Four additions:

**6.1 The First Week card.** A slim panel under `DeskPriorities`, replacing generic setup actions for the first 7 days: five verb-first items with honest time estimates, auto-ticked when done organically (Asana pattern), the first three pre-ticked because they genuinely happened:

- ✓ Company found and confirmed
- ✓ First facility placed
- ✓ First estimate on the table
- ○ Confirm your flagship product's recipe · 4 min · "tightens your number by about half"
- ○ Drop one utility bill on the desk · 1 min · "replaces our grid guess with your real meter"

Each open item deep-links into the room and carries its impact framing. The card retires itself at 5/5 or day 8, whichever comes first, with a one-breath celebration (the forest visibly grows; no confetti).

**6.2 Flagship-product deepening as the first Ask.** The ritual created draft products and estimates. The highest-leverage next action is confirming the flagship's composition, so `AskOfTheDay` on day one is always: "Is [Product X] your main product? Its recipe drives most of your number." → one tap opens the cellar compose flow (`/products/new/compose` lineage) **pre-filled** with scraped ingredients/pack format, in confirm-mode rather than blank-form mode. This is the bridge from "estimate" to "first real product", and it is a confirmation exercise, not data entry.

**6.3 Provenance as the scoreboard.** The desk shows the org provenance rollup ("41% of your footprint is confirmed") next to the warmth meter's final state. Every confirm action visibly moves it. This number is the long-term replacement for the onboarding checklist: setup never "ends", it asymptotes.

**6.4 Lifecycle emails re-aimed at rooms.** The existing 3-email drip (`send-onboarding-drip`) gets rewritten to the house voice: Day 1 "What we found in your house" (their actual numbers), Day 3 the single weakest room with its one action, Day 7 "your number, before and after" if they confirmed anything (social proof of their own progress). Day 23: the pre-conversion reminder (§4 step 7).

---

## 7. The capture ledger

What we hold by desk-time versus what we actually asked. The intrusion-free test: **asked count stays in single digits.**

| Data | How we got it | Asked? |
|---|---|---|
| Org name, logo, description, founding year | Website scrape + Companies House | Confirm only |
| Legal entity, company number, registered address | Companies House | Confirm only |
| Website, email domain | Signup + step 1 | 1 field (often pre-filled) |
| Persona / role | Step 2 tiles | 1 tap (skippable) |
| Product catalogue (names, sizes, ABV, categories, images, pack formats) | Website scrape | Tick to confirm |
| Ingredients + certifications | Website scrape | Not asked |
| Brand colour, room palette | Website scrape (logo + site palette) | 1 tap (paint) |
| Facility address, ownership mode | Places autocomplete, pre-filled from CH/scrape | 1 tap or 1 field |
| Grid region + factors, soil carbon, land cover | Derived from address (geo lookup) | Not asked |
| Annual volumes | Breww auto-fill / archetype bucket / per-product field | 0 to N small fields |
| First footprint estimate (per product PCF rows) | Benchmarks + scrape + facility | Not asked |
| Prior report data (switchers) | Migration engine on dropped file | 1 drop |
| Supplier candidates | Ingredient matching | Not asked |
| Payment method, billing details | Stripe checkout | Standard |
| Sustainability target | Deferred to week one (Rosa ask) | Later |

Total hard asks on the happy path: **email + password, one URL confirm, one persona tap, one confirm screen, one address tap, volumes, card.** Everything else is derived or confirmed.

---

## 8. Room-warmth guarantee

The promise is falsifiable, so specify it. By "Go to your desk", every room must hold at least one real row:

| Room | Warm by | Source |
|---|---|---|
| The cellar | Step 4 | Draft products from scrape or archetype |
| The workbench | Step 5 | Facility row + geo baselines |
| The evidence | Step 6 | Estimate PCF rows (provenance `estimated`) |
| The network | The walk | Supplier candidates from ingredient matching (auto) |
| The library | Always | Category-matched guides surfaced (wiki exists) |
| Today | Completion | `/api/onboarding/complete` seeds day-one Rosa cards |
| The wiring | Steps 1, 3, 7 | Org profile, legal entity, billing |

If any room would be cold (e.g. no-website, no ingredients → no supplier matches), its walk card degrades honestly to its purpose plus its single first action; never a fake row.

---

## 9. Edge paths

- **No website:** archetype path (§4 step 1). Desk arrives benchmark-warm, everything `estimated`.
- **Consumer email domain:** skip domain enrichment; step 1 asks for the URL normally.
- **Contract producer:** step 5 partner mode; workbench warm with a third-party facility row.
- **Footprint-report arrival:** ritual opens at step 3, inherits the report org (§3).
- **Invited members/advisors/suppliers:** unchanged; they get their existing shorter flows, never the arrival ritual.
- **Abandon mid-ritual:** `onboarding_state` resumes exactly where they left (exists today). Abandon before payment: org `pending`; day-1 email nudges back to the ritual, and the AppLayout gate returns them into the ritual (not `/complete-subscription`).
- **Stripe checkout abandoned:** return to step 7 with state intact, not to a dead end.
- **Scrape failure/timeout:** ticker line disappears; step 3 asks the (few) fields plainly; archetype seeding backfills the estimate. The ritual never blocks on a job.

---

## 10. What changes versus what exists (implementation map)

The redesign already has most of this. The delta is deliberately small and reuses existing machinery:

| # | Change | Builds on | Size |
|---|---|---|---|
| 1 | Doorstep: covenant copy + domain enrichment on email blur + password copy fix | `SignupForm.tsx` | S |
| 2 | Companies House lookup (new `lib/enrich/companies-house.ts`, free API) | step 1/3 pre-fills | S |
| 3 | Warmth meter + working ticker (ritual chrome) | job events already exist | M |
| 4 | No-website archetype path (3 tile screens) | `lib/industry-benchmarks.ts` | M |
| 5 | Migration door promoted on step 3 | `GiveDoor`, `migrate-report.ts` | S |
| 6 | NEW step 5: facility in the ritual + geo cascade | `LocationPicker`, `lib/geo` | M |
| 7 | Estimate uses facility grid factor + forest sprout on screen | `ArrivalEstimateStep`, `GrowthFieldMount` | S |
| 8 | Payment covenant copy + recommended-plan logic + fuller tier cards + day-23 reminder email | `ArrivalPlanStep`, `subscription_tier_limits`, drip fn | S |
| 9 | The walk: house-explainer screen + six room cards with room contents (replaces return-spinner AND demotes DeskWelcome popover tour) | room registry, desk counts | M |
| 10 | First Week card + flagship Ask + provenance scoreboard on desk | `DeskPriorities`, ask queue, `/api/provenance` | M |
| 11 | Drip emails rewritten to house voice + before/after numbers | `send-onboarding-drip` | S |
| 12 | Harden the return path: never bounce a paid user; poll behind the walk | `ArrivalPlanStep`, AppLayout gate | S |

Pre-existing debt this rides on (from the research, must-fix before launch):
- The full arrival + Stripe checkout has **never been walked end-to-end on staging with a real card**; a TEST-mode webhook endpoint for staging is the prerequisite for everything above.
- Live Rosa and paint-my-house untested in a true cold signup.
- Legacy `/create-organization` and `/complete-subscription` should become thin redirects into the ritual.

## 11. Measurement

Instrument the ritual (telemetry exists: `lib/onboarding/telemetry.ts`):

- **Time to first number** (signup → step 6 render). Target: p50 under 5 minutes.
- **Recognition rate** (step 1 pre-fill accepted without edit). Target: over 60% of work-email signups.
- **Rooms lit at desk-time** (warmth meter final state). Target: 7/7 median.
- **Card-step conversion** (step 6 → checkout complete) and overall signup → trial. The estimate-before-card sequencing is the hypothesis; this is its metric.
- **Flagship confirm within 48h** (the real activation event; the "second page" of alka**tera**).
- **Step-level drop-off** per screen, plus scrape success rate and ticker-visible job failures.

## 12. Open decisions for Tim

1. **Companies House** is UK-only. Fine for launch (ICP is UK/EU drinks); EU registries later?
2. **Walk auto-advance** at 8 seconds versus tap-only. I lean auto-advance with tap-to-skip; needs a feel test.
3. **Volume step placement** for the website path: ask on step 6 (as now) or fold into step 3's confirm screen? Current spec keeps step 6.
4. **Target-setting** moved out of the ritual into week one (shorter ritual, better-informed target). Reversible if you want the commitment moment earlier.
5. Whether the **DeskWelcome popover tour** is retired entirely or kept as the "Show me around again" re-run.
