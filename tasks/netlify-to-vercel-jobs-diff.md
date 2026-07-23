# Scheduled + background jobs: main (Netlify) → redesign (Vercel)
Produced: 2026-07-21 | Method: static diff of `main` against `redesign` at their current tips. No Vercel or Inngest API access was needed or used.

## Headline: the previous handoff's alarm was wrong, and the real risk is the opposite one

The 2026-07-19 handoff said "15 of main's Netlify functions have no equivalent... if nothing
kicks Inngest on Vercel, all of it stops SILENTLY". That is not what the code says.

**Every scheduled job on main has an equivalent on redesign, and redesign schedules them
itself.** Redesign moved every heartbeat from Netlify into the Inngest function definition as a
native `{ cron: ... }` trigger. `vercel.json` having no `crons` key is correct and deliberate,
not an omission. Nothing needs to be added to `vercel.json`.

The genuine risk is the inverse, and it is worse. See "The real risk" below.

## Coverage table

Main schedules the same work through two mechanisms at once: `netlify.toml` `[functions."app/api/cron/<x>/route"]` entries, and standalone `netlify/functions/*.ts` that call `schedule()`. Both columns are folded in below.

| Work | main schedule | redesign equivalent | redesign trigger | Status |
|---|---|---|---|---|
| alkatera sync queue | `*/1 * * * *` | `alkateraSyncQueueTick` | `cron */1 * * * *` | ✅ identical |
| Scraping queue | `*/2` (toml), `*/5` (fn) | `scrapingQueueTick` | `cron */2 * * * *` | ✅ takes the faster of the two |
| Document queue | `*/2 * * * *` | `documentsQueueTick` | `cron */2 * * * *` | ✅ identical |
| Distributor reminders | `0 9 * * *` | `distributorReminderSweep` | `cron 0 9 * * *` | ✅ identical |
| Brand matching sweep | `0 3 * * *` | `matchingSweepRun` | `cron 0 3 * * *` | ✅ identical |
| Purge greenwash scans | `0 4 * * *` | `retentionPurgeSweep` | `cron 0 4 * * *` | ✅ merged (see note) |
| Purge stale invitations | `30 4 * * *` | `retentionPurgeSweep` | same function | ✅ merged (see note) |
| Pulse snapshots | `0 2 * * *` | `pulseGenerateSnapshots` | `cron 0 2 * * *` | ✅ identical |
| Pulse insights | `0 6 * * *` | `pulseGenerateInsights` | `cron 0 6 * * *` | ✅ identical |
| Pulse anomalies | `0 *` (toml), `15 *` (fn) | `pulseDetectAnomalies` | `cron 0 * * * *` | ✅ on the hour |
| Grid carbon | `*/30 * * * *` | `pulseRefreshGridCarbon` | `cron */30 * * * *` | ✅ identical |
| Shadow prices | `0 8 1 1,4,7,10 *` | `pulseRefreshShadowPrices` | same expression | ✅ identical |
| OpenLCA cert monitor | `0 8 * * *` | `openlcaCertMonitor` | `cron 0 8 * * *` | ✅ identical |
| Trial reminder sweep | `0 9 * * *` | `trialReminderSweep` | `cron 0 9 * * *` | ✅ identical |
| DNS health monitor | `cron 23 * * * *` (already Inngest-native on main) | `dnsHealthMonitor` | same | ✅ unchanged |
| Wiki → Rosa sync | on deploy-success (`deploy-succeeded.ts`) | `wikiSyncTick` | `cron 0 */6 * * *` | ⚠️ behaviour change |

Merged purges: `retention.ts` states the split into 04:00/04:30 existed only to stop two Netlify
invocations overlapping. On Inngest both deletes run in one function. Deliberate, documented.

Wiki sync: on main it fires once per successful production deploy. On redesign it fires every
six hours regardless of deploys. Freshness after a wiki edit therefore goes from minutes to up
to six hours. That is the only behavioural regression in the whole table, and it is small.

## Background (on-demand, never scheduled) functions

All seven of main's `*-background.ts` Netlify functions have Inngest ports on redesign, several
of which say so in their header comments:

| main | redesign |
|---|---|
| `deep-enrich-background` | `enrichBrandRun` |
| `directory-sourcing-background` | `directorySourcingRun` |
| `find-websites-background` | `findWebsitesRun` |
| `import-from-url-background` | `importFromUrlRun` |
| `ingest-auto-background` | `ingestAutoRun` |
| `process-sku-import-background` | `skuImportRun` |
| `scrape-brand-background` | `scrapingBrandRun` |

## Jobs redesign gains that main does not have

`emailIntakePoll` (`*/10`, dormant pending the kSuite mailbox), `growthStallSweep` (`0 8 * * 1`),
`rosaLearningSweep` (`0 9 * * 1`). These start firing the moment redesign syncs to Inngest. The
email one is the one to watch: confirm it no-ops cleanly without mailbox env vars before cutover.

## Pre-existing gap, unchanged by the cutover

`/api/cron/xero-sync` is the only sender of `xero/sync.tick`, and it is **not** in `netlify.toml`
and has no cron trigger on either branch. Xero sync has therefore never run on a schedule on
main, and still will not on redesign. Not a cutover regression, but worth knowing before someone
reports Xero data as stale.

## The real risk: one Inngest app id, two deployments

Both branches construct the client as `new Inngest({ id: 'alkatera' })`. Inngest identifies an
app by that id within an environment. If the Vercel staging deployment is given the **production**
`INNGEST_SIGNING_KEY` / `INNGEST_EVENT_KEY`, Inngest sees a second sync of app `alkatera` in the
production environment and re-points every registered function URL at the Vercel staging
deployment. Production's background jobs would then execute on staging code against whatever
Supabase project staging is pointed at, while the Netlify site keeps serving customers and
appears healthy. Nothing errors. Nothing warns.

Compounding it: redesign's functions carry cron triggers and main's mostly do not, so the
overwrite also switches the scheduling authority from Netlify to Inngest in one step.

### Mitigation, in order
1. Give the Vercel staging project an Inngest **Branch/staging environment** key pair, never the
   production keys. This is the whole fix — Inngest environments are isolated, so a same-id app
   in a different environment cannot touch production's registration.
2. Before cutover, verify in the Inngest dashboard which environment `alkatera` is synced to and
   what URL its functions resolve to. One look confirms or refutes the whole hazard.
3. At actual cutover, remove the Netlify site's Inngest keys in the same change that gives Vercel
   the production pair, so only one deployment ever holds them.
4. Consider making the app id environment-derived (`alkatera-staging` off a Vercel env var) so
   the collision is structurally impossible rather than operationally avoided. Cheap, and it
   removes a foot-gun that will otherwise outlive this cutover.

## What this means for the cutover plan

Item 2 of the handoff's Next list ("the netlify → vercel scheduled-jobs diff") is done and its
premise was false: there is no job loss to remediate. Replace it with the Inngest environment
check above, which is a dashboard look plus an env var decision rather than a build task.

The parametric-packaging gap (handoff Gotchas) remains the biggest cutover risk. This finding
does not change that ranking; it removes a phantom risk and adds a real one of similar size.
