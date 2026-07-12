# The wiring: the plan

Working branch: `redesign` (worktree `.claude/worktrees/redesign`, dev server :8891/:8896).
Parent tracker: `tasks/redesign-todo.md`. Design reference: `design/studio-design-language.md`.
Seventh and FINAL room deep-pass, after Today, the workbench, the cellar, the network,
the evidence and the library. Covers EVERY page from the start (the workbench lesson),
with an explicit scope ring-fence for internal tooling (a first for the passes).

STATUS: DECISIONS SETTLED (10 July 2026). Building.

Decisions as settled by Tim (all four on the recommendation):
1. **/wiring/ landing — YES, poster THE PLAN** (tier + status + renewal; fact rows
   via /api/wiring/counts; EPR and the More… tail get their doors).
2. **Settings — FULL SURGERY** (two-way ?tab= sync; extract the two inline Stripe
   tab bodies; DELETE the dead suppliers tab; band Billing tab → /settings?tab=billing).
3. **Admin — THREE TIERS + /admin index** (deep-pass the 5 known-used tools + new
   index; sweep the ~14 partials; ring-fence ~9k lines as documented internal tooling).
4. **Governance gating — ADD THE GATES** (wrap the four ungated governance detail
   pages in FeatureGate to match their sibling families).

## What the wiring is

Settings, compliance, the rare and the seasonal. Ink band (rgb 26 27 29, mark: ring,
cream on colour). The BIGGEST room by raw lines (~35k audited) and the QUIETEST by
intent. Four clusters:

### Cluster 1 · Settings core
| Surface | Route | Lines | State |
|---|---|---|---|
| The monolith | /settings/ | 1,124 | Correct Statement; TEN shadcn tabs, one-way URL sync; ~640 lines of inline Stripe tab bodies; a DEAD suppliers placeholder tab; 💳 emoji |
| Billing stub | /settings/billing/ | 18 | Client redirect → /settings?tab=billing; the band's Billing tab hops through it; nothing else links here |
| Unleashed detail | /settings/integrations/unleashed/ | 245 | No Statement; '—' placeholders ×18; read-only viewer |
| Breww detail | /settings/integrations/breww/ | 1,123 | Least-converted authed page: no Statement, 10× rounded-lg, raw tables ×7, dashed empty |
| Create organisation | /create-organization | 259 | Auth-family dark-glass (M3 journeys pass); studio ink/cream HEXES |
| Complete subscription | /complete-subscription | 584 | Same family; HARDCODED 3-tier pricing array duplicating the DB-driven plans |
| ~16 tab components | components/settings/ | ~5,500 | Only SupportSettings is kit-built; 9 import no studio at all |

Worst components: XeroConnectionCard (20 raw colours, 6 Loader2, Badge),
TeamSettings (9 colours, 4 Loader2, Badge), OrganisationSettings (dashed logo
dropzone), AdvisorManagement (Badge). Every tab body sits in Card scaffolds.
Deep-linking is ONE-WAY everywhere: ?tab= is read at mount, never written back
(browser back/forward broken inside settings; 8 inbound ?tab= link sources verified).

