# Breww Integration UX Improvements

## Context

The Breww integration is functionally complete (connect, sync, recipe import, packaging rebuild, circularity fields, EOL wiring) but the audit flagged three underlying UX problems:

1. **Unclear information hierarchy** — six data tabs, three action buttons, no visual grouping
2. **Inconsistent interaction patterns** — Products tab uses modals, Sites tab uses inline selects, Ingredients/Packaging tabs use a separate import flow
3. **Poor discoverability** — Breww actions scattered across Settings / Products / Facilities with no connecting thread; no way to tell from a product page whether there's matching Breww data waiting to be linked

The fix is scoped to UX polish — no new data or calculation changes. Goal: a brewer should be able to go from "I use Breww" to "my products and facilities are fully wired up" in under 5 minutes, without reading docs, and from any of the three surfaces (settings, product page, facility page).

---

## Design principles

- **One canonical hub, many entry points.** The `/settings/integrations/breww` page remains the source of truth for sync status + linking, but product and facility pages each get contextual shortcuts that deep-link there.
- **Link-first, import-second.** Every Breww item (SKU, site, ingredient, container) belongs to exactly one workflow: link/create → auto-import. Kill the parallel "Import to product" dialog on Ingredients/Packaging tabs — those tabs become read-only references once the SKU is linked.
- **Status before actions.** Show sync freshness (last synced, next scheduled, errors) prominently. Hide `Rebuild packaging` behind a `…` menu — it's a migration tool, not an everyday action.
- **Confirm destructive actions.** Disconnect + Unlink + Rebuild need confirmation dialogs.

---

## Step 1 — Tighten the connection card (`components/settings/BrewwConnectionCard.tsx`)

**Action row:** collapse three buttons into a primary `Sync now` + a `…` overflow menu containing `Rebuild packaging` and `Disconnect`. Use `DropdownMenu` from `components/ui/dropdown-menu`.

**Sync toast:** replace the technical dump with a two-line summary:
- Line 1: `"Synced Breww data"`
- Line 2: `"{products} products · {hl} hL · {ingredients} ingredients · {packaging} packaging types"`

Move the verbose breakdown into a collapsible "What just synced?" panel on the data page, populated from the sync response and persisted on the connection row (`metadata.last_sync_summary`).

**Disconnect confirmation:** wrap in `AlertDialog` with copy: *"Disconnect Breww? Your synced data stays, but you'll need to reconnect to refresh it. Links between Breww SKUs and your products stay intact."*

**Error display:** remove the 160-char truncation. Show full error in an expandable `<details>` when `connection.sync_error` exists, with a `Copy error` button.

---

## Step 2 — Sync status strip at the top of the data page (`app/(authenticated)/settings/integrations/breww/page.tsx`)

Add a horizontal status strip above the tab bar:

```
┌────────────────────────────────────────────────────────────────────┐
│  ● Connected  ·  Last synced 2 minutes ago  ·  Next auto-sync 23h  │
│  5/7 SKUs linked  ·  2/3 sites linked  ·  3 ingredients available  │
│                                             [Sync now]  [⋯ more]   │
└────────────────────────────────────────────────────────────────────┘
```

This becomes the "dashboard view" of the integration. The progress counts are clickable and deep-link into the relevant tab with that filter pre-applied (e.g. clicking "5/7 SKUs linked" opens Products tab filtered to unlinked).

---

## Step 3 — Consolidate six tabs into four

**Before:** Products · Production · Sites · Volumes · Ingredients · Packaging (6)
**After:** Products · Sites · Production · Reference (4)

- **Products** (unchanged): SKU → alkatera product linking, link/create flow
- **Sites**: Breww site → facility linking. Switch inline Select to the same modal pattern as Products so the interaction feels consistent.
- **Production** (merged): combines old Production + Volumes into a single view. Product-by-month matrix with a view toggle (`Totals` / `By month` / `By SKU`) instead of three separate tables.
- **Reference** (merged): read-only catalogue of Ingredients + Containers, with two sub-sections on the same page. Remove the per-row "Import to product" button — ingredient import now only happens through the recipe import flow on a linked product. Add copy at the top: *"These are the ingredients and containers Breww knows about. They'll flow into your products automatically when you link a SKU or import a recipe."*

