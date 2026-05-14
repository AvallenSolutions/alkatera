# Canonical brand directory + alkatera integration

## Context

Today each distributor's `brand_profiles` row is a self-contained, per-distributor copy of a drinks brand. Two distributors that sell Avallen Spirits each have their own `brand_profiles` row, their own scraped findings, their own outreach state, and their own brand-verified data. A brand that signs up to alka**tera** has an `organizations` row, optionally linked to brand_profiles via `brand_distributor_links` — but the underlying data is still duplicated and the brand still has to verify their data once per distributor that lists them.

This breaks the platform's "answer once, share with every distributor" promise. It prevents data accumulating into a single authoritative directory of drinks brand sustainability, which is the strategic prize: the biggest, most comprehensive database of drinks brand sustainability in the world. Every new distributor that joins should benefit immediately from the directory the previous distributors and brands have already populated.

## Goals

1. One canonical record per drinks brand, globally.
2. Multiple distributors can list a single canonical brand. Per-distributor state (portfolio relationship, outreach status, listing status, alkatera_tier classification) stays per-distributor.
3. Sustainability data (scraped findings, brand verifications, document submissions, completeness + vitality scores) attaches to the canonical brand. A verification by the brand flows to every distributor that lists them.
4. Every alka**tera** customer organisation is automatically represented in the directory. Joining alka**tera** as a brand puts you in the directory or links you to an existing entry. New scraped data discovered for a directory entry flows through to the brand's alka**tera** profile.
5. SKU upload matches against the directory first (alka**tera** brands + previously-scraped brands) before creating new entries.

## Schema design

### New tables

**`brand_directory`** — canonical record per drinks brand.

```
id                          uuid pk
name                        text
normalized_name             text          -- lowercased, punctuation-stripped
aliases                     text[]        -- alternate spellings the matcher picks up
website                     text
category                    text          -- wine | spirits | beer | non_alc | other
country_of_origin           text
founding_year               int
parent_company              text
description                 text          -- AI-generated overview, brand-verified or scraped
alkatera_org_id             uuid          -- nullable; set when the brand has joined alkatera
sustainability_score        numeric(5,2)  -- mirror of latest snapshot
score_tier                  text
completeness_score          numeric(5,2)
discovered_via              text          -- sku_upload | alkatera_signup | manual
discovered_at               timestamptz
created_at, updated_at
```

GIN trigram index on `normalized_name` and `aliases` for fuzzy matching. Unique partial index on `alkatera_org_id` where not null.

### Updated tables

**`brand_profiles`** stays but is repositioned as the per-distributor *listing* of a canonical brand, not the brand itself. Add:

```
brand_directory_id          uuid not null fk → brand_directory.id
```

And **move** these columns from `brand_profiles` to `brand_directory` (they describe the brand, not the listing):

- name, normalized_name, category, country_of_origin, website, founding_year, parent_company, description, alkatera_org_id, sustainability_score, score_tier, completeness_score

What stays on `brand_profiles` (the listing) is genuinely per-distributor:

- distributor_org_id, listing_status, source_sku_list_id, alkatera_tier (per-distributor classification), outreach_email, outreach_sent_at, outreach_last_reminder_at, outreach_reminder_count, first_submission_at, last_submission_at, upload_token, upload_token_expires_at

The shape ends up being: `brand_directory` is the brand, `brand_profiles` is one distributor's listing of that brand. We keep the existing name because every consumer already uses it. We could rename to `brand_listings` in a later cleanup pass once everything is on the canonical model.

### Sustainability data: re-key from brand_profile_id to brand_directory_id

Tables that hold facts *about the brand* should attach to the directory:

- `scraped_brand_data.brand_directory_id` (replaces `brand_profile_id`)
- `brand_document_submissions.brand_directory_id`
- `brand_data_conflicts.brand_directory_id`
- `brand_completeness_snapshots.brand_directory_id`

Tables that hold facts *about a distributor-brand pair* stay keyed by `brand_profile_id` (the listing):

