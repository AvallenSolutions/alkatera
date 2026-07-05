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
- [ ] dev server verified on :8891, logged in, baseline screenshot
- [ ] branch pushed to GitHub as backup

## Milestone 1 · the foundation
- [ ] Tokens: paper/cream/hairline/dim/ink ground + room inks + working tones in globals.css & tailwind.config.ts, radius 6
- [ ] Fonts: add Space Grotesk (statements, big numbers, tabular); Inter body; JetBrains Mono labels; retire Lora/Playfair defaults
- [ ] Dark mode retired on this branch (confirm with Tim at review)
- [ ] Kit of parts in `components/studio/`: pill actions, panel, accent panel, mono tabs, big number, fact row, state chips, stage bar, marks, breathing grid + studio ease + reduced-motion
- [ ] Kit-of-parts gallery page for review on :8891
- [ ] REVIEW CHECKPOINT with Tim

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
