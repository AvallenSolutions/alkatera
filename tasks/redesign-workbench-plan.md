# The workbench: the plan

Working branch: `redesign` (worktree `.claude/worktrees/redesign`, dev server :8891).
Parent tracker: `tasks/redesign-todo.md`. Design reference: `design/studio-design-language.md`.
This room is also the pilot for the **room-landing pattern** agreed 9 July: recurse the
desk's rhythm, not the navigation.

## What the workbench is

The data going in. Eleven surfaces behind the cobalt band: four tabs (Facilities,
Emissions, Spend, Quality) and seven strays in "More…" (Sources, Inventory, Fleet,
Vineyards, Orchards, Arable fields, Hospitality). It is the most crowded room in the
house, it has no landing (the desk drops you onto Facilities), and its "More…" menu
is a junk drawer nobody arranged.

## The noise audit (what confuses the user today)

### Room-wide
- Every converted eyebrow still reads "THE MEASURES · X": the room renamed, the
  eyebrows did not. The eyebrow should derive from the registry, not a string.
- Two chip systems coexist (shadcn Badge pills vs studio StateChip working tones).
- Saturated scope colours are hard-coded off-palette (#f97316/#3b82f6/#22c55e).
- The band's tab strip overflows with a visible scrollbar at common widths.
- The Xero spend story spans three pages (Emissions, Spend, Inventory) with no
  thread: Emissions says "3 transactions hidden", the fix lives in Inventory, and
  nothing connects them.

### Emissions (`/data/scope-1-2/`) — the centrepiece, 2,669-line monolith
- An internal FIVE-tab icon bar under the room band (Annual Footprint / Scope 1 /
  Scope 2 / Scope 3 / Trends): three navigation layers again.
- The scope split is told four ways on one tab: donut, three colour-coded icon
  cards, a bar chart, and then the tabs themselves.
- Scope 1 and Scope 2 tabs are copy-paste twins: read-only mirrors of Facilities
  data whose main message is a blue alert saying "go to Facilities". No entry
  happens there. Repeated AND redundant.
- A "Getting Started" 7-step wizard card; a second h2 page header below it;
  gradient hero blocks; "Auto-calculated" badge pills; the Rosa dog appears in the
  guide AND in tip banners on three tabs.

### Fleet (`/company/fleet/`) — untouched by the sweep
- Pre-studio header, own p-8 shell, 4-up icon stat-card grid, internal 4-tab bar.
- The scope-routing explanation appears THREE times on one tab (stat sublabels,
  overview explainer cards, "Scope Assignment Guide" card).
- The Reporting tab is a re-plot of the Overview chart. Repeated.

### Spend (`/data/spend-data/`) — untouched by the sweep
- Pre-studio header. TWO quality meters on one page (DataQualityProgress up top,
  ActionCentre's own "Data Quality Score" card below).
- Step state told twice (pill breadcrumb card AND numbered step headers), and the
  wizard chrome persists after Xero is connected.
- Two separate AI classification UIs for the same job (per-supplier "Suggest with
  AI" and a per-transaction AIClassificationPanel).

### Quality (`/data/quality/`)
- Internal 3-tab bar. The "Data Sources" tab is static brochure copy that
  duplicates the page's own stat cards and the /data/sources page. Repeated and
  redundant.
- Five icon stat cards, ~6 saturated colours; supplier-verified counted three
  times on one page. The upgrade simulator and opportunity table are genuinely
  good and stay.

### Sources (`/data/sources/`)
- Internal per-category tab bar; quality tiers explained THREE times (stat cards,
  methodology card, legend card); two full static education cards.
- The expandable citation rows are already quiet and good.

### Inventory ledger (`/data/inventory-ledger/`)
- Closest to studio in spirit (three quiet tables, one action) but the header was
  never converted (icon-in-h1) and every table wears badge pills.

### Agriculture (`/vineyards/`, `/orchards/`, `/arable-fields/`)
- Three line-for-line page clones (~250 lines each) with cloned card components;
  only the nouns differ. Icon-medallion cards with FOUR actions each (the card is
  a link AND carries a View Dashboard button to the same URL), certification +
  count badge pills, N+1 profile fetches, delete with no confirm.

### Hospitality (`/hospitality/`)
- Pre-studio header (icon + h1 + "Beta" badge pill + Customise) and then a SECOND
  statement headline inside the vitality hero: two competing headers.
- A 7-card icon "Manage" grid that is pure sub-navigation dressed as content.
- Footprint toggle as an icon-headed card; setup saves via full page reload.
- Dead code: HospitalityStatCard.tsx, HospitalityRankList.tsx imported nowhere.

## The design moves

### 1. The landing: the bench itself (`/workbench/`) — the room-landing pilot
A page in the desk's grammar that introduces the room and reads its state:

1. **The statement**: "The workbench." with a quiet note ("The data going in.").
2. **The one cobalt poster**: this year's footprint — total tCO2e, DRAFT/COMPLETE,
   Rosa's one line — linking to Emissions. The room's product is the poster.
3. **Fact-list blocks with live counts**, one row per surface, counts that say
   "needs you" where possible, working tones only when attention is due:
   - Facilities · N sites (attention chip when utility data is stale)
   - Emissions · entry shortcut (the poster covers the number)
   - Spend · N suppliers to classify (hidden until Xero connects; otherwise a
     quiet "connect your accounts" row)
   - Quality · score % with tone
   - Fleet · N vehicles
   - Inventory · N spend rows to link (this is the missing thread from Emissions)
   - Sources · N emission factors (quiet, reference)
   - The fields · N growing sites across vineyards/orchards/arable (one row,
     flag-filtered, splits on the landing only if more than one crop type exists)
   - Hospitality · venues/meals count (flag-filtered)
4. **Gating**: rows respect `viticulture_beta` / `orchard_beta` / `arable_beta` /
   `hospitality_beta` via useSubscription, stricter than today's More… menu which
   leaks the labels.

Mechanics (from the navigation audit):
- New route `app/(authenticated)/workbench/page.tsx`; `['/workbench', 'workbench']`
  prefix in platform-rooms.ts; desk poster href flips from `/company/facilities/`
  to `/workbench/` (one string in desk/page.tsx).
- The room NAME in the band (currently a plain span) becomes a link to the room's
  landing when one exists. Tabs and More… stay as they are: the band is the
  shortcut, the landing is the introduction.
- New `app/api/workbench/counts/route.ts` cloned from /api/desk/counts
  (getSupabaseAPIClient + resolveAccessibleOrg + head-count queries).

### 2. Emissions becomes one paper (the room's Pulse moment)
1. The statement carries the year: eyebrow "THE WORKBENCH · EMISSIONS", headline
   "The emissions.", year select + DRAFT/COMPLETE mono chip in the margins, the
   annual total standing right as the big number. The duplicate inner header dies.
2. **The internal tab bar dies.** One scrolling paper with mono-eyebrow sections:
   - THE FOOTPRINT: total + donut + ONE scope breakdown (fact rows with
     proportion bars, working tones); the three icon scope cards, the duplicate
     bar chart and the gradient heroes retire (same numbers, told once).
   - SCOPE 3 ENTRY: the category cards re-cut quiet (mono eyebrow, no icon
     header, chips not pills), grouped as today; the Xero import sidebar becomes
     a quiet row linking Spend, and the suppressed-transactions banner links
     Inventory (the missing thread).
   - TRENDS: the year-on-year chart + table, one section.
3. **Scope 1 and Scope 2 tabs retire** (decision 1): their only unique content,
   the by-source and by-facility breakdown tables, fold into THE FOOTPRINT as
   expandable quiet tables. Entry already lives in Facilities; the paper says so
   once, in one line, not in two tab-sized alerts.
4. The Getting Started wizard restyles to hairline fact rows under the statement
   (the Pulse checklist treatment), shown only while incomplete; the Rosa dog
   appears nowhere on the page (the ink band owns Rosa).
5. Scope colours move to the studio palette; badge pills become working-tone chips.
6. The 2,669-line page splits into section components under
   `components/emissions/` as part of the recomposition (no logic changes).

### 3. Spend becomes the queue (one meter, one story)
1. Statement header: "The spend." + the classification queue count standing right.
2. ONE quality meter (the DataQualityProgress strip, re-cut quiet); ActionCentre's
   duplicate score card dies. Repeated.
3. The step chrome collapses: once Xero is connected the page IS the queue
   (SupplierClassificationPanel leading), with upgrade prompts as a section below;
   disconnected orgs get one quiet connect row, not wizard chrome.
4. The two AI classification UIs merge behind one "Suggest with AI" entry point
   (the per-transaction panel folds into the review flow). Repeated.
5. Advanced accordion stays as-is (audit/inspect job), re-cut quiet.

### 4. Quality: the score and the queue
1. Statement: "Data quality." with the overall score standing right as the big
   number with tone.
2. Internal tabs die: OVERVIEW (distribution + where-data-comes-from as one quiet
   section) and OPPORTUNITIES (simulator line + the ranked table, kept intact,
   it is the page's best feature) become sections down one paper.
3. The "Data Sources" tab loses its tab but keeps its content (decision 2, Tim's
   revision): it compresses to one quiet WHERE THE DATA COMES FROM section at the
   foot of the paper, rarely used but always visible, with one line linking to
   The sources for the full factor library.
4. Five icon stat cards become one hairline figures row; pills become chips.

### 5. Sources: the reference shelf
1. Category tabs become grouped hairline sections down one table (or one mono
   filter row if the list is long); the citation rows stay as they are.
2. Quality tiers explained once, in one legend line under the eyebrow; the
   methodology and legend education cards compress to a short section of prose.
3. "Missing something?" becomes a ghost row that expands the request form inline.

### 6. Inventory: the header and the chips
Statement header (eyebrow + "The inventory ledger."), resolver explainer
compressed to two quiet lines, badge pills to working-tone chips. The three
tables stay; the page is already the right shape.

### 7. Fleet: from dashboard to logbook
1. Statement header: "The fleet." + total fleet emissions standing right; the p-8
   shell and 4-up icon stat grid retire (figures fold into the statement row).
2. Internal tabs die: VEHICLES (registry table) and THE LOG (activity table with
   its search/filter/export, re-cut quiet) become sections; ONE by-scope chart
   under the figures. The Reporting tab's unique by-vehicle-type chart survives
   as a quiet section beside it; only the duplicated by-scope re-plot goes
   (decision 2 principle: convert to quiet sections, never lose the content).
3. The scope-routing explanation appears ONCE as a short quiet line (not three
   cards); scope badges become chips; FeatureGate fallback restyles quiet.

### 8. The fields: one surface, three crops (decision 4)
Extract one parameterised growing-sites list (`components/growing/`)
that all three routes render with a crop config (nouns, flag, API paths):
statement header, sites as quiet fact rows (name, hectares, profile-status chip,
one click-through; the four-button footer and icon medallions retire), add flow
and questionnaires unchanged per crop. URLs stay (`/vineyards/` etc.), the band's
More… keeps its entries; the landing shows them as one "fields" row. Delete
confirm added while we are in there (currently a bare fetch).

### 9. Hospitality: one header, no nav-as-content
1. ONE statement header ("The hospitality.") absorbing the hero's eyebrow +
   headline; Beta pill dies (mono eyebrow note instead); Customise becomes a
   ghost pill.
2. The 7-card Manage grid becomes a quiet fact-list of the same seven
   destinations with live counts where cheap (venues, meals, drinks, menus).
3. Footprint toggle becomes one hairline row with a switch; setup chooser re-cut
   quiet (no full page reload); dead components deleted (HospitalityStatCard,
   HospitalityRankList — imported nowhere).

### 10. Room hygiene (with everything above)
- Eyebrows read THE WORKBENCH · X and derive from the room registry.
- One chip system: working-tone StateChip everywhere in the room.
- Band tab strip: no visible scrollbar artefact.
- The desk poster copy for the workbench updates to point at the landing.

## Decisions (settled with Tim, 10 July)

1. **Emissions Scope 1 & 2 tabs**: YES, fold their unique tables into the
   footprint section; one paper.
2. **Quality "Data Sources" tab / Fleet "Reporting" tab**: KEEP the content,
   lose the tabs. Tim: "people rarely use it but should be able to see where
   their data comes from". Both become quiet sections; only genuinely duplicated
   plots go (Fleet's by-scope re-plot).
3. **Agriculture**: YES, parameterise into one growing-sites surface; URLs and
   per-crop questionnaires unchanged.
4. **Landing poster**: this year's footprint (total + status + Rosa's line),
   linking to Emissions; surface rows carry the "needs you" counts.

## Phase 2: every page in the room (Tim, 10 July) — DONE

Tim: apply the same UX to ALL pages within the workbench so the platform is
consistent, with no pages still wearing the old alka**tera** design. Full route
inventory: 30 pages behind the room's prefixes; all 30 now speak studio.

- [x] Facility detail dashboard `/company/facilities/[id]`: statement with the
      facility name, quiet mono mode tabs (data entry is a genuine mode switch),
      hairline history tables, cobalt save pill.
- [x] The unlisted three: `/company/overview` (statement wrapper over the shared
      settings component), `/company/production-allocation` (full recut incl. a
      product-lookup bug fix in the Sankey), `/data/ingest` (minimal recut).
      REDUNDANCY FLAGS FOR TIM (nothing deleted): /company/overview is 100%
      duplicate of /settings?tab=organisation; /data/ingest is a legacy manual
      form with no inbound UI links, superseded by smart upload (Rosa prompt
      files still reference it, inaccurately).
- [x] Hospitality working pages: all eleven (venues, meals, drinks, menus,
      rooms, sales, waste + four editors) recut; statements with counts, rows,
      chips, quiet tables.
- [x] Agriculture site dashboards: all three [id] pages + nine components;
      figures rows, studio chart inks, typographic deltas; ~90% clones, noted
      as a future CropConfig parameterisation.
- [x] Shared chrome fixed once, platform-wide: FeatureGate's LockedFeaturePage
      (the beta/upgrade gate) recut to statement + hairline benefits + one pill;
      PageLoader is now a quiet pulse skeleton (no spinners anywhere);
      "THE MEASURES" stale eyebrows fixed across ALL rooms (10 files outside
      the workbench re-pointed to their registry rooms).

## Build order — ALL DONE (10 July)

- [x] 1. Room hygiene: THE WORKBENCH eyebrows, band scrollbar fix (+ stale
        eyebrows fixed in every other room too)
- [x] 2. The landing at /workbench/ + /api/workbench/counts + desk/band wiring
        (the room-landing pilot: room name in the band links to the landing)
- [x] 3. Emissions: one-paper recomposition (2,669 → ~1,180 lines + section
        components; scope split told once; Scope 1/2 tables folded in as
        disclosures; checklist rows; studio scope colours)
- [x] 4. Spend + Quality: queue-led spend (one meter, merged AI entry, step
        chrome gone), score-led quality (tabs to sections, data-sources content
        kept as the quiet foot section per decision 2)
- [x] 5. Sources + Inventory (+ Facilities list): reference shelf with grouped
        category sections, statement headers, chips
- [x] 6. Fleet: logbook (statement + figures row + one routing line; by-vehicle
        chart kept, duplicate by-scope re-plot retired)
- [x] 7. The fields: components/growing/ CropConfig + GrowingSitesPage; three
        pages are thin wrappers; delete-confirm bug fixed
- [x] 8. Hospitality: one header, Manage grid to fact rows with live counts,
        toggle as a hairline row, reload replaced with router.refresh, dead
        components deleted
- [x] 9. Sweep: mobile 375 clean (landing/emissions/hospitality, no horizontal
        scroll), consoles clean (only stale HMR replays in the buffer), tsc
        exit 0, zero badge-pill/off-palette/ccff00 hits in the room, alkatera
        bold fixed, zero-state tones softened (fleet 0s, quality NO DATA YET)

## What does not change

- All URLs, all APIs and data hooks, the Add flows (facility wizard, vehicle
  dialog, growing-site dialogs + questionnaires), the classification pipeline,
  the drill/detail pages, FeatureGate behaviour, tier gating.
- Functionality only improves; nothing is deleted unless repeated or redundant
  (each such case is a named decision above).
- No migrations. No prod. Local preview only, as ever.
