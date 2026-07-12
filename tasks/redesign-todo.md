# Studio redesign · milestones

Working branch: `redesign` (worktree `.claude/worktrees/redesign`, dev server :8891).
Design reference: `design/studio-design-language.md`. Plan: `~/.claude/plans/i-want-to-build-ancient-whistle.md`.

Rules of the road:
- All redesign edits happen in THIS worktree, never the main checkout.
- Merge `main` into `redesign` after every milestone, and at least weekly.
- No PR, no merge to `main`, until the final go-live pass. Netlify only builds `main`.
- Local Supabase only (`dev@local.test / localdev123`).

## Milestone 0 · the safe duplicate
- [x] `redesign` branch + worktree created from `main`
- [x] `.env.local` copied (local Supabase confirmed)
- [x] `pnpm install`
- [x] launch.json `redesign` config on :8891
- [x] design language converted to `design/studio-design-language.md`
- [x] dev server verified on :8891, logged in as dev@local.test, baseline screenshot (5 July)
- [x] branch pushed to GitHub as backup (`origin/redesign`)

## Milestone 1 · the foundation
- [x] Tokens: studio ground is now the DEFAULT `:root` theme in globals.css (paper/cream/hairline/dim/ink, room-ink charts, radius 6); studio.* + room tokens + studio ease in tailwind.config.ts
- [x] Fonts: Space Grotesk added app-wide (`--font-display`, and `--font-heading` now points at it); Lora retired; Playfair kept only for passport exports
- [x] Dark mode retired: next-themes forced light in app/layout.tsx, `.dark` block deleted (toggle UI still present but inert; confirm removal with Tim)
- [x] Kit of parts: ported the distributor studio kit (uncommitted work found in the main checkout, built to this same design doc) to app-wide `components/studio/` (21 files: panel, pill-button, big-number, fact-row, state-chip, stage-bar, mark, mono-tabs, eyebrow, statement, poster-block, breathing-grid, room-band, ink-band, studio-shell, theme registry...)
- [x] Kit-of-parts gallery at `/studio-kit` on :8891; legacy neon-* vars retinted to studio inks as a bridge until each room is converted
- [ ] REVIEW CHECKPOINT with Tim ← WE ARE HERE

Note: the ROOMS registry in components/studio/theme.ts is still distributor-flavoured;
the platform room mapping is the M2 workshop. The distributor studio work remains
uncommitted in the MAIN checkout (another stream); when it lands on main, the merge
into this branch will conflict lightly in tailwind.config.ts (same token values, so
resolution is trivial).

## Milestone 2 · the house of rooms
- [x] Room mapping approved by Tim: Today (forest) / The measures (cobalt) / The evidence (brick) / The post (ochre) / The wiring (ink); registry + path resolution in `components/studio/platform-rooms.ts`
- [x] The desk at `/desk`: greeting statement + four breathing poster blocks + the wiring in ink; login now lands here (app/page.tsx)
- [x] The room band: 52px, room colour, desk link, mono tabs, bell + org/account cluster (`band-controls.tsx`); ochre takes ink text
- [x] The ink band: Rosa's permanent home (`ask-rosa-band.tsx`) — ring, Ask Rosa prompt pill (opens the drawer), ⌘/ note, room tabs for the thumb; the lime header button is retired
- [x] Sidebar + Header replaced in AppLayout; ALL gates kept (auth, org, subscription, onboarding wizard, banners, RosaDrawer); skeleton restyled to the shell
- [ ] REVIEW CHECKPOINT with Tim ← WE ARE HERE

Open questions for the M2 review:
- Knowledge Bank + Wiki + Guardian currently live in The evidence; happy?
- The band does not yet hide tier/milestone-gated tabs (pages still gate themselves)
- Mobile: tabs scroll horizontally in the band; a thumb-first pass comes with M3
- Old Sidebar.tsx/Header.tsx still exist (admin/dev nav lives there); delete after M3 confirms nothing is lost

