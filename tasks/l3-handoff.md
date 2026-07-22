# Handoff: L3 — composition as the creation flow
Updated: 2026-07-22 | Branch: `redesign` | Worktree: `.claude/worktrees/redesign` | Dev port: 8896

> NOTE: `tasks/handoff.md` is a DIFFERENT programme (sustainability report sections +
> the v2 launch strategy). Read it for context if useful, but do not overwrite it and
> do not work from its Next list. This file is the liquid-and-pack handoff.

## Goal

A product is a composition: **one liquid, at a fill volume, in one pack format, sold
through one or more routes to market.** The liquid entity (L1) and the pack format
entity (L2) both exist and work. L3 is the payoff: "New product" becomes three picks
rather than forty fields, with a footprint forming live as you pick, and
`ingredients_templates` finally retires.

Plans, all current, read in this order:
1. `tasks/liquid-and-pack-plan.md` — the entities and phases; §4 L3, §6 decisions,
   and a progress log at the bottom that is up to date as of this handoff.
2. `tasks/liquid-pack-entry-design.md` — §4 is the composition surface design, §7 the
   build order for the entry ladder, §8 the settled decisions.
3. `tasks/lca-end-use-scenarios-plan.md` — routes to market, already shipped; the
   mirror pattern L1/L2 copied.

## Done (verified)

22 commits this session, `a6f0b0d6`..`3054c4d8`. Nothing pushed, nothing merged.

- **Audit Phase 1** (org/facility inheritance). EPR activity/nation/household inherit
  from `epr_organization_settings`. Measured on real local rows: 31 gaps / 67 questions
  → 5 gaps / 5 questions. `BulkEditStep` deleted, EPR wizard 16 → 15 steps.
- **Audit Phase 2.** `ingredients` promoted to a real record (was 0 rows against 96
  unlinked material rows); find-or-create on save; `material_id` populated for the
  first time. `supplier_products` gained transport legs + inbound container. Packaging
  template class/variant round-trip fixed. Ingredient shelf at `/products/ingredients`.
  Verified end to end: 6 records created from the demo gin, 6 rows linked, second save
  idempotent, blanked fields refilled from the record on reload.
- **L1.** `liquids` + `products.liquid_id`, 1:1 backfill, fan-out on recipe save.
  Verified: two products sharing a liquid, saving one wrote all 6 ingredients to the
  other. Shelf at `/products/liquids`, rename, identity + propose-only merge (merge
  clicked through: 2 liquids → 1, both formats sharing).
- **L2.** `pack_formats` + `products.pack_format_id`, same shape. Verified: saving one
  product wrote all 5 packaging rows to its sibling **while its recipe stayed at 0
  ingredients** (material-type scoping holds). Shelf at `/products/packs`, identity +
  merge clicked through.
- **Nav.** LIQUIDS / PACKS / INGREDIENTS tabs in the cellar. Fixed a live bug while
  adding them: NO tab had ever shown as active in ANY room (hrefs carry a trailing
  slash, `usePathname()` does not).
- **Org-mismatch class closed.** `RecipeEditorPanel` handed the browser's current org
  to a dozen children; now derived from the product once.

## Done (unverified) — treat as claims

- **The composition switch flow via the UI.** "Use another liquid" / "Use another pack"
  was never clicked end to end: Radix Select's popper would not open in the Browser
  pane (see Gotchas). The switch LOGIC is unit-tested (`switch-composition.test.ts`,
  7 tests incl. ordering and failure cases) and the org bug that made the picker offer
  nothing is fixed, but nobody has actually completed the interaction.
- **`POST /api/products/[id]/recalc`.** Written and type-checks; never observed
  dispatching successfully. `INNGEST_EVENT_KEY` is almost certainly unset locally, so
  it returns `{dispatched:false}`. Its auth path (`resolveAccessibleOrg`,
  `denyReadOnlyAdvisor`) is unexercised.
- **Pack format rename.** Same component shape as the liquid rename, which WAS clicked
  through. The pack one was not.
- **The fan-out toasts** (`describeFanout`) — logic is tested, never seen on screen.

## In flight

