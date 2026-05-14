# Brand-Upload page redesign — review, edit, verify

Source: Tim's 13 May ask to expand `/brand-upload/[token]` from a file-only form into a full data review/edit/verify portal.

## Goal

When a brand clicks the tokenised link, they land on a page that:

1. Explains who's asking, why, and what alka**tera** does with the data
2. Shows everything we've already collected about them, with source
3. Lets them confirm correct values ("Looks right")
4. Lets them correct wrong values ("Edit")
5. Tells them what's still missing (required fields highlighted)
6. Keeps the existing document upload as one of several ways to fill gaps

## Architecture

### New table: `brand_field_verifications`

One row per (brand_profile_id, brand_sku_id, field_key). brand_sku_id NULL = brand-level. Stores the brand's authoritative answer.

Columns: `id`, `brand_profile_id`, `brand_sku_id`, `field_key`, `value_text`, `value_numeric`, `verified_at`, `verified_by_name`, `verified_by_email`, `verification_method` ('confirmed' | 'corrected').

Partial unique indexes for NULL and non-NULL `brand_sku_id`. RLS: distributors with access to the brand can read; service-role writes only (matches existing pattern).

### Data merger update

`lib/distributor/data-merger.ts` — for each `(field_key, brand_sku_id)` pair, check verifications first. If a verification exists, return it (always beats scraped sources). Else fall back to current alkatera_live-wins → highest-confidence logic.

### New API routes

- `GET /api/brand-upload/[token]/data` — validates token, returns brand info + distributor name + all SKUs + merged field values with provenance + `is_required` flag + plain-language labels
- `POST /api/brand-upload/[token]/verify` — accepts `{ field_key, brand_sku_id?, value, verification_method, verified_by_name, verified_by_email }`, upserts a verification row, returns updated value

Both routes use existing `validateUploadToken` + `consumeRateLimit`.

### New module: `lib/distributor/scraping/field-labels.ts`

Maps each FieldKey to:
- `label` (plain English)
- `helpText` (one-line explanation)
- `inputType` ('number' | 'text' | 'longtext' | 'boolean' | 'year' | 'select')
- `unit` (optional, e.g. "kg CO2e / litre")
- `category` ('carbon' | 'water' | 'packaging' | 'agriculture' | 'governance' | 'corporate')
- `scope` ('brand' | 'sku' | 'both') — informs whether the field appears in the per-SKU section

### Page UI

Refactored `app/(public)/brand-upload/[token]/page.tsx` + new components under `components/brand-upload/`:

- `Hero` — distributor name, plain-English context
- `ReviewerIdentity` — collects "who are you" (name + email) up front, used to stamp verifications. Persisted to localStorage so brand doesn't retype on each action
- `FieldGroup` — accordion section per pillar, with progress indicator ("3 of 5 confirmed")
- `FieldRow` — label, current value, source badge, Looks right / Edit / value-missing CTA
- `EditFieldDrawer` (or modal) — inline editor with appropriate input type, "save" submits a 'corrected' verification
- `PerSkuSection` — collapsed by default; expand to set SKU-specific overrides
- `DocumentUploadSection` — the existing form, kept but reframed

Submit-each-action UX (no big final submit for the data review section). Files upload via the existing submit route, unchanged.

### Source-name → display copy

In a small helper, map `source_name` to user-facing copy:
- `alkatera_live` → "From your alka**tera** profile"
- `brand_upload` → "From a previous document upload"
- `Brand Website` → "From your website"
- `Wikipedia` → "From Wikipedia"
- `B Corp Directory` → "From your B Corp listing"
- `brand_verified` (via verification table) → "Verified by you"
- (else) → "From {source_name}"

## What we're NOT building this round

- Audit history of past verifications
- Email notification to distributor when brand updates a field
- Field-level access restrictions for the brand
- "Save and continue later" session persistence (each action persists itself)
- Bulk "confirm everything" affordance (could come later if brands ask)

## Order of work

1. Migration: `20262606600000_brand_field_verifications.sql`
2. `field-labels.ts` module (all 27 fields)
3. Data merger update + tests
4. GET `/api/brand-upload/[token]/data` route
5. POST `/api/brand-upload/[token]/verify` route
6. Page + components rebuild
7. Add `source_name='brand_verified'` (or new column on scraped_brand_data?) — actually we don't need this; merger reads verifications table directly
8. End-to-end test of the new page against the token we generated for Avallen Spirits

## Acceptance

- Brand lands on the page, immediately sees who's asking and why
- Sees all 27 fields grouped by pillar, with current value + source per field
- Can confirm (Looks right) → verification row stored, source flips to "Verified by you"
- Can edit → verification row stored, source flips to "Verified by you"
- Required fields stand out
- Per-SKU section lets them override at SKU level
- Document upload still works, unchanged
- Vitality + completeness scores in the distributor UI reflect the new verified values after recalc
