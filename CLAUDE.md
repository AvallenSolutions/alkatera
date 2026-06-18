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

## Background work: ALWAYS use Inngest, never raw Netlify Schedule

For anything that could take more than ~30 seconds — scraping, document
processing, deep-enrich, brand-matching, anything calling an LLM, anything
fanning out across N records — use Inngest. Never reach for a raw Netlify
Schedule function with a synchronous /api/cron route, that pattern has the
300s ceiling that has bitten this codebase repeatedly.

- Client: `lib/inngest/client.ts`
- Function registry: `lib/inngest/functions/index.ts` (add new functions here)
- Webhook handler: `app/api/inngest/route.ts` (don't touch unless changing the registry shape)
- Existing functions to crib from: `lib/inngest/functions/{scraping,enrich,documents,matching}.ts`

Pattern:
1. Define the event shape in `AlkateraEvents` in `client.ts`.
2. Create the function in `lib/inngest/functions/<feature>.ts` using `inngest.createFunction({...}, async ({ event, step }) => { ... })`. Wrap each I/O step in `step.run` so retries happen at step granularity.
3. Register it in `lib/inngest/functions/index.ts`.
4. Dispatch from a Netlify Schedule fn (heartbeat only, just one `inngest.send` call) or an API route or an admin button.

Required Netlify env vars: `INNGEST_EVENT_KEY` (send) + `INNGEST_SIGNING_KEY` (incoming webhook). Both no-op gracefully when missing.
