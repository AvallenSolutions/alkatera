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

## Go-live (later)
- [ ] Merge latest `main`, full `pnpm build`, full walk-through
- [ ] Merge `redesign` → `main`, push, Netlify deploys

## Review log
(dated notes from each checkpoint go here)
