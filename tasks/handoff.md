# Handoff: marketing site cleanup — remove the old pages, keep only the new
Updated: 2026-07-23 17:10 | Branch: claude/marketing-site-home-4e7551 (pushed to origin, NOT merged to main) | Worktree: `.claude/worktrees/tasks-handoff-continue-dece9a` | Dev port: 8893 (launch.json entry "dev-marketing" already exists locally, uncommitted)

## Goal
The "Gallery of Rooms" marketing site (from Claude Design project `fc7cf965-739e-46ed-93e5-fcd682adaa52`, read via the DesignSync tool) is fully built on this branch: Home, Platform, Pricing, Knowledge (+ restyled /blog/[slug]) and Login, all sharing one chrome in `marketing/shared/`. The old marketing site still coexists beside it. This session removes every old marketing page and component so ONLY the new design remains, redirecting retired routes and restyling the handful of small pages the new footers still link to. Full build log: `tasks/marketing-home-plan.md`.

## Done (verified) — previous sessions
- New pages live at /, /platform, /pricing, /knowledge, /blog/[slug], /login. All browser-verified; typecheck clean; login exercises real Supabase auth. Commits `ba3d438d`..`5755d610`.
- Shared chrome: `marketing/shared/{chrome.tsx,effects.tsx,marketing.css,fonts.ts,MarketingButton.tsx}`. Forest engine at `components/studio/growth/` (15 unit tests pass).
- Separately, on the REDESIGN branch (not this one): onboarding consolidated into the arrival ritual; /create-organization deleted there. Do not touch redesign from this session.

## In flight
Nothing mid-edit. Working tree clean except an uncommitted `.claude/launch.json` (local dev convenience — never commit it).

## Next
1. **Delete the dead old clients** (verified unreferenced): `marketing/components/{HomePageClient,PlatformPageClient,KnowledgePageClient,ContactModal,Logo}.tsx` and the whole `marketing/components/landing/` folder (only HomePageClient used it — re-verify imports before deleting).
2. **Retire the old funnel**: `app/getaccess/` (page, layout, signup, canopy) is superseded by /pricing + the trial flow. Check what links to /getaccess (grep app, emails/templates, `lib/`) before deciding: redirect `/getaccess` → `/pricing` in `next.config` `redirects()` (permanent), and `/getaccess/signup` → `/signup`. The canopy page calls the create-organization edge function — read it before deleting; if the Stripe/canopy contact flow is still wanted, fold it into /pricing's Contact Sales instead.
3. **Redirect retired pages** in `next.config` `redirects()` (house rule: redirects live there, not in-page): `/manifesto` → `/#manifesto` (the design has NO manifesto page — soil section on Home is the manifesto), `/impact` → `/` (or keep — see 5).
4. **Restyle the still-linked small pages** onto `marketing/shared` chrome (SiteNav/SiteFooter/marketing.css, same pattern as /blog/[slug]): `/contact` (real form + API — keep logic), `/terms`, `/privacy`, `/cookies` (all linked from every new footer), `/best-sustainability-platform-drinks-industry` (Buyer's Guide — linked from new footers; keep `buyers-guide-data.ts`), `/demo` (CalDAV booking page — keep the booking machinery verbatim, reskin only).
5. **Decide with a look, not assumption**: `/impact` and `/supplier-one-pager` — read them; if still wanted, restyle; if not, redirect/delete. `platform-faq-data.ts` is superseded by `marketing/platform/faq-data.ts` — delete once BuyersGuide etc. don't import it. `WikiMapClient` is used by the AUTHENTICATED wiki page — leave it and `/signup` (AuthForm) alone.
6. **Sweep the seams**: `app/sitemap.ts` still lists /manifesto and /impact — update to the surviving set; `app/robots.ts`; grep the whole repo for `marketing/components/` imports until zero (outside signup/wiki exceptions); grep for links to retired routes (`/manifesto`, `/getaccess`) in app code, `lib/`, email templates.
7. **Verify**: `pnpm typecheck`; scoped vitest if touched; browser-walk every public route on :8893 (`preview_start "dev-marketing"`) incl. the redirects; check no route still renders the dark `#ccff00` theme (grep `ccff00` under `app/` + `marketing/` is a good smoke test — expect hits only in authenticated app surfaces).
8. Commit on THIS branch, push the branch (never main). Append the outcome to `tasks/marketing-home-plan.md`.

## Gotchas and decisions
- Copy rules: British English, no em dashes, alka**tera** wordmark styling; design rules in the Claude Design project's CLAUDE.md (no tickers; never demo score-growth on marketing; forests unmasked).
- The browser pane quirks (recorded in memory): CDP clicks/keys don't reach React — use form_input, JS `el.click()`/`requestSubmit()`; screenshots lag a frame (take two); smooth-scroll freezes — use `behavior:'instant'`.
- Committed files must only import TRACKED files (Netlify breaks otherwise) — check `git status` before committing after deletions.
- The Home newsletter, Knowledge newsletter and Pricing trial forms are client-side only (design parity); wiring real endpoints is a separate, still-open task — don't block cleanup on it.
- `/blog` already 308s to /knowledge? No — that redirect exists on REDESIGN only. If old `/blog` index exists here, check it (app/blog has only [slug]).
- app/page.tsx keeps the server-side auth redirect (signed-in users → /rosa/) — preserve it.

## Pending Tim actions
- None for this task. (Standing items from other workstreams live in memory and `tasks/marketing-home-plan.md`.)
