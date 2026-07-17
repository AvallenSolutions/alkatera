# Memory

## Me
Tim Etherington-Judge, Co-Founder at alka**tera**.

## Preferences
- The company name is always written as: alka**tera** (all lowercase, "tera" in bold)
- British English in all writing
- NEVER use em dashes (—) in text copy

## Terms
| Term | Meaning |
|------|---------|
| alka**tera** | The company/platform — always lowercase, "tera" in bold |

→ Full glossary: memory/glossary.md

## Local dev: NEVER point at production

Local development runs against a **local Supabase** (`supabase start` + `supabase db reset`),
never the production project. Production holds real customer data and a service-role key bypasses
RLS entirely, so **no production credentials belong in this workspace** (incl. `.env.local`).
Full setup + the squashed-migrations model: `LOCAL_DEV.md`. To inspect prod, use the Supabase
dashboard with your own login — do not drop a prod service-role key into a dotfile here.

## Background work: ALWAYS use Inngest, never a raw synchronous /api/cron route

For anything that could take more than ~30 seconds — scraping, document
processing, deep-enrich, brand-matching, anything calling an LLM, anything
fanning out across N records — use Inngest. Never reach for a synchronous
`/api/cron` route as the only way a job runs; that pattern has the serverless
function's hard execution ceiling, which has bitten this codebase repeatedly.

- Client: `lib/inngest/client.ts`
- Function registry: `lib/inngest/functions/index.ts` (add new functions here)
- Webhook handler: `app/api/inngest/route.ts` (don't touch unless changing the registry shape)
- Existing functions to crib from: `lib/inngest/functions/{scraping,enrich,documents,matching}.ts`

Pattern:
1. Define the event shape in `AlkateraEvents` in `client.ts`.
2. Create the function in `lib/inngest/functions/<feature>.ts` using `inngest.createFunction({...}, async ({ event, step }) => { ... })`. Wrap each I/O step in `step.run` so retries happen at step granularity.
3. Register it in `lib/inngest/functions/index.ts`.
4. Dispatch from an event trigger (API route, admin button, another function) and/or a native Inngest cron trigger.

**Scheduling is Inngest native crons, not a platform-level scheduler.** Give
the function a `triggers` array with both an event and a `cron:` entry (see
`lib/inngest/functions/dns-health.ts`), e.g.
`triggers: [{ event: 'growth/stall.check' }, { cron: '0 8 * * 1' }]`. This
runs the same function on a schedule and on demand, and it's host-agnostic —
no Netlify Scheduled Functions, no Vercel Cron Jobs config, nothing tied to
where the app happens to be deployed. If a route's logic needs both a manual
trigger (an admin button, a `/api/cron/*` fallback) and a schedule, extract
the logic into a `lib/` function and call it from both the route and the
Inngest function's `step.run` — never duplicate the business logic itself.

Required env vars: `INNGEST_EVENT_KEY` (send) + `INNGEST_SIGNING_KEY` (incoming webhook). Both no-op gracefully when missing.
