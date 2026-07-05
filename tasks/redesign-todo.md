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
- [ ] Room mapping proposal for the SaaS (workshop with Tim before building)
- [ ] The desk (home grid of breathing poster blocks)
- [ ] The room band (52px sticky, colour per room, mono tabs, live note)
- [ ] The ink band (Rosa as "Ask the studio": ring, prompt pill, cmd-K, quick capture)
- [ ] Replaces sidebar AppLayout on this branch
- [ ] REVIEW CHECKPOINT with Tim

## Milestone 3+ · room by room (review each before the next)
- [ ] Dashboard / pulse
- [ ] Products + LCA
- [ ] Reports / certifications / passports
- [ ] Settings (the wiring)
- [ ] Rosa surfaces
- [ ] Distributor portal (align with generalised studio language)
- [ ] Procurement portal (respect tenant whitelabel injection)
- [ ] Public pages (landing, wiki, public menus/labels)

## Go-live (later)
- [ ] Merge latest `main`, full `pnpm build`, full walk-through
- [ ] Merge `redesign` → `main`, push, Netlify deploys

## Review log
(dated notes from each checkpoint go here)