## Milestone 3+ · room by room
- [x] TODAY (5 July): the brief opens with a statement (greeting + date eyebrow); vitality hero
  is a cream panel with working-tone ring + Rosa's read; priority tiles carry the one forest
  block; Pulse/Financial/Targets have statement headers; the entire pulse widget catalogue
  (~60 files), rosa surfaces incl. the drawer, vitality modals, targets and financial cards are
  de-limed to studio (forest accents, working-tone typographic chips, no spinners/gradients/
  glows). grep for ccff00/#0c1410 in components/{rosa,vitality,pulse} returns nothing.
- [x] THE MEASURES (5 July): statement headers on all 9 pages; facilities, supplier and
  product components to cobalt studio. Committed 51673c14.
- [x] THE EVIDENCE (5 July): reports, certifications, EPR (+wizard), guardian, library,
  knowledge, wiki (+connected map) to brick studio. Committed 3e04b042.
- [x] THE POST + THE WIRING (6 July): settings, integrations, all admin surfaces; ochre for
  the post, quiet ink for the wiring. Committed a3291075.
- [x] Measures leftovers (6 July): agriculture (vineyards/orchards/arable), nature,
  byproducts, soil carbon, hospitality, energy, LCA wizard, product detail. Same commit.
- [x] Journeys (6 July): onboarding wizard (all step families), supplier portal + onboarding,
  auth forms, public invites, create-organization, complete-subscription. Same commit.
- [~] Public + artefacts: in flight (landing components, page clients, blog/menu/getaccess,
  LCA report + report HTML APIs + passport accent + transactional emails)
- [x] Desk: live numbers via /api/desk/counts (resolveAccessibleOrg, head-count queries)
- [x] Cleanup: Sidebar.tsx, Header.tsx, RosaHeaderButton.tsx deleted (nothing imported them)
- [ ] Later cleanup: retire neon-* bridge vars (62 files still reference them; they resolve
  to studio inks so they render correctly); /studio-kit gallery: keep or delete (ask Tim)
- [ ] App icons (favicon/apple-icon still lime): brand decision for Tim
- [ ] Distributor portal (align with generalised studio language; wait for main-checkout
  stream to land to avoid conflicts)
- [ ] Procurement portal (respect tenant whitelabel injection)

## Milestone 4 · room deep-passes (reduce the noise, room by room)
- [x] TODAY (9 July): plan at `tasks/redesign-today-plan.md`, decisions settled with
      Tim, built and verified. The Brief is a one-column read (priorities with the
      one forest block, the day's numbers, the reading digest, the good work, quiet
      margins); the hub customise system is retired; Pulse lost its internal tabs
      (verdict is the statement, sections down one paper, Money tab removed in
      favour of Financial); Financial is statement-led and number-first. tsc clean,
      consoles clean, mobile clean.
- [x] THE WORKBENCH (10 July): plan at `tasks/redesign-workbench-plan.md`, four
      decisions settled with Tim, ALL 30 pages in the room converted (Tim: full
      consistency, no old-design pages left). Room-landing pilot SHIPPED at
      /workbench/ (statement, cobalt footprint poster, fact rows with live counts
      via /api/workbench/counts, beta rows flag-filtered; desk poster + band room
      name link to it). Emissions is one paper (five tabs gone, monolith split);
      Spend is the queue; Quality is score-led; Fleet is a logbook; the three
      agriculture list pages share components/growing/ (CropConfig); hospitality
      is one header + rows across all twelve pages; facility detail has quiet
      mono mode tabs. Shared chrome fixed once: FeatureGate lock page, PageLoader
      skeleton (no spinners), stale THE MEASURES eyebrows fixed in every room.
      tsc clean, consoles clean, mobile clean.
- [x] THE CELLAR (10 July): plan at `tasks/redesign-cellar-plan.md`, five decisions
      settled with Tim, built and verified. Deleted 10 orphaned routes (the dead
      parallel LCA flow incl. the mock-data report page and the banned-pattern
      materials editor; EF31 table salvaged). Landing SHIPPED at /cellar/ with the
      vitality score as the plum poster + /api/cellar/counts; Vitality is now a
      listed tab. Products list/new/import/supplier-matches, the product hub (orbs
      gone, one CTA, quiet tabs), the recipe skin, the LCA wizard (second AI folded
      into Rosa), the library and nature, and the vitality recut (PillarCard studio,
      hospitality intact) all converted. tsc clean, mobile clean, consoles clean.
      NB: the wizard's multi-step body is data-gated and verified structurally only;
      needs a click-through on a real product with a recipe.
