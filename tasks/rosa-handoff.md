# Rosa Session Handoff

**Last touched:** 2026-05-09. **Branch:** `claude/nice-buck-b9690f` (worktree at `.claude/worktrees/nice-buck-b9690f/`).

## Where we are

Rosa has been transformed from a chat assistant in WORKSPACE into the platform's primary surface. She lives as a right-side drawer mounted in `AppLayout` (available on every authenticated page, ⌘ / opens it) PLUS a hub page at `/rosa/` that's now the post-login landing. The drawer carries page-aware structured context, real propose-then-confirm action tools, persistent conversations, and rich inline outputs (charts, action cards, downloads). The hub has a mood-aware hero, opinionated priority tiles, role-aware Ask Rosa starters, a 14-day forward timeline, and full live updates via Supabase realtime. The dashboard at `/dashboard/` redirects to `/rosa/`.

## What's built (architecture map)

**Drawer + provider** — [components/rosa/RosaDrawer.tsx](components/rosa/RosaDrawer.tsx), [components/rosa/RosaTrigger.tsx](components/rosa/RosaTrigger.tsx), [lib/rosa/RosaContextProvider.tsx](lib/rosa/RosaContextProvider.tsx). Provider holds open/pin/width state, page slices, `selectedEntity`, `pendingPrompt`, `pendingConversationId`. Drawer mounted in [components/layouts/AppLayout.tsx](components/layouts/AppLayout.tsx) so all auth'd pages get it.

**Conversation engine** — [components/rosa/RosaConversation.tsx](components/rosa/RosaConversation.tsx), [lib/rosa/useRosaConversation.ts](lib/rosa/useRosaConversation.ts). Captures `text` / `chart` / `action_proposal` / `tool_result` events from the chat stream. Auto-resumes most-recent thread on mount (24h window). Renders charts (lazy `GaiaChartRenderer`), `ActionProposalCard`s, and download chips inline. Markdown tokenizer handles images, links (incl. relative URLs), bold, italic.

**Tool framework** — [lib/rosa/tools.ts](lib/rosa/tools.ts), [lib/rosa/actions.ts](lib/rosa/actions.ts). 25 read tools + 9 propose tools (`propose_log_utility_entry`, `_set_target`, `_add_supplier`, `_approve_exception`, `_reject_exception`, `_match_emission_factor`, `_apply_proxy`, `_create_lca_draft`, `_dismiss_anomaly`) + 1 export tool (`generate_export`). Every write goes through `propose_*` → `rosa_pending_actions` → `ActionProposalCard` Confirm → `executeAction()`. Backend chat: [app/api/rosa/chat/route.ts](app/api/rosa/chat/route.ts).

**Page context** — [lib/rosa/RosaContextProvider.tsx](lib/rosa/RosaContextProvider.tsx) `useRosaPageContext({...})`. Wired on: recipe editor, facility detail, products list, compliance wizard, supplier detail, scope-1-2, spend-data, reports, EPR. AskRosaButton ([components/rosa/AskRosaButton.tsx](components/rosa/AskRosaButton.tsx)) placed on unmatched ingredient rows. Pattern documented in the provider's JSDoc.

**Live updates** — [lib/rosa/useRealtimeRefresh.ts](lib/rosa/useRealtimeRefresh.ts) subscribes to Supabase realtime per table+org and triggers refresh callbacks. Wired across PriorityTiles, ActivityPulse, RecentlyFromRosa, RecentConversations, ProductSpotlight, useRosaNudges, HeroGreeting.

**Hub composition** — [components/rosa/ForYouToday.tsx](components/rosa/ForYouToday.tsx) layout. Top to bottom: HeroGreeting (mood-aware), PriorityTiles (opinionated + snoozable), ActivityPulse + ForwardTimeline (left col-8) | ProductSpotlight (right col-4) with `items-start`, QuickPrompts (role-aware) | QuickActions, RecentlyFromRosa | RecentConversations.

**Persona** — [lib/rosa/useUserRole.ts](lib/rosa/useUserRole.ts) returns `leadership`/`finance`/`sustainability`/`operator`/`unknown`. Reads stated persona from `rosa_memory` first, falls back to `organization_members.role`. Currently powers QuickPrompts only; ready to extend.

**Endpoints** — `/api/rosa/chat`, `/api/rosa/briefing`, `/api/rosa/mood`, `/api/rosa/conversations/recent`, `/api/rosa/exports`, `/api/ingest/email`, `/api/agents/exceptions[/[id]][/save-facility-bill]`, `/api/agents/footprint/run`.

## Operational gotchas

