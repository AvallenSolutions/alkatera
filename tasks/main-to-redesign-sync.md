# Keeping main's fixes in the redesign

Measured 2026-07-19. Tim: *"We will be moving from main to staging. We need to make sure any
updates and fixes we make to main, which is currently being used by paying users, is reflected
in the redesign."*

This is the concrete state of that problem.

## Where the two branches stand

| | |
|---|---|
| Commits on `redesign` not in `main` | **93** |
| Commits on `main` not in `redesign` | **22** |
| Last shared commit | `0132d992`, **2026-07-16** (three days ago) |

The 22 main commits redesign is missing are not cosmetic. They include the parametric packaging
factors rewrite (`257adce8`), two auth fixes, an RLS fix, the Next fetch-cache fixes across ~64
routes, the ISO 14044 data-quality gate, and everything done on 2026-07-19 (system-boundary
normalisation, the house-style module, the Rosa persona consolidation, the Rosa feedback loop and
learning surface, the four repaired test suites).

## The blocker: version collisions  ✅ MAIN'S SIDE FIXED (commit `8550d30d`)

main's four colliding migrations were renumbered to `20260719100000`-`130000`
(after redesign's latest, `20260718150000`), and `trial_tier_limits` moved to
`20260622120001` to match what redesign had already done. main now has zero
duplicate versions and no version that means a different migration on redesign.

Ordering is unchanged: nothing on main sits between `20260716110000` and the
renamed block, so they hold the same position in the sequence. All five are
byte-identical renames. Nothing needs re-applying: production records
migrations under its own apply-time timestamps and by name, never by repo
filename.

**One collision remains, on the redesign side and not fixable from main:**
`20260714200000` is shared by `product_materials_ef_metadata` and
`chemical_library_user_submissions`. Renumber the latter on `redesign` before
merging.

### The original problem, for context

| Version | On `main` | On `redesign` |
|---|---|---|
| `20260717100000` | `packaging_factor_endpoints` | `rosa_learning_cases` |
| `20260717110000` | `packaging_parametric_pins` | `rosa_exemplars` |
| `20260717120000` | `pcf_unique_active_per_year` | `rosa_eval_corpus` |

Both branches allocated the same timestamps independently. Consequences:

1. **Merging produces a tree where migrations silently do not apply.** Supabase applies by version,
   so with both files present one of each pair is skipped. No error, no warning.
2. **Staging is already poisoned for this.** It has the redesign side applied, so its
   `schema_migrations` already records `20260717100000`. Main's `packaging_factor_endpoints` can
   never apply there via `db push` — it will be treated as done. Confirmed: staging has
   `rosa_learning_cases` and `rosa_exemplars` but NOT `packaging_factor_endpoints`, while
   `lib/calculations/packaging-factor.ts` queries that table directly.
3. **`main` also collides with itself.** `20260717120000` is used by BOTH
   `pcf_unique_active_per_year` and `restore_global_staging_factor_visibility`.

**Mechanism, for the record:** `supabase_migrations.schema_migrations` has `version` as its
PRIMARY KEY, so two migrations sharing a version can never both be recorded. The second is
invisible to the tracker forever, and a later push reads that version as applied and skips
whatever did not get in.

**Staging still needs nothing done by hand.** Because main's packaging migrations now carry
versions staging has never seen (`20260719*`), they will apply cleanly on the next push rather
than being skipped as already-applied. That was the point of moving main's side rather than
redesign's.

## What prod actually looks like (checked, not assumed)

Production does NOT use the repo's filename versions. It assigns a fresh timestamp at apply time
(`20260716165949 packaging_factor_endpoints`), so the repo's duplicate-version problem has not
bitten prod. The packaging migrations ARE applied to prod.

`restore_global_staging_factor_visibility` is absent from prod's migration list, but prod's
`staging_emission_factors` SELECT policy *does* carry the `organization_id IS NULL` branch under
the original policy name, so global factor rows are visible and there is no live bug. The repo's
migration history and prod's are simply out of step, because migrations here get applied ad hoc
rather than by a clean push.

## Recommended shape for the ongoing sync

The gap grows by roughly a commit a day on main. Options, least to most work:

1. **Merge `main` into `redesign` on a cadence** (weekly, or after any customer-facing fix), with
   the migration renumbering done once, up front. Cheapest, and the divergence stops compounding.
2. **Cherry-pick customer-facing fixes only.** Lower risk per merge, but 22 commits is already
   past the point where this is cheap, and it is easy to miss one.
3. **Freeze main to fixes only** and treat redesign as trunk. Correct if the move is imminent;
   wrong if main is going to keep taking features.

Whichever way, the version collision has to be fixed first, or the migration state on staging keeps
drifting from what the code expects.
