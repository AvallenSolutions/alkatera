# World-class onboarding and support for the alkatera redesign

**Worktree:** `/Users/timej/Documents/GitHub/alkatera/.claude/worktrees/redesign` (branch `redesign`, never main)
**Session scope:** approve plan, then build phases in order until the Fable budget runs out, committing each phase as it completes. A copy of this plan lands in the worktree at `tasks/onboarding-support-plan.md` so later sessions can continue.

## Context

alka**tera** asks users for a huge amount of data. The redesign (house of rooms, growth field, Rosa) gives us the raw material for onboarding that feels like moving into a studio rather than filling in a government form. The goals:

1. **Never an empty platform** — real starter data from the fast-track website scrape and instant estimate; the growth field means even a day-one org has a living view.
2. **Segmented by room and page** — setup is chunked to where the user is standing, never a wall of asks.
3. **Support that deflects** — Rosa plus the wiki resolve questions in place so direct support contact approaches zero.

Decisions already made with Tim: real starter data only (no example/demo records); the full-screen wizard shrinks to a short arrival ritual; everything else moves into the rooms.

## Psychology the design is built on

Each principle maps to a concrete mechanism, not a vibe:

| Principle | Mechanism |
|---|---|
| Endowed progress | Website scrape + instant estimate mean the forest is already sprouting at first desk visit; checklists start partially complete, never at zero |
| Progressive disclosure | Setup chunked per room; a room only asks for its own data; the desk shows at most 3 priorities |
| Goal gradient | Per-room checklists show "2 of 5" style progress; the forest score pill makes the remaining distance visible and small |
| Zeigarnik effect (open loops) | Resume banner, per-room "one thing left here" hints, Rosa desk priorities re-open unfinished bands |
| Labour illusion | The website-scrape reveal step (already exists as `fast-track-reveal`) shows work being done on the user's behalf |
| Peak-end rule | Arrival ends on the instant estimate + "your forest has started"; each band completion gets a one-time forest moment |
| Self-determination (autonomy/competence/relatedness) | Persona question personalises room order; checklists confer visible competence; Rosa (the goldendoodle, never "AI") is the relatedness anchor |
| Cognitive load | One primary action per screen in arrival; hairline checklists, not modals; room intros are inline statements, not overlay tours |

Copy rules throughout: British English, no em dashes, plain language (users are not sustainability experts), Rosa never described as AI, statements end with full stops.

## Architecture: three layers + lifecycle

The **growth score** (`lib/desk/growth-score.ts`, six bands: foundations, production, measurement, network, evidence, stewardship) is the single source of truth. Room checklists, desk priorities and the forest all read the same signals, so they can never disagree.

Band → room mapping: foundations → wiring/arrival · production → workbench + cellar · measurement → workbench · network → network · evidence → evidence · stewardship → evidence/wiring.

---

## Phase 1 — The arrival ritual (build first)

Shrink onboarding to a 5-screen full-screen ritual in studio language, landing on a never-empty desk.

**Steps** (new `arrival` flow, or a reshaped `fast_track`): 
1. **Welcome** — studio `Statement` voice, one sentence on what alka**tera** does, one button.
2. **Persona** — "What do you do here?" (operator / finance / leadership / sustainability). Writes the `rosa_memory` persona key that `lib/rosa/useUserRole.ts` already reads but nothing sets (closes the parked item in `tasks/rosa-handoff.md`). Desk order re-weights immediately via `deskOrderForPersona`.
3. **Company basics** — name, sector, country, website. One screen.
4. **Website reveal** — keep the existing scrape/labour-illusion step (`fast-track-reveal`, already on redesign but not main), restyled.
5. **Instant estimate + forest** — the estimate plus "your forest has started" moment, then straight to `/desk/` with the growth-field replay firing.

**Changes:**
- `lib/onboarding/types.ts` — define `ARRIVAL_STEPS` (5 steps); retire the 14-step owner flow for fresh users (it already only serves in-flight rows).
- `app/api/onboarding/route.ts` — fresh owners get the arrival flow.
- `components/onboarding/OnboardingWizard.tsx` + new/reworked step components — restyle with the studio kit (`Panel`, `Statement`, `Eyebrow`, `PillButton`, room colours). Reuse the existing fast-track step internals (scrape, estimate) rather than rewriting them.
- **Never-empty desk:** `components/studio/desk-priorities.tsx` — when the growth score is low, Rosa's priorities become setup actions derived from the weakest bands (e.g. "Add your first facility in the workbench."), each deep-linking into a room. No new API: extend `/api/desk/counts` or `/api/growth` payload with per-signal booleans (also needed by Phase 2).
- Member/advisor flows: keep the existing 6/4-step flows, restyle only (lower priority, can slip to Phase 2).

