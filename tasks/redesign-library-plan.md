# The library: the plan

Working branch: `redesign` (worktree `.claude/worktrees/redesign`, dev server :8891/:8895).
Parent tracker: `tasks/redesign-todo.md`. Design reference: `design/studio-design-language.md`.
Sixth room deep-pass, after Today, the workbench, the cellar, the network and the
evidence. Covers EVERY page and sub-page from the start (the workbench lesson).

STATUS: DECISIONS SETTLED (10 July 2026). Building.

Decisions as settled by Tim:
1. **/library/ landing — YES** (Tim chose consistency over the no-landing default; the
   room joins the other five with a front door: statement + one teal poster + fact rows
   + a new /api/library/counts). Sibling cross-links (move 4) still land.
2. **Category colours — studio token map** (colour names → the six room inks + dim,
   muted; existing data keeps working).
3. **Wiki map palette — teal-led re-key** (guide takes teal; the other four types keep
   muted studio inks; chrome + edge stroke → room-accent).
4. **Relocate WikiMapClient — YES** (marketing/ → components/wiki/, one import).
5. **'embedded' content type — ADD TO CREATE NOW** (Tim overrode the remove-from-filters
   default: make it a real creatable type in the create Select, not a filterable
   phantom; wire the render path on item detail so an embed actually shows).

## What the library is

What you know. Teal band (rgb 30 95 91, mark: arch, cream on colour). The smallest
room: two tabs, six pages, no strays, no orphan routes.

| Surface | Route | Lines | State |
|---|---|---|---|
| Knowledge hub | /knowledge-bank/ | 202 | Stale THE EVIDENCE eyebrow; palette debt in children |
| Add resource | /knowledge-bank/new/ | 345 | Stale eyebrow; otherwise clean studio form |
| Item detail | /knowledge-bank/items/[itemId]/ | 443 | NO eyebrow; neon-lime, yellow star, rounded-lg |
| Category listing | /knowledge-bank/categories/[categoryId]/ | 138 | NO eyebrow, not font-display; colour-clean |
| Wiki map | /wiki/ | 75 (+672 client) | Stale THE EVIDENCE · WIKI eyebrow; brick chrome in the map |
| Wiki article | /wiki/[slug]/ | 130 | Clean already (room tokens throughout) |

Registry today: tabs Knowledge / Wiki. No "More…", no landing. Both prefixes
route to the library correctly; the accent already renders teal everywhere the
room tokens are used, so the stale eyebrows are COPY fixes, not colour fixes.

## The noise audit

### The re-rooming residue (the room's defining fault)
Knowledge and wiki were studio-converted on 5 July while filed under THE
EVIDENCE (brick); the teal library was created on 6 July. Three surfaces still
say the old room: `knowledge-bank/page.tsx:84` and `new/page.tsx:189` read
"THE EVIDENCE · KNOWLEDGE", `wiki/page.tsx:32` reads "THE EVIDENCE · WIKI".
Deeper: the wiki map client hardcodes the brick accent (~11 chrome references
plus the SVG edge stroke `#BF4B2A`) instead of `room-accent`, and its comment
still says "brick leads the room".

### Knowledge bank
- Hub (202): correct structure (stats BigNumbers, RecentActivity, CategoryGrid,
  SearchAndFilter, item grid); the noise lives in the child components.
- Add resource (345): clean studio form. The write model is the KEY protection:
  platform admins write GLOBAL content (organization_id = null), members write
  org-scoped; tags branch the same way; upload goes to the PRIVATE
  knowledge-bank-files bucket with the storage PATH stored (not a URL).
- Item detail (443): the family's worst page. No eyebrow, `rounded-lg` (not the
  studio radius), `text-neon-lime` medallion + link, `text-yellow-500`
  favourite star. Viewer logic is sound (video/link/document; signed URLs:
  global items via /api/knowledge-bank/signed-url with the service role, org
  items via client createSignedUrl; view/download counts via increment RPCs).
- Category listing (138): colour-clean but typographically unconverted (raw h1,
  no eyebrow).
