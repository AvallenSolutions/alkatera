# Handoff: L3 — composition as the creation flow
Updated: 2026-07-22 (second session) | Branch: `redesign` | Worktree: `.claude/worktrees/redesign` | Dev port: 8896

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
   and a progress log at the bottom.
2. `tasks/liquid-pack-entry-design.md` — §4 is the composition surface design, §7 the
   build order for the entry ladder, §8 the settled decisions.
3. `tasks/lca-end-use-scenarios-plan.md` — routes to market, already shipped; the
   mirror pattern L1/L2 copied.

## Done (verified)

Two commits this session, `a9a2a7d4`..`9eaf65f8`, on top of the 22 from the first.
Nothing pushed, nothing merged. `tsc --noEmit` = 0, 116 product tests pass.

### From the first session
- **Audit Phase 1** (org/facility inheritance). 31 gaps / 67 questions → 5 / 5.
- **Audit Phase 2.** `ingredients` promoted to a real record; `supplier_products`
  gained transport legs + inbound container; ingredient shelf at `/products/ingredients`.
- **L1.** `liquids` + `products.liquid_id`, 1:1 backfill, fan-out on recipe save.
- **L2.** `pack_formats` + `products.pack_format_id`, same shape.
- **Nav.** LIQUIDS / PACKS / INGREDIENTS tabs; fixed the active-tab bug.
- **Org-mismatch class closed** in `RecipeEditorPanel`.

### This session
- **The composition switch, clicked through end to end at last.** On product 12 in
  Local Dev Co: the picker offered both sibling packs with their product counts,
  typing "zero" narrowed it to one, the confirm named the right pack, and the write
  landed. Packaging went 5 rows → the donor's 2 **while the 6 ingredients stayed
  untouched**, so the material-type scoping holds. Snapshot restored afterwards.
- **Three bugs fixed, all found by actually looking at it.**
  1. `KINDS.liquid.pick` was the literal string `'{K.pick}'` — the liquid strip's
     button read `{K.pick}` on screen.
  2. The Radix `Select` replaced with a new shared `RecordPicker`
     (`components/studio/record-picker.tsx`): a search field over a plain list. A
     dropdown assumes a list you can eyeball, which a producer with forty liquids
     cannot, and §4 says every slot searches. It also renders in the layout rather
     than a portal, which is what made the flow drivable at all.
  3. The confirm dialog gated on `pendingId` rather than the resolved option, so an
     id that outlived its option asked "Pack this product in **undefined**?" and
     offered to replace the recipe with nothing.
- **The composition surface** at `/products/new/compose`. Three slots, search-first
  with an inline "name a new one" ladder, fill volume inherited from the products
  already bottling the liquid, category inherited from the same donor, name derived
  and editable, rows copied through `recipeRowsFor`. Listed first on the `/products/new`
  chooser.
- **`lib/products/composition-estimate.ts`** — the live number. Prices the rows through
  the same per-row previews the recipe editor shows, and reports what it could NOT
  price instead of treating a missing factor as zero. Nine tests, including a fixture
  taken verbatim from the demo rows (that composition reads "from 2 of 8 lines").
- **Second-format entry.** "Same liquid, different pack" on the liquid strip opens the
  surface with the liquid slot pre-filled.

## Done (unverified) — treat as claims

- **Selecting a slot on the composition surface, and creating the product from it.**
  The page renders correctly against a real organisation — both pickers populated with
  its real liquids and packs, correct product counts, correct empty states — but the
  picks themselves could not be driven. See the browser-pane gotcha below; this is an
  environment limit, not a known defect. The row-copy helper and the estimate are both
  unit-tested, and the identical copy path was clicked through via the switch flow.
- **`POST /api/products/[id]/recalc`.** Unchanged from the first session: written,
  type-checks, never observed dispatching. `INNGEST_EVENT_KEY` is almost certainly
  unset locally, so it returns `{dispatched:false}`.
- **Pack format rename.** Same component shape as the liquid rename, which WAS clicked
  through. The pack one still was not.

## In flight

Nothing. Tree committed and clean.

## Next

0. **Sign in locally and click through the organisation switch** (`dev@local.test`,
   credential in `LOCAL_DEV.md`). Switch org, hard reload, confirm it sticks, and
   confirm the token claim moved. The fix in `2fb0aa73` is unverified in the browser
   because the local session got logged out while diagnosing it.
1. **Finish verifying the composition surface** — see the browser-pane note. The
   cheapest honest route is a Playwright/RTL test over `ComposeProductPage` driving
   the two picks and asserting the insert payload, rather than more time in the pane.
2. **Estimate-first birth proper.** The surface shows a selection-time estimate; the
   dossier plan's phase 4 wants an actual estimated PCF created on first materials, so
   the cellar list never shows a blank. That is the next real increment.