- `outreach_emails`
- `outreach_reminder_schedules`
- `distributor_notifications.brand_profile_id` stays (it's a notification for a specific distributor about a specific listing)

### Reuse existing infra

- `brand_distributor_links` becomes the consent/sharing edge between an alka**tera** org and a distributor. We continue to use it as today.
- `brand_sharing_preferences` is keyed by `alkatera_org_id` — that still works since the directory entry stores the alkatera org id.
- `find_similar_organizations` RPC (pg_trgm) — the same pattern is used by the new directory matcher.

### SKUs (deliberately out of scope for v1)

For v1 we keep `brand_skus` per-listing (per `brand_profile_id`). GTIN-based canonical SKUs are a follow-on phase. Per-listing SKUs are fine because the brand-level sustainability data already canonicalises, and SKU-level findings are usually distributor-specific (different vintages, different batches, different pack sizes per market).

## Match-on-upload flow

On every SKU list upload, after column mapping and before brand record creation:

1. Normalise each unique brand name from the file (lowercase, strip punctuation, alphabetics only).
2. Query `brand_directory` via pg_trgm similarity against `normalized_name` and `aliases`.
3. Sort matches by similarity.
4. **High confidence (similarity ≥ 0.88)**: auto-link. Create a `brand_profiles` listing pointing at the existing `brand_directory_id`. No outreach is automatically triggered.
5. **Medium confidence (0.65 ≤ similarity < 0.88)**: queue for manual confirmation. Surface in the existing pending-matches UI alongside alkatera fuzzy matches.
6. **No match (< 0.65)**: create a new `brand_directory` entry + `brand_profiles` listing. Mark `discovered_via = 'sku_upload'`.

After step 4 or 6, the listing is created and the existing recalc + scraping pipeline runs as today — but now any data discovered is attached to the canonical directory, so future distributors that list the same brand inherit it.

## alka**tera** integration

### Initial backfill (one-off)

A migration script:

1. Read every row in `organizations` (the alka**tera** customer table).
2. For each org, normalise the name.
3. Run the directory matcher against any pre-existing `brand_directory` entries (the directory might already contain a scraped entry for that brand from a distributor upload).
4. If a high-confidence match exists: link the existing directory entry to the org by setting `brand_directory.alkatera_org_id`.
5. Else: insert a new `brand_directory` row with `alkatera_org_id` set and `discovered_via = 'alkatera_signup'`.

### Ongoing sync

**On alka**tera** signup or org-detail change** — a DB trigger on `organizations` (INSERT/UPDATE of name, website, country, founding_year) keeps the directory in step:

- INSERT: create a `brand_directory` entry, run the matcher first to dedupe against an existing scraped entry.
- UPDATE: propagate name/website/country/founding_year changes to the linked directory row, with brand-side changes always winning over scraped values.

**Nightly reconciliation** — a cron job (`/api/cron/reconcile-alkatera-directory`) catches any drift from bulk updates or trigger gaps. Pulls organizations not represented in the directory and adds them.

**Live data overlay (existing)** — `lib/distributor/integration/alkatera-sync.ts` keeps writing `scraped_brand_data` rows with `source_name='alkatera_live'`. With the re-key from `brand_profile_id` to `brand_directory_id`, these rows automatically benefit every distributor that lists the brand. No fan-out logic needed.

### Reverse discovery

When a new alka**tera** signup arrives (no existing directory link), the same matcher runs. If a directory entry already exists for that brand name with `alkatera_org_id IS NULL`, the org gets linked to it and the brand inherits all previously-scraped data on alka**tera** side as their starting picture.

## Existing data migration

A one-time migration to dedupe per-distributor `brand_profiles` into a shared directory:

1. Group existing rows by `normalized_name`.
2. For each group:
   - Choose canonical row by highest completeness, then oldest created_at (deterministic).
   - Insert a `brand_directory` row from the canonical.
   - Set `brand_directory.alkatera_org_id` from the canonical if any in the group has one.
   - Re-key every `scraped_brand_data`, `brand_document_submissions`, `brand_data_conflicts`, `brand_completeness_snapshots` from each brand_profile in the group to point at the new directory_id. (When duplicate findings exist across distributors for the same field, prefer alkatera_live > highest confidence > newest.)
   - Update each brand_profile in the group to point at the directory entry. Leave the rows in place — they're now the per-distributor listings.
3. Singleton brand_profiles: create directory entry, link, no further consolidation needed.

Run inside a transaction with savepoint per group. Dry-run mode that reports what would be merged before committing. Reversible: every changed row gets stamped with `migration_run_id` so we can unwind.

## Sharing & privacy model

**Default policy**: a brand's verified data is visible to every distributor that lists them. Brands can opt out per distributor.

**Brand controls**:

- Per-distributor visibility toggle on the alka**tera** side (existing `brand_sharing_preferences` table — extend to support directory entries that don't yet have an alkatera_org).
- Per-field share controls (already supported via `brand_sharing_preferences.field_key`).
- "Remove me from this distributor's portfolio" — sets `brand_profiles.listing_status = 'delisted'`. **Data stays in the directory** and continues serving every other distributor that lists the brand, plus the brand themselves on alka**tera**.

**Data persistence**: once a finding is in the directory, it stays. Delistings, distributor account closures, brand departures from individual distributors — none of these remove sustainability data from the directory. The data is the asset; the per-distributor relationship is just one channel to it.

**Conflict policy**: no manual conflict-resolution surface. The data merger applies fixed precedence everywhere: `brand_verified` > `alkatera_live` > highest confidence. Where two sources disagree and no brand verification exists, the higher-confidence source wins automatically and the lower-confidence row is logged in `brand_data_conflicts` as an internal signal that "this field could use brand verification" — which feeds the outreach-prompt logic, but is not surfaced to distributors as a queue to resolve.

**Brand-upload review portal**: the public tokenised page now writes verifications to `brand_directory_id`, not the per-distributor `brand_profile_id`. The portal copy is updated: "Your verified data is shared with the N distributors who list your products. Manage who sees what at alka**tera**." (link to alka**tera**-side sharing settings).

## UI changes

- **Brand detail page** ([app/distributor/(portal)/brands/[id]/page.tsx](app/distributor/(portal)/brands/[id]/page.tsx)): "Listed by N distributors" callout on the hero. "Verified by the brand" / "alka**tera** live" badges where appropriate.
- **SKU upload wizard** ([app/distributor/(portal)/sku-lists/upload/page.tsx](app/distributor/(portal)/sku-lists/upload/page.tsx)): new step between mapping and import — "Matching against the directory" — that summarises auto-matches and lists any medium-confidence matches for confirmation.
- **Pending matches** ([app/distributor/(portal)/brands/pending-matches/page.tsx](app/distributor/(portal)/brands/pending-matches/page.tsx)): becomes the unified queue for directory matches and alkatera fuzzy matches. The "Confirm" CTA links a `brand_profiles` listing to an existing directory entry.
- **Outreach hub**: a "Already verified" / "Comprehensive data on file" status appears for brands whose directory entry already has enough verified data — the system suppresses the "send outreach" CTA for these brands by default since we shouldn't bother brands when we already have their data. Distributor can still send an outreach manually if they want fresh data from the brand. **No manual conflict-resolution queue** — disagreements between scraped sources resolve automatically via merger precedence.
- **Public brand-upload review portal** ([app/(public)/brand-upload/[token]/page.tsx](app/(public)/brand-upload/[token]/page.tsx)): copy update — "Your data is shared with the N distributors who list your products" + a link to manage sharing on alka**tera** if the brand is linked.
- **alka**tera** main side**: a new "Distributors who list you" panel in the brand's profile settings, with toggle for per-distributor visibility.

## API changes

New:

- `POST /api/distributor/directory/match` — given a list of brand names, return matches (auto-link / pending / new).
- `GET /api/distributor/directory/:id` — server-render canonical brand for any consumer.
- `POST /api/distributor/brands/:listing_id/confirm-directory-match` — confirm a pending fuzzy match.

Updated:

- `POST /api/distributor/sku-lists/:id/confirm` — runs the matcher between column mapping and brand creation.
- `POST /api/brand-upload/[token]/verify` — writes verifications to `brand_directory_id` instead of `brand_profile_id`.
- All scoring/recalc and merger code paths re-keyed from `brand_profile_id` to `brand_directory_id` where appropriate.

## Order of work

Multi-week effort. Suggested phasing:

### Phase 1 — Schema and dual-write

- New `brand_directory` table + indexes
- `brand_profiles.brand_directory_id` FK (nullable while migrating)
- Migration script: for each existing `brand_profiles`, create a corresponding directory entry; link by FK
- Triggers / sync to mirror new alka**tera** organizations into the directory
- Distributor-side reads still use brand_profiles columns (no consumer changes yet)

**Acceptance**: directory is populated for every existing brand. New alkatera signup creates a directory entry. No distributor-side behaviour has changed.

### Phase 2 — Match-on-upload

- SKU upload flow consults the matcher between mapping and import
- Pending-matches UI surfaces medium-confidence directory matches
- Auto-link rule for high-confidence

**Acceptance**: uploading the same brand from two distributor accounts creates one directory entry and two listings rather than two duplicate brand_profiles.

### Phase 3 — Re-key sustainability data to directory

- Schema migration: add `brand_directory_id` to `scraped_brand_data`, `brand_document_submissions`, `brand_data_conflicts`, `brand_completeness_snapshots`, backfill from `brand_profiles.brand_directory_id`
- Update data merger, recalc, brand-upload verify, and all server reads to use `brand_directory_id`
- Drop the legacy `brand_profile_id` columns on these tables after a grace period
- Brand detail UI reads from directory + listing

**Acceptance**: a verification by a brand on the public portal flows to every distributor that lists them. The data merger returns the same picture for every distributor with a confirmed listing.

### Phase 4 — Dedup migration

- Run the existing-data dedup against all distributors' portfolios
- Surface "your portfolio was consolidated — N brands merged" notification

**Acceptance**: where two distributors previously had separate brand_profiles for the same brand, both now reference one directory entry with combined scraped findings.

### Phase 5 — Privacy + brand-side controls

- Extend `brand_sharing_preferences` to support directory entries without an alkatera_org
- "Distributors who list you" panel on the alkatera customer side, with per-distributor toggles
- Brand-upload portal copy update

**Acceptance**: a brand can opt out of sharing with a specific distributor; that distributor no longer sees brand-verified data for the brand (scraped data still visible).

## Verification (end-state acceptance)

- A new distributor uploads a SKU list containing "Avallen Spirits". The system auto-links to the existing canonical "Avallen Spirits" directory entry. The distributor immediately sees Avallen's already-verified carbon footprint, B Corp status, sustainability report, etc. without sending an outreach.
- An alka**tera** customer signs up under "Hayman's Gin". The system finds an existing directory entry that was scraped from a previous distributor's upload, links the new org to it, and the brand's alka**tera** dashboard shows the scraped data as a starting point.
- An existing customer ("Avallen") updates their carbon footprint on alka**tera**. Every distributor that lists Avallen sees the new number immediately in their data tab.
- A brand verifies a field on the public brand-upload portal. Every distributor that lists them sees "Verified by you" on that field.

## What we're NOT doing yet

- Canonical SKUs (GTIN-based dedup across distributors) — per-listing SKUs are sufficient for v1.
- Public-directory feature (alka**tera** brand finder visible to non-distributor users) — out of scope.
- Vintage-level canonicalisation across distributors.
- Cross-distributor analytics ("how does Avallen's data look across the X distributors that list it?") — could be a follow-up Insights surface.
- Bulk listing-cleanup tooling beyond the one-time dedup migration.

## Critical files

Schema migrations live under `supabase/migrations/`. Application changes touch:

- [lib/distributor/sku-import/](lib/distributor/sku-import) — match-on-upload integration
- [lib/distributor/integration/alkatera-sync.ts](lib/distributor/integration/alkatera-sync.ts) — already exists, re-key to directory
- [lib/distributor/integration/data-merger.ts](lib/distributor/integration/data-merger.ts) — re-key to directory
- [lib/distributor/scoring/recalculate.ts](lib/distributor/scoring/recalculate.ts) — recalc against directory
- [app/api/brand-upload/[token]/verify/route.ts](app/api/brand-upload/[token]/verify/route.ts) — write to directory
- [app/distributor/(portal)/sku-lists/upload/page.tsx](app/distributor/(portal)/sku-lists/upload/page.tsx) — new matching step
- [app/distributor/(portal)/brands/pending-matches/page.tsx](app/distributor/(portal)/brands/pending-matches/page.tsx) — unified queue
- [app/distributor/(portal)/brands/[id]/page.tsx](app/distributor/(portal)/brands/[id]/page.tsx) — "Listed by N" callout
- [app/(public)/brand-upload/[token]/page.tsx](app/(public)/brand-upload/[token]/page.tsx) — copy update

## Locked design decisions (Tim, 2026-05-13)

1. **Default sharing policy**: brand-verified data is visible to every distributor that lists the brand by default. Brands can opt out per distributor via the existing `brand_sharing_preferences` table.

2. **Data persistence across portfolio changes**: data sticks once collected. If a brand delists from Distributor A, the directory entry, the scraped findings, the brand verifications and the documents all remain. The whole point of the directory is to grow the database — data is the asset, not the per-distributor relationship. A's listing flips to delisted but the underlying brand data continues to serve every other distributor that lists the brand, plus the brand themselves on alka**tera**.

3. **Conflict policy**: no manual conflict-resolution surface for distributors. The matcher checks the directory before outreach, so if comprehensive data already exists the brand is not bothered. When sources disagree, precedence is automatic: `brand_verified` > `alkatera_live` > highest confidence. The brand is the ultimate authority via the public verify portal we already built. The existing `brand_data_conflicts` table is retained as a low-confidence flag log used internally to surface "this field could benefit from brand verification" prompts on the outreach side, but is not exposed as a queue the distributor manually resolves.

4. **Naming**: keep `brand_profiles` as the listing table. It already represents the per-distributor relationship; we add a `brand_directory_id` FK and migrate the brand-attribute columns out to the new directory table.

These decisions hold for the build. Any further changes are out of scope for the initial roll-out unless raised explicitly.