**Tab badges:** show unread/pending counts on tabs (e.g. "Products 2" for 2 unlinked SKUs).

---

## Step 4 — Unified LinkPicker component

Extract a reusable `<LinkPicker>` modal from the existing Products and Sites tab code so both flows use the same UI:

- Search box with fuzzy match
- List of alkatera entities (products or facilities)
- `Create new` fallback at the bottom when nothing matches
- Preview panel showing the Breww-side entity details on the right

File: `components/settings/integrations/breww/LinkPicker.tsx` — generic over `<T extends { id: string; name: string }>` so it serves both SKU → product and site → facility.

---

## Step 5 — Contextual Breww surfaces on product pages

**5a. Product detail header badge.** When a product has a `breww_product_links` row, show a small `<BrewwLinkBadge>` chip in the product header:

```
  Avallen Classic Calvados  [⟲ Linked to Breww · Calvados 700ml]
```

Click expands a popover with: Breww SKU name, last sync, "Import latest recipe", "Unlink", "View in integrations".

**5b. Unlinked products — subtle suggestion.** When a product has NO Breww link but the org has Breww connected AND there's an unlinked Breww SKU whose name fuzzy-matches the product (Levenshtein distance ≤ 3 on normalised name), show a dismissable banner:

> *"This product looks like your Breww SKU 'Calvados 700ml'. [Link now] or [Dismiss]"*

State stored in `localStorage` per-product-id so dismissal sticks.

**5c. Recipe page CTA.** On unlinked products, replace the absent "Import from Breww" button with a muted "Connected to Breww? Link this product to auto-fill ingredients and packaging." → deep-links to the Products tab filtered to unlinked SKUs with this product pre-selected as the target.

New files:
- `components/products/BrewwLinkBadge.tsx`
- `components/products/BrewwSuggestionBanner.tsx`

---

## Step 6 — Contextual Breww surfaces on facility pages

**6a. Facility detail header badge.** Mirror the product pattern: when a facility has a `breww_site_links` row, show a chip linking to the data page, with last-sync timestamp in the popover.

**6b. Production volume card.** Inside the existing `ProductionVolumeManager`, when the facility is linked to a Breww site, pull the `BrewwImportDialog` out of its current buried state into a top-of-card affordance:

```
  ┌──────────────────────────────────────────────┐
  │  📊 Breww has 24 months of data for this site │
  │  [Review and import →]                        │
  └──────────────────────────────────────────────┘
```

**6c. Dashboard widget.** Update `components/dashboard/widgets/BreweryProductionWidget.tsx` to:
- Show a `From Breww` source label with last sync time
- Render a connect-CTA card instead of silently hiding when the org has no Breww connection

New files:
- `components/facilities/BrewwLinkBadge.tsx`
- (edit) `components/facilities/BrewwImportDialog.tsx` hoisting
- (edit) `components/dashboard/widgets/BreweryProductionWidget.tsx`

---

## Step 7 — Onboarding quick-win

In `components/onboarding/steps/ConnectToolsStep.tsx`, after a successful Breww connect, inline a 3-step checklist right there in the step (no navigation away):

```
  ✓ Connected to Breww
  ○ Link 1 product   [Link now]
  ○ Link 1 facility  [Link now]
```

Each link opens the `LinkPicker` modal (from Step 4) in-place. The onboarding step only unblocks when either at least one link is made OR user clicks `Skip for now`.

---

## Step 8 — Sync progress indicator

Replace the silent `Syncing…` spinner with:

- Optimistic progress: `"Syncing production data… (1/4)"` → `"Syncing ingredients… (2/4)"` → etc.
- The sync API route streams Server-Sent Events with phase markers; the card subscribes and updates the progress label.

New file: `app/api/integrations/breww/sync/stream/route.ts` (SSE endpoint alongside the existing POST, so legacy callers keep working).