No DB migration: `onboarding_state.state` is jsonb, per-user-per-org.

## Phase 2 — Room-segmented onboarding

**Room setup checklists.** New `components/studio/room-setup-panel.tsx` extending the proven `PulseSetupChecklist` / `EmissionsGuide` hairline-fact-row pattern. Config registry `lib/onboarding/room-guides.ts`: per room, 3-5 items `{id, label, href, doneWhen}` where `doneWhen` keys into the growth-score signals returned by the API. Shown at the top of each room landing while incomplete; auto-fades once the room's band is healthy; dismissible per room.

**First-visit room intros.** One-time inline statement block (not a modal) at the top of a room landing on first entry: what the room is for in one sentence, the checklist, and "Ask Rosa about this room" (seeds the drawer via `askRosa()`). Tracked in `onboarding_state.state.rooms.{room}.introSeen`.

**Coachmark primitive.** One small studio-styled `components/studio/coachmark.tsx` (anchored hairline callout, dismiss stored in `onboarding_state`) to replace the six hand-rolled guide variants over time. Converge, don't rewrite: existing guides (`EmissionsGuide`, `ProductGuide`, etc.) keep working; new pages use the primitive.

## Phase 3 — The support spine (Rosa + wiki)

Goal: a user's first, second and third recourse are all in-app.

**Per-route help registry.** `lib/support/help-map.ts`: route prefix → `{summary, wikiSlugs[], rosaPrompt}`. Surfaced as a quiet "?" affordance in `components/studio/room-band.tsx` (BandControls) opening a small panel: one-sentence "what this page is", 2-3 wiki links, and "Ask Rosa" pre-seeded with the page prompt. This fixes the currently-thin wiki deep-linking (only knowledge-bank links to `/wiki/` today).

**Rosa support tools** (extend `lib/rosa/tools.ts`, register in the chat route's system prompt):
- `get_setup_next_steps` — reads the growth signals; lets Rosa answer "what should I do next?" identically to the checklists.
- `explain_this_page` — leans on the existing `page_context` slices; mostly a prompt-engineering task plus making sure every room landing registers a context slice via `RosaContextProvider`.
- `propose_support_ticket` — the escalation valve, an action tool (propose-then-confirm like the existing `ACTION_TOOL_NAMES`). Rosa must attempt resolution (wiki search, page context) first; the proposal card files into the existing Network-room feedback/messages infra with the conversation transcript attached, so human support starts with full context.
- System-prompt update: always cite the wiki (`source_url` → `/wiki/<slug>`) when answering how-to questions; offer the ticket only after an attempted answer.

**Wiki search.** Lightweight full-text search endpoint built on `lib/wiki.ts` (pages are read at request time already) + a search box in `components/wiki/WikiMapClient.tsx` and in the "?" panel. No new infra; simple in-memory index per request or module-cached.

## Phase 4 — Lifecycle, nudges and measurement

- **Stalled-band nudges** via the existing `useRosaNudges` path: a band unchanged for N days surfaces one gentle desk priority (never more than one nudge at a time).
- **Band-completion moments**: one-time celebratory statement when a growth band crosses its threshold (the forest already grows; add the acknowledgement).
- **Measurement**: extend `onboarding_step_events` telemetry to room-checklist events; track Rosa conversations that used support tools vs tickets filed (the support-deflection number); surface both in the existing `admin/platform` OnboardingFunnelSection.

## Files most touched

`lib/onboarding/types.ts` · `app/api/onboarding/route.ts` · `components/onboarding/*` · `components/studio/desk-priorities.tsx` · `lib/desk/growth-score.ts` + its API route · new `lib/onboarding/room-guides.ts`, `components/studio/room-setup-panel.tsx`, `components/studio/coachmark.tsx`, `lib/support/help-map.ts` · `lib/rosa/tools.ts` + `app/api/rosa/chat/route.ts` · `components/studio/room-band.tsx` · `lib/wiki.ts` + `components/wiki/WikiMapClient.tsx`.

No DB migrations expected (jsonb state; tickets reuse existing feedback tables). If a migration does become necessary, post the SQL in chat per house rules.

## Verification

- Dev server: `preview_start` with the redesign config (port 8891), fresh test org path: sign up → arrival ritual → land on desk, confirm forest sprouting, persona-ordered rooms, Rosa priorities showing setup actions.
- Enter each room first time → intro + checklist appear; complete an item → checklist and forest score both move.
- Ask Rosa "what should I do next?" and "how do I add a product?" → grounded answers citing the wiki; ask something unanswerable → ticket proposal card.
- `node wiki/lint.js` after any wiki edits; scoped vitest for touched libs; commit per phase on `redesign`.