- **Migration to apply:** [supabase/migrations/20262605700000_agent_exceptions.sql](supabase/migrations/20262605700000_agent_exceptions.sql) creates `agent_exceptions` table + adds `managed_footprint_enabled`, `agent_inbox_address` to `organizations`. Posted to Tim during the build. Run in Supabase SQL editor before testing the Footprint Agent on a fresh org.
- **Env vars on Netlify:** `INGEST_EMAIL_WEBHOOK_SECRET` (also in local `.env.local`). `CRON_SECRET` reused for the daily run.
- **Dev server:** port 8888. Symlink the main repo's `.env.local` if running in a fresh worktree. The pre-existing OpenLCA cert errors in the dev logs are unrelated infra noise (cert expired upstream).
- **Pulse page** is server-rendered so it gets the auto URL slice only, not a rich `useRosaPageContext` slice. To enrich, slot a hook call into `PulseShell` (a client component).

## What's parked / open

- **Mobile drawer** — works as overlay but not redesigned as a bottom sheet. Plan called this out as Phase E polish.
- **LLM-written mood summary** — currently template-based in `/api/rosa/mood`. Upgrade to Claude-written narrative when richer prose is wanted.
- **Persona onboarding** — `useUserRole` reads `rosa_memory` key='persona' but nothing sets it yet. Add a one-time prompt ("are you ops, finance, leadership?") that stores the answer.
- **More page-context wiring** — supplier portal ESG, regulatory exposure widget, sustainability targets, board pack, Pulse insights cards. Pattern documented; just grunt work.
- **Conversation history deep-link by id** — `RecentConversations` clicks already deep-link via `resumeConversation(id)`. The drawer's history dropdown also deep-links. The "Recent conversations" hub card does too. Working.
- **Customisation** — Tim raised this; agreed approach is opinionated default + role-aware tilt + light-touch hide/show edges. Not yet built.
- **Email-out by Rosa** — explicitly out of scope per Tim's lock-in. Don't add `propose_send_email` or any tool that triggers outbound mail.

## Locked preferences (don't drift)

- **No em dashes** in user-facing copy.
- **Rosa's self-description**: only "Rosa" or "your sustainability partner". NEVER "AI", "AI assistant", "AI agent", "chatbot", "language model", "digital assistant", or "sustainability guide".
- **No writes without confirm**: every action tool must follow propose-confirm. No exceptions.
- **No emails by Rosa**: explicitly forbidden.
- **British English** throughout.
- **alka**tera** lowercase with "tera" in bold** when naming the platform.
- **Push to main** for alkatera commits, not feature branches.

## Key entry points to read first

1. [tasks/rosa-handoff.md](tasks/rosa-handoff.md) — this file
2. [components/rosa/RosaDrawer.tsx](components/rosa/RosaDrawer.tsx) — the drawer chrome
3. [lib/rosa/RosaContextProvider.tsx](lib/rosa/RosaContextProvider.tsx) — provider with all the hooks documented in JSDoc
4. [lib/rosa/tools.ts](lib/rosa/tools.ts) — tool catalogue + `executeTool` dispatcher
5. [lib/rosa/actions.ts](lib/rosa/actions.ts) — write dispatchers behind the propose-confirm flow
6. [components/rosa/ForYouToday.tsx](components/rosa/ForYouToday.tsx) — hub composition

## Recent context this session worked through

- Built the drawer + 9 propose tools + 9 page-context wirings + AskRosaButton on unmatched ingredients
- Built mood hero, opinionated priority tiles with Rosa-voiced recommendations + snooze, role-aware Ask Rosa starters, 14-day forward timeline, live updates everywhere
- Fixed: Activity Pulse bars (height 0 collapse), Recent Conversations card not navigating, ForwardTimeline overlapping next grid (added `items-start`)
- Restored Rosa's rescue-dog persona + photo response after the persona was missing from the inline system prompt

## How to start the next session

Open the worktree, run `pnpm dev --port 8888`, log in to alkatera Demo. Test plan: hub at `/rosa/` should show mood hero with sparkline; tiles should show Rosa-voiced recommendations; click an Ask Rosa prompt to verify it streams in the drawer; ⌘ / to open the drawer from any page; on `/products/<id>/` click "Ask Rosa about this" next to an unmatched ingredient and confirm she responds with the ingredient's name.

Pick up wherever Tim signals next. Common likely next moves:
- Build the persona-onboarding prompt that writes to `rosa_memory`
- Extend page-context wiring to remaining priority pages
- Polish mobile drawer behaviour
- Wire customisation (hide/show + reorder of hub cards)
- Integrate the Footprint Agent's Phase 2 (Supply-Chain Agent — chase emails are still parked per the no-email rule, so the supply-chain agent ingests inbound but never sends out)