- Components:
  | CategoryGrid | ~15-class raw rainbow (colorMap) + 2 neon-lime. Colour is
    DATA-DRIVEN off knowledge_bank_categories.color (default 'blue'), so the
    fix is a token MAP, not class swaps |
  | KnowledgeBankCard | ~6 (contentTypeColors blue/purple/green/orange, yellow
    star, a neon-lime "Platform" pill + hovers) |
  | RecentActivity | 3 neon-lime |
  | PartnerAuthorBadge | ~7, a hardcoded EMERALD theme; shows Impact Focus
    content attribution (external_author_* columns; NO runtime coupling to the
    network room's experts). Dead detail: its PARTNER_LABELS map is unused,
    the label "Impact Focus" is hardcoded |
  | SearchAndFilter | clean (0) |
- Dead details: the 'embedded' content type exists in the type union and the
  FILTER list but is not creatable (absent from the create Select) — a
  filterable phantom. PARTNER_LABELS unused.
- No FeatureGate/tier gating anywhere (by design: the library is for everyone);
  access control is RLS + the admin/global write split.
- No orphan components; all four routes reachable.

### Wiki
- Map page (75) + article page (130) are thin and near-clean; the article page
  is already fully room-token'd.
- The map client (marketing/components/WikiMapClient.tsx, 672 lines) is the
  room's biggest design-debt file AND it is MISFILED: it lives under
  marketing/ from the public-wiki era, but its only importer is the
  authenticated wiki page.
  - Structure is sound and stays: HTML pill nodes in type bands, an SVG edge
    overlay recomputed from live getBoundingClientRect, a detail drawer, a
    reader POPOUT whose article HTML is embedded in the node data (no fetch),
    wikilink interception so reading chains without navigation, Esc/scroll
    lock. All React state, no URL state.
  - Colour: the five BANDS accents are legitimate DATA-VIZ (they encode page
    type: guide/concept/standard/legislation/glossary) but the palette is
    brick-led from the evidence era. The ~11 CHROME uses of studio-brick
    (search focus, tour pills, drawer/popout hovers) and the brick edge
    stroke are NOT data-viz: stale room accent.
- wiki.css: 11 hardcoded hex values (ink/teal/grey/hairline equivalents).
  Light-only is FINE (dark mode is retired platform-wide); tokenising is for
  maintainability, and its link colour #1E5F5B already happens to be teal.
- Subscriber gating (three layers, all PROTECTED): per-page getUser() →
  redirect('/login') + robots noindex metadata; AppLayout subscription
  lifecycle gating (wiki is not in the bypass list); robots.ts disallows
  /wiki. No public wiki route remains; the sitemap emits nothing for it.
- Content pipeline (PROTECTED): fs read of wiki/pages/*.md via server-only
  lib/wiki.ts (gray-matter, wikilink resolution, sanitiser allow-list);
  next.config.js outputFileTracingIncludes maps wiki/pages into the FOUR
  consuming routes (remove one and prod silently 404s); the Rosa sync
  (full-replace of gaia_knowledge_base category='wiki', zero-pages abort
  guard, CRON_SECRET bearer, fired by the deploy-succeeded Netlify fn, admin
  fallback at /admin/wiki). Rosa's citations deep-link to /wiki/[slug].
- Stale comment: lib/wiki.ts:13 cites app/sitemap.ts as a traced consumer; it
  is not (good: no public leak), the comment is just old.

### Cross-room wiring notes
- The two library tabs are SIBLINGS THAT NEVER MEET: no link from knowledge to
  wiki or back. The command palette reaches both; Rosa cites the wiki; the
  desk poster lands on /knowledge-bank/.
- Naming hazard, noted not fixed: /knowledge is the PUBLIC marketing blog
  (SEO/ISR, outside the app shell); /knowledge-bank is this room. Leave the
  public route alone.

## The design moves

### 1. The re-rooming fix (copy + accent, the room's core move)
1. Three eyebrow strings: "THE LIBRARY · KNOWLEDGE" (hub, new) and
   "THE LIBRARY · WIKI" (map page).
2. WikiMapClient: every CHROME use of studio-brick/#BF4B2A → room-accent
   (search focus, tour pills and bar, drawer/popout hovers, the edge stroke);
   the "brick leads the room" comment dies.
3. The BANDS type palette re-keys teal-led (decision 3): guide takes the
   room's teal; the other four types keep muted studio inks. Colour still
   encodes type (data-viz, allowed); the room just stops leading with another
   room's colour.
4. wiki.css hexes → the design tokens they already approximate (ink, teal,
   dim, hairline). Light-only stays (dark mode is retired).

### 2. Knowledge components: the palette debt
1. CategoryGrid: the 15-colour rainbow collapses to a STUDIO TOKEN MAP
   (decision 2) keyed off the same knowledge_bank_categories.color names, so
   existing data keeps working: map the colour names onto the six studio room
   inks + dim (muted, gallery-grade), neon-lime hovers → room-accent.
2. KnowledgeBankCard: contentTypeColors → one quiet treatment (mono type
   label or a single accent); the "Platform" neon-lime pill → a StateChip
   (tone quiet, label PLATFORM); yellow star → room-accent when favourited;
   neon-lime hovers → room-accent.
3. RecentActivity: 3 neon-lime → room-accent.
4. PartnerAuthorBadge: emerald theme → studio (hairline panel, mono
   eyebrow-ish credit, StateChip "PARTNER"); wire the PARTNER_LABELS map so
   the label is data-driven (one line) instead of hardcoded.
5. SearchAndFilter: untouched (clean); the 'embedded' phantom leaves the
   filter list (decision 5).

### 3. The two unconverted pages
1. Item detail: Statement (eyebrow THE LIBRARY · KNOWLEDGE, item title as the
   headline), font-display, studio radius; the medallion quiet; keep the
   viewer, signed-url flows, favourite/download/view logic EXACTLY.
2. Category listing: Statement (eyebrow THE LIBRARY · KNOWLEDGE, category name
   headline, item count standing right as a BigNumber), font-display.

### 4. Siblings meet (the smallest room's one structural move)
1. Knowledge hub gains a quiet FactRow/link: "The wiki: N pages of
   sustainability reference → /wiki/".
2. The wiki map page gains a quiet link back: "Your resources live in the
   knowledge bank → /knowledge-bank/".
3. WikiMapClient relocates marketing/ → components/wiki/ (decision 4; pure
   move + one import).

### 5. No landing (decision 1, the honest default)
The room-landing pattern is for crowded rooms (Tim's rule, 9 July). Two tabs,
no strays, nothing undiscoverable: a landing would add ceremony and a click.
The desk poster keeps landing on /knowledge-bank/ (a real content page), and
the sibling cross-links do the introduction work. IF Tim prefers consistency
(five rooms have landings), the alternative is a small /library/ landing:
statement "What you know.", one teal poster (THE SHELF: N resources · N wiki
pages), two fact rows + counts route reading knowledge_bank_items (published,
org OR global) and the wiki fs count via lib/wiki.ts (server component so
server-only is satisfied; add the route to outputFileTracingIncludes).

### 6. Room hygiene + sweep
- lib/wiki.ts:13 stale comment fixed (one line).
- Dead code: PARTNER_LABELS wired (2a above); 'embedded' filter removed.
- Sweep: greps (neon-lime, emerald-, yellow-500, studio-brick within the
  library files, "THE EVIDENCE ·" within the library files, em dashes),
  full tsc, mobile 375, consoles, review log, memory update.

## Protections (restated for the build agents)

- WIKI PIPELINE, byte-for-byte: the four outputFileTracingIncludes entries in
  next.config.js; server-only on lib/wiki.ts + lib/wiki-sync.ts; the
  sanitiser allow-list and WIKILINK regex; the zero-pages sync abort guard;
  the CRON_SECRET bearer check; the gaia_knowledge_base category='wiki'
  full-replace contract; the deploy-succeeded trigger; /admin/wiki manual
  sync; Rosa citation URLs (/wiki/[slug]).
- WIKI GATING, all three layers: per-page getUser() → /login redirect +
  noindex metadata; AppLayout subscription gating (wiki stays OUT of the
  bypass list); robots.ts disallow.
- The map/reader interaction contract: embedded article HTML (no fetch),
  wikilink interception, Esc + scroll lock, the SVG edge recompute. Restyle,
  never restructure.
- KNOWLEDGE write model: the useIsAlkateraAdmin global-vs-org split (items
  AND tags); the private knowledge-bank-files bucket, path convention, and
  BOTH signed-url paths (API for global, client for org); view/download
  increment RPCs with fallbacks; favourites.
- The authoring artefacts (wiki/CLAUDE.md, lint.js, index.md, log.md, raw/)
  are out of scope: not app code.
- The public /knowledge marketing blog: untouched, different surface.

## Decisions for Tim (nothing built until these are settled)

1. **A landing at /library/?** The house rule says landings are for crowded
   rooms; this room has two tabs and no strays. RECOMMEND: NO landing — keep
   the desk poster on /knowledge-bank/ and let the new sibling cross-links do
   the introduction. (Alternative for consistency: a small landing + counts
   route, spec'd in move 5.)
2. **Category colours**: collapse the 15-colour rainbow to a studio token map
   (colour names → the six room inks + dim, data keeps working), or drop
   per-category colour entirely (mono)? RECOMMEND: the token map — colour
   still aids scanning, muted to gallery grade.
3. **Wiki type palette**: re-key the five-type band palette teal-led (guide
   takes the room colour; concept/standard/legislation/glossary keep muted
   studio inks), or keep the brick-led palette exactly (type identity from
   the evidence era)? RECOMMEND: re-key teal-led.
4. **Relocate WikiMapClient** from marketing/ to components/wiki/? Pure move,
   one import updated; ends the public-era misfiling. RECOMMEND: yes.
5. **The 'embedded' content type**: it is filterable but not creatable.
   Remove it from the filter list (align with reality; creatable embeds are
   product work for later), or add it to the create form now? RECOMMEND:
   remove from filters, note the follow-up.

## Build order (after decisions; each step ends with a look on the dev server)

Small room: one agent per tab family after the lead does the eyebrow/registry
groundwork, or a single sequential pass. Proposed:

Built on :8896 (own dist dir .next-8896). Foundation by the lead; the KB and
wiki trees by two parallel agents over disjoint files. ALL VERIFIED.

- [x] 1. Foundation (lead): registry `landing:'/library/'` + `/library` prefix,
        desk poster href → /library/, the /library/ landing (statement + THE SHELF
        teal poster + two fact rows), /api/library/counts (published resources +
        categories org-or-global head counts + wiki pages via getPublishedWikiPages),
        next.config.js tracing entry for the counts route. VERIFIED (band teal,
        counts 200 = 39 wiki pages, landing renders, mobile 375 no overflow).
- [x] 2. Knowledge (agent): eyebrows → THE LIBRARY, neon-lime → room-accent
        everywhere, CategoryGrid 15-colour map → studio token map (COLOUR_TO_INK →
        the six room inks + dim), Card → Panel, Badge → StateChip, yellow star →
        room-accent, PartnerAuthorBadge de-emeralded (+ PARTNER_LABELS wired via a
        partnerKey prop), item detail + category listing gained Statements,
        skeletons → PageLoader. DECISION 5: 'embedded' is now a creatable type
        (create Select + file_url column + early-return in the signed-url guard +
        a sandboxed iframe render branch mirroring video). tsc clean. VERIFIED.
- [x] 3. Wiki (agent): index eyebrow THE EVIDENCE → THE LIBRARY · WIKI; WikiMapClient
        git-mv'd marketing/ → components/wiki/ (import repointed), BANDS re-keyed
        teal-led (guide → teal, others unchanged), 12 studio-brick chrome states +
        the #BF4B2A edge stroke → room-accent (stroke via style={{stroke:
        'rgb(var(--room-accent-rgb))'}} since var() doesn't resolve in SVG attrs),
        CTA → PillButton; wiki.css teal literals → rgb(var(--room-accent-rgb)),
        stale comment fixed; lib/wiki.ts stale sitemap comment fixed. VERIFIED
        (map renders, GUIDES teal / CORE CONCEPTS cobalt, no brick, tours + reader
        popout intact).
- [x] 4. Siblings meet: knowledge hub → "ALSO IN THE LIBRARY · The wiki" link;
        wiki index → "Your resources live in the knowledge bank" link. Relocation
        landed in step 3.
- [x] 5. Sweep: full tsc exit 0; room-wide off-palette grep CLEAN (no neon-lime,
        ccff00, studio-brick, #BF4B2A, THE EVIDENCE·, raw emerald/amber/slate/blue/
        purple/yellow scales, Badge pills, Loader2/animate-spin, em dashes); mobile
        375 no overflow; consoles clean on landing + KB hub + wiki map. Review log +
        memory updated.

## Review log
- 10 July 2026 · Library deep pass: Tim settled all five decisions (ADD the
  /library/ landing over the no-landing default; category colours → studio token
  map; wiki map → teal-led re-key; relocate WikiMapClient; ADD 'embedded' as a
  creatable type over the remove-from-filters default). Built with two parallel
  agents (KB + wiki) after the lead did the foundation. All verified on :8896.
  Notes for Tim: (a) /admin/wiki is a WIRING-room surface (ink), still pre-studio
  shadcn (Loader2, green-600) — deliberately LEFT for the wiring pass, not this
  one; (b) the embedded content type and the KB card/category-grid studio tints
  couldn't be exercised visually (the dev org has zero resources) — verified
  statically (tsc + grep); worth a click-through once a real embed item exists;
  (c) the band wears a brand-derived teal (rgb 30 73 95) on this org, not raw
  #1E5F5B — expected brand-palette behaviour, same as every other room.

REMAINING after the library: THE WIRING (the last room).

## What does not change

- All URLs. The wiki pipeline, gating, sync and citation contracts. The
  knowledge write model, bucket, signed-url flows and counters. The public
  /knowledge blog. The authoring artefacts under wiki/.
- Functionality only improves; nothing is deleted unless repeated or
  redundant (the 'embedded' filter entry and the unused PARTNER_LABELS are
  the only candidates, both named above).
- No migrations. No prod. Local preview only, as ever.