3. **Retire `ingredients_templates` (UI only).** Decision 4: the table and the
   template→liquid conversion SURVIVE until the production import has run. A template
   is just a liquid nothing links to yet. Do not drop the table.
4. **Maturation + production stages onto the liquid.** Needs a migration.
5. Then the entry ladder in §7 order: brew sheet → liquid extraction, spec sheet →
   pack, archetype liquids, Breww import, the supplier flywheel.

## Gotchas and decisions

- **`product_materials` is the calculator's contract.** Liquid and pack are
  authoring-layer entities that WRITE those rows. No engine changes.
- **Propose, never rewrite.** Duplicates are detected and PROPOSED; the user merges.
- **Identity is exact, not fuzzy.** Units are NOT converted. Pack fingerprints exclude
  the component NAME and include the category.
- **Generalised, not duplicated.** `composition-fanout`, `switch-composition`,
  `composition-identity` and now `RecordPicker` + `recipeRowsFor` serve both halves.
  Do not fork them.
- **Migrations**: no `CREATE POLICY IF NOT EXISTS` in Postgres, so DROP each policy
  first. Avoid `$$`-quoted bodies. Reuse `public.update_updated_at_column`.
- **Browser pane — the sharpened version.** `resize_window` to 1280×900 FIRST, or
  clicks land at (0,0). Then:
  - **Only `form_input` reliably reaches React.** Coordinate clicks never worked at
    all this session; `computer{type}` and `computer{key}` set the DOM value but do
    not fire React's `onChange`; ref-based clicks work on some pages and silently
    do nothing on others, with the handler demonstrably attached and
    `elementFromPoint` returning the right element. A fresh dev server on a clean
    port did not change it.
  - **Portalled content is invisible to `read_page`** unless you call it with
    `filter:"all"` at shallow depth — that is how the AlertDialog was finally seen.
  - **An open Radix dropdown swallows every subsequent click.** Press Escape before
    doing anything else, or the next three actions silently no-op.
  - `get_page_text` serves stale content after a client-side navigation; trust
    `javascript_tool` reading `location` and `innerText`.
- **Switching organisation** — fixed in `2fb0aa73`, and worth knowing why. The active
  org lives in `app_metadata`, baked into the access token, and that claim is what
  `get_current_organization_id()`, RLS and `get_user_bootstrap` read. `updateUser` and
  `refreshSession` both persist the session, so the old ordering raced two writes for
  one cookie and could keep the stale claim — meaning the server answered as the old
  tenant while the sidebar showed the new one. `activateOrganization` now does
  app_metadata → user_metadata → one refresh, then verifies the claim moved.
  If you touch this: never write the session twice in a switch, and never trust
  `user.app_metadata` on the client object over the decoded token claim.
- **Worktree discipline**: the shell's cwd reset to the session worktree mid-session
  again, and a test run silently executed in the wrong checkout. Use absolute paths
  under `.claude/worktrees/redesign`, or `pwd` first.
- **Never merge `redesign` to `main`.** Netlify only builds main. Nothing is pushed.
- **Local dev = local Supabase only.** No prod service-role key in this workspace.

## Pending Tim actions

- **Staging migration history is inconsistent with its schema.** All five migrations
  are on `alkatera-staging` (`vwhdyqvlgjqmlzmsvaes`), but the first four were pasted
  into the SQL editor, which writes no row to `supabase_migrations.schema_migrations`.
  Staging's recorded history still ends at `20260719140000`. A `db diff` against
  staging will propose recreating tables that exist. Offered to backfill the four
  rows; not yet done.
- **`Alkatera2` (`dfcezkyaejrxmbwunhry`) has NONE of this schema — and that is fine.**
  Settled with Tim, 22 July 2026: `Alkatera2` is today's production, and
  `alkatera-staging` is the redesign that will REPLACE it. The cutover brings real
  user data across into the new platform rather than shipping this schema back to
  `Alkatera2`. So the liquid/pack/ingredient layer being staging-only is the plan,
  not a gap, and nothing here should be back-ported.
  Two consequences worth holding onto:
  - The migration that matters is `Alkatera2` data → the redesign schema. Every
    decision that leaves data un-backfillable (see the ingredient backfill below) is
    really a question about what that cutover will be able to carry.
  - `ingredients_templates` therefore survives until the cutover import has run
    (plan decision 4). Customer templates on `Alkatera2` are real work and come
    across as liquids nothing links to yet.
- **Decide the ingredient backfill.** `ingredients` fills only as recipes are re-saved,
  so the shelf and the Xero linker are empty until then. A backfill from distinct
  `material_name` creates records by name-matching, which propose-only argues against.
- **DEFRA 2026 road freight** (plan §5). HGV factors up 12–13%; a data operation via
  the admin reference-data surface, staging first. Fold into the same customer
  communication as the parametric-packaging recalc.

## Opener for the next session

`Read tasks/l3-handoff.md and continue.`