- [x] THE NETWORK (10 July): plan at `tasks/redesign-network-plan.md`, seven
      decisions settled with Tim, built (foundation by lead + six parallel
      agents after groundwork) and verified on :8895. Landing SHIPPED at
      /network/ (statement, THE CHAIN ochre poster ink-on-saturated, five fact
      rows via /api/network/counts + a single advisor-unread aggregate, no
      N+1). Registry: five flat tabs (Suppliers/Messages/Support/Experts/
      Sourcing — the fifth renamed from "Responsibility" at Tim's request so it
      fits the band; kept a peer, not nested under Suppliers), "More…" retired,
      /network path-prefix + desk poster wired. Suppliers monolith split into components/suppliers/
      (fixes the inline focus-loss bug), ONE composition, one door in (Find or
      invite + Send ESG survey; Smart upload into the sheet; ?invite=1 auto-
      opens). Legacy ungated /suppliers/new DELETED (public invite journey
      supersedes it), five inbound links repointed. Supplier detail: tabs →
      stacked sections (impact figures as tabular numbers, ESG Q&A as tone
      chips), SendEsgSurveyDialog restyled (contract intact). Shared
      components/network/ Thread + MessageBubble + useRealtimeThread adopted by
      messages AND support; both lists + FeedbackDialog de-limed. Experts: one
      config-driven PartnerProfile template (two thin wrappers), six-colour
      icon system deleted; Impact Focus mailto fixed to hello@impactfocus.co.uk
      (all other partner URLs byte-for-byte). Responsibility: six hairline
      attestations, coverage BigNumber, emoji + /performance back-link gone.
      Advisor-security: four directory routes wrapped (resolveAccessibleOrg +
      denyReadOnlyAdvisor), three correctly left (RLS/anon or already
      compliant). tsc clean, mobile clean, consoles clean.
- [x] THE EVIDENCE (10 July): plan at `tasks/redesign-evidence-plan.md`, seven
      decisions settled with Tim, built (foundation by lead + five parallel agents
      after groundwork) and verified on :8895. Landing SHIPPED at /evidence/
      (statement, THE PROOF brick poster, seven fact rows via /api/evidence/counts
      — which also surfaced the footprint, guardian, library and historical
      surfaces that were orphaned or bandless). Registry: five flat tabs
      (Reports/Certifications/Guardian/Targets/Library), More… retired, /evidence
      path-prefix + desk poster wired. Phantom /reports/ front door → redirect to
      the real hub /reports/sustainability (band points straight there); legacy
      /operations → redirect to /company/facilities (5 links repointed). Reports
      hub studio-polished (URL-synced tabs, quiet cards, guardian cross-link);
      both setup wizards purged of the stone-* scale. CCF hub recut + 18 category
      cards swept + delineation cross-links to/from the workbench. Certifications:
      hub scaffold collapsed, the 15-component cluster converted (B Corp + EcoVadis
      prioritised per Tim), status-tones helper, all three experiences URL-synced
      (11 B Corp features preserved), library cross-link added. Guardian: statements
      + emoji/dashed/spinner purge + riskTone helper + a status-string bugfix.
      Library detail statement + font fix. Targets: stale PULSE eyebrow → evidence,
      room-hop back-link removed, the room's last Loader2 gone. 6 orphan components
      deleted, 2 misfiled cards moved to components/emissions/. Full tsc 0 errors,
      mobile clean, consoles clean, room-wide off-palette grep clean.