### Cluster 2 · EPR (FeatureGate epr_beta; costs + prn also Canopy-gated)
| Surface | Route | Lines | State |
|---|---|---|---|
| Hub | /epr/ | 918 | WRONG ROOM eyebrow "THE EVIDENCE · EPR"; 7 inline sub-components; redundant double FeatureGate |
| Settings | /epr/settings/ | 1,691 | Wrong eyebrow; 6-section Card monolith (biggest page in the room) |
| Costs | /epr/costs/ | 944 | Wrong eyebrow; inline #BF4B2A brick hex; emerald/amber/red RAM dots; year tabs not URL-synced |
| PRN | /epr/prn/ | 594 | Wrong eyebrow; TRUE ORPHAN (zero inbound links) |
| Wizard | /epr/wizard/ + 17 steps | ~4,856 | NEVER converted: neon-lime ×27, Loader2 ×8, emerald/cyan glass, Badge, &mdash; in copy, inline hexes |
| Audit | /epr/audit/ | 566 | Wrong eyebrow; near-orphan (one link, from the wizard's last step); dead Loader2 import |
| Submissions | /epr/submissions/ | 822 | Wrong eyebrow; otherwise token-clean |

The M3 pass mislabelled the ENTIRE family THE EVIDENCE (brick era); no THE WIRING
string exists anywhere in it. Status→tone ladders duplicated 4×. Header block
duplicated 6× (Eyebrow + raw h1 instead of Statement).

### Cluster 3 · The social/governance families (feed the vitality pillars)
| Family | Pages | Lines | State |
|---|---|---|---|
| People & culture | hub + 4 details | 2,684 | Hub HALF-converted (Eyebrow yes, medallions/local tabs no); details untouched |
| Governance | hub + 4 details + weights | 2,977 | Hub has NO EYEBROW AT ALL (the room's hard miss); stakeholders worst (19 colour hits); details untouched AND ungated (siblings gate per-detail) |
| Community impact | hub + 4 details | 2,970 | Heaviest palette leak (hub 34 hits, hand-rolled ScoreRing with raw strokes); details untouched |
| Gallery stubs | byproducts, nature-actions, dependencies, vitality-weights | 125 | Studio-clean wrappers BUT all four carry "Back to Company Vitality" room-hops → /performance/ (cellar); DependenciesMatrix has raw severity maps |

The three hubs are ONE copy-pasted template (QuickActionCard + PageSkeleton +
coloured medallion grid + dashed guide + local-state tabs + RefreshCw). The 13
detail pages are ONE repeated shape (metric tiles + add-dialog + table).

### Cluster 4 · Admin + dev (internal-only, ~16k lines)
The M3 "all admin surfaces converted" claim is overstated: 11 pages got ONLY an
Eyebrow header (shadcn bodies untouched); ~25 pages fully pre-studio. Zero use of
Statement/Panel anywhere. beta-access has raw ccff00 ×4. admin/wiki (deferred here
from the library pass) is the canonical pre-studio page (Loader2 ×3, green-600).
STRUCTURAL: there is NO /admin index and NO admin navigation at all — the old
Sidebar carried it and was deleted; the band shows Settings/Billing. Every admin
page is reached by typed URL. dev/docs/* is ~3,800 lines of static internal prose.

## The noise audit (headlines; full detail in the four audit reports)

1. **The EPR room-identity bug**: six THE EVIDENCE eyebrows + an eyebrow-less wizard.
2. **The wizard is the room's debt centre**: ~90% of the off-palette load (the old
   lime brand, glass gradients, spinners) sits in /epr/wizard/ + steps.
3. **One-way deep-linking everywhere**: settings (10 tabs), breww (local tabs),
   epr/costs (year tabs), all three social hubs (local tabs). Read-at-mount only.
4. **The copy-paste triangle**: three identical hubs, 13 identical detail pages,
   4 duplicated status ladders, 2 hand-rolled skeletons, 6 duplicated headers.
5. **Orphans**: /epr/prn (zero links), /epr/audit (one link), the entire admin
   surface (navless), /settings/billing (vestigial hop).
6. **Dead weight**: the settings suppliers placeholder tab (non-functional, network
   owns suppliers); dead Loader2 import (epr/audit); redundant FeatureGate (epr hub).
7. **Two pricing sources of truth**: the DB-driven plan cards (settings subscription
   tab) vs the hardcoded tiers array (complete-subscription). NAMED FOLLOW-UP.
8. **Small pests**: 💳 emoji (getCardBrandIcon), '—' null placeholders (unleashed/
   breww/local-impact tables), &mdash; entity in wizard copy, dark: remnants.
9. **Behavioural flag, not design**: the four governance detail pages have NO
   FeatureGate while both sibling families gate every detail (decision 4).

## The design moves

### 1. The landing: /wiring/ (decision 1)
The room-landing pattern, ink. Statement ("The wiring." / "The quiet machinery.").
The one ink poster: THE PLAN (subscription tier + status + renewal, the room's
outcome number; every org has one). Fact rows via new /api/wiring/counts:
Settings (N team members), Billing (plan StateChip), Integrations (N connected),
EPR (obligation StateChip + next deadline), People & culture (score), Governance
(score), Community impact (score), Byproducts + Nature actions (quiet rows).
This gives EPR a real door and introduces the More… tail. Registry: landing
'/wiring/', desk ink poster flips from /settings/ to /wiring/, band room-name
becomes a link, /wiring prefix added. Band tabs STAY Settings + Billing (+More…);
the Billing tab repoints STRAIGHT to /settings?tab=billing (kills the stub hop;
the 18-line stub stays as a courtesy alias, evidence precedent).

### 2. Settings: the monolith surgery (decision 2)
1. TWO-WAY tab sync: value + onValueChange + router.replace (?tab=) — fixes
   back/forward and stale URLs; the 8 inbound ?tab= sources keep working.
2. Extract the ~640 inline lines: subscription tab → components/settings/
   SubscriptionSettings.tsx, billing tab → BillingSettings.tsx (Stripe handlers
   move verbatim, restyle only).
3. DELETE the dead suppliers placeholder tab (redundant: the network owns
   suppliers; the tab is a non-functional mock).
4. Card → Panel across the monolith + all tab components; Badge → StateChip;
   Loader2 → busy text; dashed dropzone → quiet studio dropzone; 💳 emoji →
   mono card-brand text; hand-rolled skeletons → house skeleton; the plan-card
   grid recut quiet (one room accent, StateChips for Current/Popular).
5. XeroConnectionCard + TeamSettings get the deep clean (the two worst);
   OrganisationSettings, ProfileSettings, AdvisorManagement, LcaTemplatesSettings,
   VineyardSettings, DataPrivacySettings, IntegrationsDirectory get the sweep.
6. Integration detail pages: breww + unleashed gain Statements (THE WIRING ·
   INTEGRATIONS eyebrow), studio tables (one shared quiet table treatment),
   rounded-lg → 6px, dashed → dim line; '—' placeholders → '·'. ALL sync/link/
   OAuth/disconnect contracts untouched.
7. PROTECT: every Stripe handler + return-param contract, Xero OAuth + mapping,
   Breww/Unleashed connect + sync, team invites + owner-only grants, GDPR
   export/delete, org→Stripe billing sync.

### 3. EPR: re-room, then quiet (the family's core move)
1. Six eyebrows THE EVIDENCE → THE WIRING (· EPR / · EPR · X); the wizard GAINS
   a Statement. Headers collapse to the Statement component (6 duplicated blocks).
2. The wizard subtree converts wholesale: neon-lime → studio ink/room tokens,
   glass gradients → paper Panels, Loader2 → busy text, Badge → StateChip,
   dashed → hairline, &mdash; → the plain word break, inline SVG hexes → tokens,
   Progress lime → ink. The 16-step machine, generation + exports untouched.
3. costs: #BF4B2A → token; RAM dots → StateChip tones; year tabs URL-synced.
4. Status ladders dedupe into lib/epr/status-tones.ts (the cert-room precedent);
   the two hand-rolled skeletons → house pattern; dead Loader2 import dropped;
   the redundant hub FeatureGate unwrapped (layout already gates).
5. Doors for the orphans: hub QuickActions gains PRN + Audit rows (and the
   /wiring/ landing lists EPR). settings 6-section monolith: each numbered
   section → a Panel with a mono eyebrow (extraction, no behaviour change).
6. PROTECT: all 13 /api/epr/* routes, the lib/epr calculators (11 test suites),
   submission generation + CSV/HMRC exports, epr_beta + Canopy gating, the
   Rosa page-context slice, the useEPRWizard state machine.

### 4. The social/governance families: one template, built once
1. Extract the shared hub scaffold ONCE (components/social/ or components/studio/
   hub pieces): statement header, quiet summary rows (medallions die), URL-synced
   mono tabs, house skeleton, dim compliance note. Convert all three hubs through
   it (governance FINALLY gets its eyebrow; community's ScoreRing strokes → studio
   tones or the shared score treatment).
2. One TopicDetailPage shell for the 13 detail pages (statement + metric BigNumbers
   + quiet tables + PillButton dialogs); Badge pills, bg-*-100 medallions, dashed
   empties, RefreshCw spinners all die (the recalc buttons keep their behaviour,
   busy text instead of spin).
3. The four gallery wrappers lose their "Back to Company Vitality" room-hops (the
   band owns navigation; the /performance/ links IN remain).
4. DependenciesMatrix severity maps → studio tones; Badge → StateChip.
5. Decision 4: add the missing FeatureGates to the four governance detail pages
   (matches both sibling families) OR note-only.
6. PROTECT: the vitality feed contract (people_culture_scores /
   governance_scores / community_impact_scores → lib/vitality social+governance
   pillars), all ~28 dialog mutations, the 24 org-scoped tables, the score
   recalc POST endpoints, all existing FeatureGates.

### 5. Admin + dev: the ring-fence (decision 3)
- Tier A (deep pass, ~1.2k lines): a NEW minimal /admin index (alkatera-admins
  only: a quiet ink FactList of the admin tools — the room is navless today),
  plus demo-seed, ingest-learning, reference-data, admin-tools/recalculate-lca,
  and admin/wiki (deferred here from the library pass).
- Tier B (mechanical substitution sweep, no restructuring): the 11 Eyebrow-only
  partials (blog ×3, feedback ×2, allocation-review, impact-proxy-values,
  emissions-trace, reconciliation, agribalyse-backfill, demo-seed overlap) +
  approvals, supplier-verification, beta-access (kill the ccff00 ×4).
- Tier C (ring-fenced, untouched, ~9k lines): all dev/docs/* static prose,
  admin/factors (1,416), admin/platform + its 12 components (~2k), the admin
  supplier tree, dev tier-management/test-harness/calculation-verifier.
  Documented as internal tooling, NOT part of the studio surface.
- PROTECT: every admin mutation (backfills, recalcs, approvals, verification,
  reference-data edits) — confirm dialogs and gating verbatim.

### 6. Onboarding pages: leave with the auth family (settled by precedent)
create-organization + complete-subscription were converted in the M3 journeys
pass AS the auth family (dark glass over studio ink/cream values, like login).
They stay. The hardcoded tiers array duplicating the DB-driven plans is a NAMED
FOLLOW-UP (unify onto one plan source), not this pass.

### 7. Room hygiene + sweep
- Every eyebrow reads THE WIRING · X (settings, integrations, EPR ×7, people,
  governance, community, admin Tier A/B). SupportSettings keeps THE NETWORK ·
  SUPPORT (intentional cross-room, network owns support).
- New /api/wiring/counts (resolveAccessibleOrg, head counts + score reads).
- Dead code: the suppliers tab, the dead Loader2 import, the redundant FeatureGate.
- Sweep: full tsc, off-palette greps (neon-lime, ccff00, THE EVIDENCE· within
  /epr, raw scales, Badge, Loader2/animate-spin, emoji, dashed, em dashes incl.
  '—' placeholders and &mdash;), mobile 375, consoles, review log, memory.

## Protections (restated for the build agents)

- STRIPE, byte-for-byte: create-checkout-session / create-portal-session /
  downgrade + cancel modals / trial flow / activation polling / return-param
  redirects (success, canceled, payment_required, complete_subscription, xero=).
- INTEGRATIONS: Xero OAuth + callback ?tab= contract + account mapping; Breww
  OAuth, sync, rebuild-packaging, link/unlink SKU + site, create-from-SKU,
  disconnect; Unleashed API-key connect + data viewer fetch.
- TEAM + GDPR: invites, role changes, owner-only ownership grant, account
  export/delete + signOut.
- EPR: the 13 API routes, lib/epr calculators (11 test suites green before AND
  after), generate-submission + export-csv/hmrc-csv signed-URL fallback,
  epr_beta + Canopy tier gates, useEPRWizard, Rosa slice.
- VITALITY FEED: the three *_scores tables and their recalc POSTs feed
  lib/vitality social + governance pillars; the cellar's /performance/ reads
  them. Presentation-only changes on these pages.
- All ~28 social/governance dialog mutations and their /api/* routes.
- Admin mutations behind confirm dialogs; useIsAlkateraAdmin gating everywhere.
- The 8 inbound /settings?tab= link sources (suspended page, stripe portal
  return, xero callback ×6, breww callback, 4 subscription banners) keep working.
- /settings/messages + /settings/feedback are THE NETWORK's (already converted):
  untouched.
- No migrations. No prod. Local preview only, as ever.

## Decisions for Tim (nothing built until these are settled)

1. **The /wiring/ landing?** Every other room now opens with one; the wiring is
   the last without. It also solves real problems: EPR/PRN/audit get doors, the
   eight More… entries get an introduction. Poster: THE PLAN (tier + status +
   renewal). Alt: no landing (the wiring stays the deliberately quiet room; the
   desk poster keeps pointing at /settings/). RECOMMEND: yes, with THE PLAN.
2. **The settings surgery?** Two-way ?tab= URL sync + extract the two inline
   Stripe tab bodies + DELETE the dead suppliers placeholder tab + repoint the
   band's Billing tab straight to /settings?tab=billing. (Alt: sweep-only, keep
   the monolith structure.) RECOMMEND: full surgery.
3. **Admin scope: adopt the three-tier ring-fence?** Deep-pass 5 small known-used
   tools + a new /admin index; mechanical sweep for 14; ring-fence ~9k lines of
   internal docs/dashboards as explicitly out of studio scope. (Alt: sweep
   everything — days of work on navless internal pages; or leave ALL admin.)
   RECOMMEND: the three tiers.
4. **The governance gating gap?** The four governance detail pages are ungated
   while both sibling families gate per-detail. Add the missing FeatureGates
   (small behavioural fix) or note-only this pass? RECOMMEND: add.

## Build order (after decisions; each step ends with a look on the dev server)

Big room, shallow debt: foundation by the lead, then FOUR parallel agents on the
disjoint clusters (settings / EPR / social families / admin tiers), then the sweep.

Built on :8896 (own dist dir). Foundation by the lead; four parallel cluster
agents. A mid-run Anthropic session limit killed the EPR lead and three social
children partway; the lead (this session, after the reset) finished the orphaned
slices directly and re-delegated the two large remainders. ALL VERIFIED.

- [x] 1. Foundation (lead): registry (`landing:'/wiring/'`, Billing tab → 
        /settings?tab=billing, /wiring prefix), /wiring/ landing (THE PLAN poster) +
        /api/wiring/counts (subscription + members + integrations + EPR obligation +
        3 scores + galleries), desk poster flip. VERIFIED (band ink, counts 200).
- [x] 2. Settings cluster (agent): monolith 1,124 → 205 lines; SubscriptionSettings
        + BillingSettings extracted (Stripe handlers verbatim); two-way ?tab= URL
        sync; dead suppliers tab DELETED; XeroConnectionCard + TeamSettings deep
        clean; 14-file component sweep; breww/unleashed statements + studio tables.
        Stripe/OAuth/GDPR contracts intact. NOTE: cancel-modal refresh now routes via
        onSubscriptionChanged (one behavioural seam, flagged).
- [x] 3. EPR cluster (agent died mid-wizard; lead finished): six THE EVIDENCE
        eyebrows → THE WIRING; the whole wizard (17 steps) de-limed (neon-lime/glass/
        Loader2/Badge/dashed/&mdash;/inline hexes gone); costs #BF4B2A + RAM dots →
        tones, year tabs URL-synced; lib/epr/status-tones.ts dedupes 4 ladders; hub
        redundant FeatureGate removed; PRN + Audit orphan doors added to the hub;
        settings 6 sections → Panels; dead Loader2 import dropped. EPR tests green.
- [x] 4. Social cluster (agent + 3 children; 2 children died, lead + this session
        re-ran): shared components/social/ scaffold (hub-header, topic-header,
        score-hero, quick-action-row, use-url-tab, etc.); 3 hubs (governance FINALLY
        gets its eyebrow) + all 13 detail pages; the four governance detail pages
        GATED (decision 4); community ScoreRing + gender charts → studio inks;
        DependenciesMatrix + BoardCompositionChart + the 4 people-culture dashboards
        converted; the 4 "Back to Company Vitality" room-hops retired.
- [x] 5. Admin cluster (agent died before finalising; lead finished): Tier A deep
        pass (demo-seed, ingest-learning, reference-data, recalculate-lca, admin/wiki);
        Tier B mechanical sweep (~13 partials, incl. beta-access ccff00 ×4 killed);
        Tier C (~9k lines: dev/docs, factors, platform, supplier tree) ring-fenced
        untouched. DEVIATION from decision 3: the "+ /admin index" was DROPPED. The
        root /admin is already owned by the DISTRIBUTOR panel dashboard
        (app/admin/(panel)/page.tsx, a separate distributor-studio stream, still on
        neon-lime and out of scope here); a second /admin page is a Next parallel-route
        error. The platform admin tools therefore stay URL-accessed (the pre-existing
        state); a platform-admin index, if wanted, needs its own path (e.g.
        /admin/tools) in a later pass, not a root /admin collision.
- [x] 6. Sweep (lead): full tsc exit 0; room-wide off-palette grep CLEAN (one stray
        BrandsStep dashed border caught + fixed); EPR + lib suites (4 pre-existing
        distributor/lca-assumptions failures, unrelated); live walk + mobile.

## Review log
- 10 July 2026 · Wiring deep pass (the FINAL room): Tim settled all four decisions
  (add the /wiring/ landing with THE PLAN; full settings surgery; three-tier admin
  ring-fence + index; add the governance gates). Built with a foundation pass + four
  parallel cluster agents. An Anthropic session limit mid-run killed the EPR lead and
  three social children; after the reset the lead (this session) finished the orphaned
  slices directly (the last 3 EPR wizard steps incl. the one broken file;
  BoardCompositionChart) and re-delegated the two large remainders (3 community pages,
  4 people-culture dashboards) to fresh agents. All verified on :8896. Notes for Tim:
  (a) the /admin index was DROPPED — /admin is owned by the distributor panel
  (a separate studio stream, still neon-lime, out of scope); a platform-admin index
  needs its own path later, not a root collision. (b) The settings cancel-modal now
  refreshes via onSubscriptionChanged rather than a direct history refetch (Billing
  refetches on tab mount) — one behavioural seam, works but worth a glance. (c) EPR is
  fully behind the epr_beta FeatureGate, so its hub/wizard were verified via tsc+grep,
  not a live click-through (the dev org lacks the flag); worth a walk once epr_beta is
  on. (d) 4 pre-existing test failures (distributor + lca-assumptions) are unrelated to
  this pass. (e) the distributor /admin panel and the onboarding auth pages remain
  off-palette by design (their own streams). THE HOUSE IS COMPLETE: all seven rooms
  converted; the go-live pass (merge main, full build, walk-through) is what remains.

## What does not change

- All URLs (the billing stub stays as an alias; no route deletions — the one
  deletion is a dead TAB inside /settings, not a route).
- The whole Stripe stack, all OAuth/API-key integration contracts, team + GDPR
  flows, the EPR calculators + exports + gating, the vitality feed, every admin
  mutation, all FeatureGates (plus four ADDED if decision 4).
- Tier C admin/dev surfaces: explicitly ring-fenced, documented as internal.
- The onboarding pages (auth family). /settings/messages + feedback (network).
- Functionality only improves; nothing is deleted unless repeated or redundant
  (the suppliers placeholder tab is the only deletion, named above).
- No migrations. No prod. Local preview only, as ever.