**Fallback:** if the browser doesn't support SSE (basically none, but), fall back to the current one-shot POST.

---

## Step 9 — Global sync-error visibility

Add a top-bar banner (in `components/layouts/AppLayout.tsx`, above the main content area) that renders when any org integration is in error state:

> *"⚠ Breww sync failed 3 hours ago. [View details]"*

Queries `integration_connections` where `sync_status = 'error'` via a small hook (`useIntegrationHealth`), cached for 60s. Clicking routes to the relevant integration page.

Keep it dismissible per-session (not permanent — errors need to stay visible).

---

## Step 10 — Copy pass

British English, no em dashes. Rewrite across all Breww-facing UI:

- Connection card description: *"Syncs production volumes, batch ingredients and packaging types from your Breww account. Links to your alkatera products and facilities so recipes and footprints auto-update."*
- Empty states: make the CTA explicit everywhere (no "Run a sync from the Integrations page" — instead a button that does it inline)
- Error copy: start with what failed, not the technical detail, with a "Show technical details" toggle

---

## Files to create

| File | Purpose |
|------|---------|
| `components/settings/integrations/breww/LinkPicker.tsx` | Shared link modal (Step 4) |
| `components/settings/integrations/breww/SyncStatusStrip.tsx` | Top-of-page status strip (Step 2) |
| `components/products/BrewwLinkBadge.tsx` | Product header chip (Step 5a) |
| `components/products/BrewwSuggestionBanner.tsx` | Auto-match suggestion (Step 5b) |
| `components/facilities/BrewwLinkBadge.tsx` | Facility header chip (Step 6a) |
| `hooks/useIntegrationHealth.ts` | Global error banner data hook (Step 9) |
| `app/api/integrations/breww/sync/stream/route.ts` | SSE sync progress endpoint (Step 8) |

## Files to modify

| File | Change |
|------|--------|
| `components/settings/BrewwConnectionCard.tsx` | Collapse to `Sync now` + overflow menu, confirm disconnect, better errors, two-line toast (Step 1) |
| `app/(authenticated)/settings/integrations/breww/page.tsx` | Add status strip, collapse to 4 tabs, wire LinkPicker (Steps 2, 3, 4) |
| `app/(authenticated)/products/[id]/page.tsx` (or header component) | Add BrewwLinkBadge + suggestion banner (Step 5) |
| `app/(authenticated)/products/[id]/recipe/page.tsx` | Add unlinked-product CTA (Step 5c) |
| `components/facilities/FacilityDetail.tsx` or equivalent | Add BrewwLinkBadge (Step 6a) |
| `components/facilities/ProductionVolumeManager.tsx` | Hoist Breww import affordance (Step 6b) |
| `components/dashboard/widgets/BreweryProductionWidget.tsx` | Source label + connect CTA (Step 6c) |
| `components/onboarding/steps/ConnectToolsStep.tsx` | Post-connect quick-win checklist (Step 7) |
| `components/layouts/AppLayout.tsx` | Global sync-error banner (Step 9) |

## No backend or schema changes

Every improvement in this plan is UI/UX and thin API additions (SSE endpoint, one read hook). No migrations, no data model changes, no recalculation logic.

---

## Verification

1. Fresh org: `/settings/integrations` → Connect Breww with API key → sync completes with streaming progress → onboarding checklist prompts first link.
2. After first sync: data page status strip shows `X/Y SKUs linked`, tabs have unread badges, Reference tab shows ingredients + containers read-only.
3. Product detail page (linked): header shows Breww chip with last-sync popover and Unlink/View actions.
4. Product detail page (unlinked but Breww has matching SKU): suggestion banner appears, dismiss persists.
5. Facility detail page (linked): chip appears, `ProductionVolumeManager` surfaces Breww import CTA at top.
6. Simulate sync error: global banner appears in `AppLayout`, data page error shows full text with Copy button.
7. Disconnect: confirmation dialog appears, data survives, re-connecting restores links.
8. Copy review: no em dashes, British spellings, all empty states have actionable CTAs.
9. `pnpm test` passes.