- [x] THE LIBRARY (10 July): plan at `tasks/redesign-library-plan.md`, five decisions
      settled with Tim, built (foundation by lead + two parallel agents over the KB
      and wiki trees) and verified on :8896. The room's first landing SHIPPED at
      /library/ (statement, THE SHELF teal poster, two fact rows via /api/library/counts
      — published resources + categories as org-or-global head counts, wiki pages
      counted from disk via getPublishedWikiPages; the counts route added to
      next.config.js outputFileTracingIncludes); registry gained `landing:'/library/'`
      + the /library prefix, desk poster flipped, band room-name now links. Knowledge
      bank: three brick eyebrows → THE LIBRARY, neon-lime → room-accent throughout,
      CategoryGrid's 15-colour rainbow → a studio token map (data-driven off
      category.color, muted to the six room inks + dim), Card → Panel, Badge →
      StateChip, yellow star → room-accent, PartnerAuthorBadge de-emeralded with
      PARTNER_LABELS wired, item detail + category listing gained Statements,
      skeletons → PageLoader. 'embedded' is now a creatable content type (Tim's call
      over the remove default: create Select + file_url + signed-url guard +
      sandboxed iframe render). Wiki: index eyebrow fixed, WikiMapClient git-mv'd
      marketing/ → components/wiki/ and re-keyed teal-led (guide takes teal, the
      other four types keep their studio inks), 12 studio-brick chrome states + the
      #BF4B2A edge stroke → room-accent (SVG stroke via a style prop, since var()
      doesn't resolve in SVG attributes), CTA → PillButton, wiki.css teal literals →
      the room-accent variable so prose follows a partner brand; two stale comments
      (wiki.css, lib/wiki.ts) fixed. The two library tabs now cross-link (siblings
      meet). tsc 0 errors, off-palette grep clean, mobile clean, consoles clean.
      NB: /admin/wiki is a wiring surface, LEFT for the wiring pass; the embedded
      render + KB card tints need a click-through on an org with real resources
      (dev org is empty).