Nothing. Both worktrees clean, tree committed, `tsc --noEmit` = 0, 197 tests pass
across the products/suppliers/studio/EPR suites.

## Next

1. **Composition surface** (entry-design §4). One screen, three slots: liquid, fill
   volume, pack format. Each slot offers "pick existing" first, then a ladder to start
   one inline without navigating away. The number forms as soon as two slots hold
   anything (estimate-first birth, dossier plan phase 4). No Save button moment.
2. **Second-format flow from a product**: "Same liquid, different pack" pre-fills the
   liquid slot. `CompositionStrip` already does the switch; this is the create-side
   entry to it.
3. **Retire `ingredients_templates` (UI only).** Decision 4: the table and the
   template→liquid conversion SURVIVE until the production import has run. A template
   is just a liquid nothing links to yet. Do not drop the table.
4. **Maturation + production stages onto the liquid.** Listed in the plan as part of
   the liquid; still hang off the product. Needs a migration.
5. Then the entry ladder in §7 order: brew sheet → liquid extraction, spec sheet →
   pack, archetype liquids, Breww import, the supplier flywheel.

## Gotchas and decisions

- **`product_materials` is the calculator's contract.** Liquid and pack are
  authoring-layer entities that WRITE those rows. No engine changes. This is what makes
  all of it safe against the sacred calculator.
- **Propose, never rewrite.** Duplicate ingredients, identical liquids and identical
  packs are all detected and PROPOSED; the user merges. This is why there is no unique
  index on `(organization_id, lower(name))` anywhere, and why no backfill invents
  records by name-matching.
- **Identity is exact, not fuzzy**, and deliberately so: a wrong merge proposal invites
  someone to destroy a real distinction. Units are NOT converted (12 g vs 0.012 kg stay
  distinct). Pack fingerprints exclude the component NAME and include the category.
- **Generalised, not duplicated.** `composition-fanout`, `switch-composition` and
  `composition-identity` serve both halves, parameterised by link column and material
  type. Do not fork them for L3.
- **Migrations**: no `CREATE POLICY IF NOT EXISTS` in Postgres, so DROP each policy
  first or a re-run fails. Avoid `$$`-quoted bodies (statement splitters cut them);
  reuse `public.update_updated_at_column`.
- **Browser pane**: its viewport was 0×0 for most of this session, which made clicks
  land at (0,0) and typing go nowhere. `resize_window` to 1280×900 fixes it — do that
  FIRST. Even then Radix Select poppers would not open; drive selects another way or
  extract the logic and unit-test it.
- **Worktree discipline**: the shell's cwd reset to the session worktree mid-session and
  a file got edited in the wrong checkout. Use absolute paths under
  `.claude/worktrees/redesign` for edits, or `pwd` first.
- **Never merge `redesign` to `main`.** Netlify only builds main. Nothing is pushed.
- **Local dev = local Supabase only.** No prod service-role key in this workspace.

## Pending Tim actions

- **Staging migration history is inconsistent with its schema.** All five migrations are
  on `alkatera-staging` (`vwhdyqvlgjqmlzmsvaes`), but the first four were pasted into
  the SQL editor, which writes no row to `supabase_migrations.schema_migrations`.
  Staging's recorded history still ends at `20260719140000`; only `pack_formats` is
  recorded. A `db diff` against staging will propose recreating tables that exist.
  Offered to backfill the four rows; not yet done.
- **`Alkatera2` (`dfcezkyaejrxmbwunhry`) has NONE of this schema.** If that is
  production, the whole liquid/pack/ingredient layer is staging-only. An earlier version
  of the plan log wrongly said "applied to prod"; corrected.
- **Decide the ingredient backfill.** `ingredients` fills only as recipes are re-saved,
  so the shelf and the Xero linker are empty on any environment until then. A backfill
  from distinct `material_name` is possible but creates records by name-matching, which
  the propose-only decision argues against.
- **DEFRA 2026 road freight** (plan §5). HGV factors up 12–13%; a data operation via
  the admin reference-data surface, staging first. Fold into the same customer
  communication as the parametric-packaging recalc.

## Opener for the next session

`Read tasks/l3-handoff.md and continue.`
