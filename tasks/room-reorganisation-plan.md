# Room reorganisation + the "what do you work with?" question

Branch: `redesign`. Agreed with Tim, 24 July 2026.

## The new house

| Room | Tabs | Overflow (More…) |
|------|------|------------------|
| Today | Brief, Pulse, Financial | — |
| Evidence | Reports, LCAs (complete only), Vitality, Emissions | Certifications, Guardian, Targets, Company footprint, Nature, Historical |
| Network | Suppliers, Experts, Messages, Support, Sourcing | — |
| Cellar | Products, Liquids, Packaging, Ingredients | — |
| Workbench | Facilities, Spend, Integrations, Quality, Fleet, Sources | Inventory ledger + declared modules |
| Library | Your library, Knowledge, Wiki, Uploads | — |
| Wiring | unchanged | unchanged |

Moves: `/performance/` cellar → evidence. `/reports/lcas/` cellar → evidence.
`/nature-assessment/` cellar → evidence. `/data/scope-1-2/` workbench → evidence.
`/evidence-library/` evidence → library. `/uploads/` workbench → library.

Nothing is deleted. Every surface Tim's list did not name keeps a home in its
room's overflow and on the room landing.

## Tim's four decisions

1. **Beta flags go.** `viticulture_beta` / `orchard_beta` / `arable_beta` /
   `hospitality_beta` stop being admin-granted betas and become ordinary
   Canopy-tier features: `viticulture`, `orchards`, `arable_fields`,
   `hospitality`. Tier gating stays. The onboarding question marks them as
   Canopy so it reads as an incentive.
2. **Cellar poster** = products and LCA coverage ("12 PRODUCTS · 8 WITH A
   COMPLETE LCA"). Evidence takes the vitality score as its hero poster.
3. **Draft LCAs** are reachable from the product page only. The LCAs list
   shows completed work.
4. **The question** is its own arrival screen, straight after "Where you make
   it". The ritual goes 7 → 8 steps.

## Data model

New column `organizations.works_with jsonb DEFAULT '[]'` — the modules this
business declares it needs, e.g. `["viticulture","hospitality"]`. Distinct
from `feature_flags` (access grants) on purpose: this is what the business
does, the tier decides what they can open.

Visibility rule: a module surfaces in the Workbench when it is **declared**.
It opens when the org is **Canopy**. A declared module on a lower tier shows
with a CANOPY chip and the FeatureGate upsell — the incentive.

## Work

- [x] 1. Migration: `works_with` column, seed it from the four dead beta
      flags, strip those keys from `feature_flags`, regenerate
      `subscription_tier_limits.features_enabled`.
- [x] 2. Feature catalog: four codes move from `BETA_FEATURES` to
      `FEATURE_MIN_TIER` at canopy; rename; drop "(Beta)" copy everywhere.
- [x] 3. API gates: drop the `feature_flags` override, keep the canopy check.
- [x] 4. `platform-rooms.ts`: new tabs, new prefixes, module-aware overflow.
- [x] 5. `AppLayout`: pass the org's declared modules into the room.
- [x] 6. Room landings + counts APIs: cellar, evidence, library, workbench.
- [x] 7. Onboarding: `arrival-modules` step, types, wizard wiring, save route.
- [x] 8. Settings: change the answer later.
- [x] 9. Copy: `help-map.ts`, `room-guides.ts`.
- [x] 10. Tests.

## Review

All ten items landed. What is worth knowing afterwards:

**The registry is the only place rooms are defined**, and a new test asserts
the invariant that every tab and overflow entry resolves back to its own room
via `roomForPath`. That would have caught the `/evidence-library` → brick bug
before it shipped (the prefix has to beat `/evidence`). Two deliberate
exceptions, both settings deep links: `?tab=integrations` and `?tab=billing`,
because `roomForPath` only ever sees a pathname.

**The four modules are not in the static registry at all.** `roomWithModules`
appends the declared ones per org, so a business that grows nothing never sees
the words "vineyards" or "orchards" anywhere. That is stricter than the old
More… menu, which leaked every label to everyone.

**Declared and entitled are separate on purpose.** `works_with` says what the
business does; the Canopy tier says what opens. A declared module on a lower
tier still shows in the workbench wearing a CANOPY chip and links to billing.
Hiding it would have made the upsell invisible, which is the opposite of what
Tim asked for.

**The beta flags are gone**, not renamed in place: `viticulture_beta` and
friends became the ordinary canopy features `viticulture`, `orchards`,
`arable_fields`, `hospitality`. The three near-identical tier checks in the
vineyards/orchards/arable routes collapsed into one
`requireModuleAccess` helper.

### Verified

- `tsc --noEmit` clean; `pnpm build` compiles every route.
- 165 tests green across `components/studio`, `lib/studio`, `lib/onboarding`,
  `lib/subscription` (run per-directory — the full vitest run hangs, see the
  lessons file).
- Both migrations applied to the local DB and re-applied to prove idempotency;
  the seed carried an org's three old beta grants into `works_with` and the
  CHECK constraint rejects unknown keys, non-strings and objects.
- Every moved route returns 200 and every counts API returns 401 rather than
  500.

### Not verified

No authenticated browser pass — the local session needs a login I do not
enter. The band colours, the new posters and the arrival modules screen have
not been seen rendered with real data. Worth a click-through before this
leaves the branch.

### Left alone

`/settings?tab=integrations` only renders for org admins, so a non-admin
clicking the workbench's Integrations tab lands on an empty tab. That is the
pre-existing behaviour of the wiring room's Billing tab, so it is not a new
break, but it is a real rough edge if the workbench makes it common.
