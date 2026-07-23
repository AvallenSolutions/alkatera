# Phase 0 setup checklist (The First Hour)

Everything here is Tim-side (Stripe dashboard, Vercel env, an API key). It unblocks the
staging E2E that the whole build regresses against. Grounded in the actual redesign code
(`app/api/stripe/webhooks/route.ts`, `create-checkout-session/route.ts`, `lib/stripe-config.ts`).

## 0.1 · Create the Stripe TEST-mode webhook (answers "how do I get the info from Stripe")

1. Sign in to the Stripe Dashboard.
2. **Flip to Test mode** — the toggle top-right must read "Test mode". Everything below must
   be done in Test mode, not Live.
3. Left nav → **Developers → Webhooks → Add endpoint** (or "Add an event destination").
4. **Endpoint URL:** `https://alkatera-staging.vercel.app/api/stripe/webhooks`
5. **Select events to send** — add exactly these five (the only ones our handler processes):
   - `checkout.session.completed`   ← this is the one that records the trial
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
   - `invoice.payment_succeeded`
6. Click **Add endpoint**.
7. On the new endpoint's page, find **Signing secret** → **Reveal**. It looks like `whsec_...`.
   **That string is the value of `STRIPE_WEBHOOK_SECRET`.** Copy it.

Also grab your **Test-mode API keys**: Developers → API keys →
- **Secret key** `sk_test_...`  → `STRIPE_SECRET_KEY`
- **Publishable key** `pk_test_...` → `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

## 0.1b · Put those into Vercel (staging), NOT production

On the Vercel project that serves `alkatera-staging.vercel.app`, in the environment that
deployment uses, set / confirm:

Chosen approach: **Option A** — same variable names, staging-scoped test values (live keys
untouched). The code reads `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` /
`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` verbatim, so staging just holds the test values under
those exact names.

| Variable | Value | Status |
|---|---|---|
| `STRIPE_SECRET_KEY` | your `sk_test_...` | ✅ done (updated on staging, `_TEST` removed) |
| `STRIPE_WEBHOOK_SECRET` | the `whsec_...` from step 7 | ⬜ needs the test-mode endpoint's secret |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | your `pk_test_...` | ⬜ set to the test value on staging |
| `NEXT_PUBLIC_SITE_URL` | `https://alkatera-staging.vercel.app` | ⬜ confirm |
| `SUPABASE_SERVICE_ROLE_KEY` | (the webhook writes with it) | ⬜ confirm already set |

⚠️ **Do not put test keys on the real `alkatera.com` production project.** Keep test keys on
staging only. Redeploy staging after setting them.

Local alternative (for developing on :8891 without the deployed webhook): run
`stripe listen --forward-to localhost:8891/api/stripe/webhooks` — the CLI prints its own
`whsec_...` to use as `STRIPE_WEBHOOK_SECRET` in `.env.local`.

## Two gotchas I found in the code (real, worth knowing before 0.2)

1. **Tier price IDs are hardcoded live IDs** in `lib/stripe-config.ts` (e.g.
   `price_1SjQkL...`), not env-driven. The **trial** path uses setup mode and never sends a
   price to Stripe, so it works fine in Test mode as-is — good, because Phase 0 tests the
   trial. But testing an actual **paid** subscription conversion in Test mode would fail
   until test-mode price IDs are swapped in. Out of scope for Phase 0; note it for later.
2. **The idempotency table must exist on the staging Supabase.** The webhook writes to
   `stripe_webhook_events` (migration `20262703900000`). If it's missing, the handler logs
   and proceeds (won't crash), but confirm it's applied on alkatera-staging so idempotency
   actually works. Same for the trial tier-limits row.

## 0.2 · Baseline cold-signup recording (after 0.1 deploys)

One true cold signup on staging with a Stripe **test card** (`4242 4242 4242 4242`, any
future expiry, any CVC), recorded end to end: signup → arrival ritual → checkout → return →
desk. This is the "before" film; it will expose the webhook-lag bounce and any DeskWelcome
timing issues before we change the flow. I can drive/observe the browser side with you once
staging has the keys (you enter the credentials; I don't handle passwords).

## 0.3 · Decisions (I'm proceeding on the recommended default for each; all reversible)

1. Companies House **UK-only** at launch → **building UK-only**; EU registries later.
2. Walk advance → **auto-advance 8s with tap-to-skip** (both cheap to switch).
3. Volumes stay on the **estimate step** (not folded into confirm).
4. Target-setting stays **out of the ritual** (moved to week one).
5. DeskWelcome popover **retired to a "Show me around again" re-run**.

Tell me if you want any of these flipped.

## 0.4 · Env keys

- `COMPANIES_HOUSE_API_KEY` (free): register at
  https://developer.company-information.service.gov.uk/ → create an application → get a REST
  API key. Add to `.env.local` and to the staging Vercel env. The module no-ops without it.
- `GEMINI_API_KEY`: confirm it's set on staging so live Rosa can be exercised in the 0.2
  recording (it was absent locally in earlier walkthroughs).
