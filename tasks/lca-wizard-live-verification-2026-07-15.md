# LCA wizard — live end-to-end verification (2026-07-15)

Closes the two "Done (unverified)" items from the product-creation remediation. Both
exercised live in the browser against **local Supabase** via `dev-main` (port 8888),
on **product 12 "Botanical Spirit (demo)"** in org **Local Dev Co** (`11111111…`, Canopy).
Code under test on `main` and identical in the worktree.

## Test 1 — Boundary-change demotion (WizardContext.tsx ~1285) ✅

Opened the wizard on the completed PCF (`b0aa2ca5…`, `completed` / `cradle_to_gate`),
changed the System Boundary radio to **Cradle-to-Grave** (through the "Change System
Boundary?" confirm dialog). Autosave then:

- flipped the PCF `completed` → **`draft`**
- wrote `system_boundary = cradle-to-grave` on the PCF
- mirror-wrote `products.system_boundary = cradle_to_grave` (DB enum via `boundaryToDbEnum`) + `last_wizard_settings.systemBoundary`
- logged the exact warning: `[WizardContext] System boundary changed on a completed LCA — demoting to draft; the results must be recalculated under the new boundary.`
- the wizard expanded the stepper (Distribution / Use / End-of-Life inserted) so **Calculate is no longer complete → prompts recalculation**

**Why it "wouldn't update under automation" before:** the `RadioGroupItem` is `sr-only`
(the visible click target is the `<label>`); the wider boundaries are **tier-gated**
(disabled below Canopy — the demo product's own org "New Day Drinks" is a trial, so the
current org had to be switched to Canopy "Local Dev Co"); and a confirm dialog gates the
change. A synthetic coordinate click hits the hidden/disabled radio and no-ops. A real DOM
click on the label fires `onValueChange` correctly.

**Secondary observation (not blocking, worth a look):** on resume, no boundary radio shows
`aria-checked` — `formData.systemBoundary` doesn't match the hyphenated radio values at load
time (stored `cradle_to_gate` vs radio `cradle-to-gate`). Cosmetic: the current boundary
isn't highlighted until the user re-picks. Demotion + calc are unaffected.

## Test 2 — Full calc writes projection columns + fingerprint ✅

A real wizard calculation inserted 10 `product_carbon_footprint_materials` rows:

- **`source_material_id`** — populated on every row, and each equals the source
  `product_materials.id` (verified by join). This is the stable key the aggregator's
  end-of-life loop uses for pathway overrides.
- **`reuse_trips` / `container_material`** — written on every row; null when the recipe
  leaves them unset. Confirmed **non-null passthrough** by setting the glass bottle's
  `container_material='glass'` / `reuse_trips=20` and re-running: the PCF row then carried
  `container_material=glass`, `reuse_trips=20`.
- **`calculation_fingerprint`** — populated (64-char SHA-256) and **input-sensitive**:
  changed (`424844b6…` → `42e108be…`) when the recipe changed.

**Local friction (the reason this was never run live):** local Supabase ships **no
emission-factor data** (all factor tables empty), and the Calculate button is *correctly*
disabled until (a) every material resolves a factor and (b) linked facilities have a
production volume. To get past validation we seeded placeholder `staging_emission_factors`
(org-scoped so RLS `user_has_organization_access` passes) and one `facility_reporting_sessions`
row (24000 units, `data_source_type='Primary'`), and cleared a stale empty
`draft_data.facilityAllocations` so the wizard recomputed the volume from the session.

## Cleanup

All verification fixtures removed (single transaction): placeholder staging factors deleted,
facility reporting session deleted, glass-bottle recipe reverted to null. Product 12's PCF
material rows deleted and the PCF reset to `draft` with `calculation_fingerprint` nulled so it
does **not** present placeholder-factor numbers as a finished footprint. The PCF was never
defined in `supabase/seed.sql`, so a `supabase db reset` restores pristine local state.
Current-org preference for `dev@local.test` left on "Local Dev Co".