- [x] THE WIRING (10 July, the FINAL room): plan at `tasks/redesign-wiring-plan.md`,
      four decisions settled with Tim, built (foundation by lead + four parallel cluster
      agents; a mid-run session limit killed the EPR + three social agents, the lead
      finished the orphaned slices after the reset and re-delegated the two large
      remainders) and verified on :8896. First landing SHIPPED at /wiring/ (statement,
      THE PLAN ink poster = subscription tier + status + renewal, nine fact rows via new
      /api/wiring/counts: members + integrations + EPR obligation + the three social
      scores + galleries); registry gained landing + /wiring prefix, desk poster flipped,
      the band's Billing tab repointed straight to /settings?tab=billing. SETTINGS: the
      1,124-line monolith cut to 205 (SubscriptionSettings + BillingSettings extracted,
      Stripe handlers verbatim), two-way ?tab= URL sync (back/forward fixed), the dead
      Suppliers placeholder tab DELETED, XeroConnectionCard + TeamSettings deep-cleaned,
      14-file component sweep, breww/unleashed given statements + studio tables. EPR: the
      whole family re-roomed (six THE EVIDENCE eyebrows → THE WIRING), the 17-step wizard
      de-limed (neon-lime/glass/spinners/Badge gone), costs #BF4B2A + RAM dots → tones +
      year-tab URL sync, lib/epr/status-tones.ts dedupes four ladders, redundant hub
      FeatureGate removed, PRN + Audit orphans given hub doors. SOCIAL: a shared
      components/social/ scaffold, three hubs (governance finally gets its eyebrow) + all
      13 detail pages, the four governance detail pages GATED, community ScoreRing +
      gender charts → studio inks, DependenciesMatrix + BoardCompositionChart + the four
      people-culture dashboards converted, the four "Back to Company Vitality" room-hops
      retired. ADMIN: Tier A deep pass (demo-seed, ingest-learning, reference-data,
      recalculate-lca, admin/wiki) + Tier B sweep (~13 partials, beta-access ccff00 ×4
      killed) + Tier C (~9k lines of dev docs/factors/platform/supplier tree) ring-fenced.
      tsc 0, room-wide off-palette grep clean, EPR tests green (4 pre-existing unrelated
      failures), mobile + consoles clean. DEVIATION: the /admin index was dropped (root
      /admin is the distributor panel's, a separate stream). THE HOUSE OF SEVEN ROOMS IS
      COMPLETE.
- [ ] All seven rooms done. Remaining before go-live: retire the neon-* bridge vars,
      the app-icon/favicon brand call, the distributor + procurement portals (their own
      streams), then the go-live pass (merge main, full pnpm build, walk-through, merge
      redesign → main).

## Review log
- 9 July 2026 · Today room deep pass: Tim approved the four plan decisions
  (retire hub customise; kill Pulse Money tab; Customise behind a ghost pill;
  keep spotlight/partnerships/nature merged into "The good work" rows). Tim asked
  that features are never deleted unless repeated or redundant; the room-in-room
  idea resolved to the room-landing pattern (desk grammar inside a room, flat nav).
- 10 July 2026 · Workbench deep pass: Tim approved folding Emissions' Scope 1/2
  tabs, parameterising agriculture, footprint-as-poster; revised decision 2 to
  KEEP the data-sources content as a quiet section ("people rarely use it but
  should see where their data comes from"). Then extended the pass to ALL pages
  in the room for platform consistency. Two removal candidates flagged for Tim,
  nothing deleted: /company/overview (duplicate of /settings?tab=organisation)
  and /data/ingest (legacy manual form, superseded by smart upload, only Rosa
  prompt files reference it).
- 10 July 2026 · Cellar deep pass: Tim approved deleting the dead parallel LCA
  flow WITH a salvage (keep /report's EF3.1 table components), folding the
  wizard's second AI into Rosa, one import door, a recut card grid, and the
  vitality score as the landing poster. Built with 6 parallel agents after
  groundwork. Flagged for Tim: /company/overview + /data/ingest removals still
  pending from the workbench pass; the orphaned /api/lca/[id]/ai-suggestions
  route (dead after the sidebar fold); the wizard step body needs a real-product
  click-through. Side-finding: bulk import may not enforce product-limit gating
  client-side (confirm the API does).
- 10 July 2026 · Evidence deep pass: Tim settled all seven decisions (kill the
  phantom /reports/ front door → redirect; retire /operations → facilities; five
  flat tabs; landing poster = THE PROOF; keep CCF + workbench delineated; quiet the
  certifications monolith in place with "only B Corp and EcoVadis important right
  now"; delete the 6 orphans). Built with five parallel agents after the lead did
  the foundation (landing, /api/evidence/counts, both redirects, registry). All
  verified on :8895. Notes for Tim: (a) the /reports/ and /operations redirects are
  URL-stable (permanent moves wait for the go-live redirect pass); (b) certification
  tabs are now deep-linkable via ?tab= (works in dev; confirm the production build's
  Suspense/dynamic handling at go-live); (c) framework migration of csrd/gri/sbti
  onto CertificationExperience remains a named follow-up; (d) the transition-plan vs
  /pulse/targets two-schema target duplication is de-noised but still a follow-up to
  unify; (e) a stale-cache ENOENT appeared after deleting orphans under the running
  dev server and cleared on restart (not a code fault).
- 10 July 2026 · Network deep pass: Tim settled all seven decisions (retire
  /suppliers/new; one door on the suppliers list; supplier detail → sections;
  landing poster = THE CHAIN; fold in advisor-security; one PartnerProfile
  template; Impact Focus email is .co.uk). Built with six parallel agents after
  the lead did the foundation (registry, /api/network/counts + advisor-unread
  aggregate, the /network landing). All verified on :8895. Notes for Tim:
  (a) /suppliers/new was DELETED, not redirected (the public invite journey
  fully supersedes its token path; also removed the one ungated add path);
  (b) advisor-security touched FOUR directory routes, not six — the other two
  supplier routes use the anon/RLS client (DB is the backstop) and one was
  already compliant; (c) the external supplier-portal components and the now-
  orphaned old detail-tab components remain off-palette (their own pass);
  (d) on orgs with a brand palette the room wears the brand colour, not ochre,
  but the poster/pills still take ink-on-saturated per the room rule.

## Go-live (later)
- [ ] Merge latest `main`, full `pnpm build`, full walk-through
- [ ] Merge `redesign` → `main`, push, Netlify deploys

## Review log
(dated notes from each checkpoint go here)
