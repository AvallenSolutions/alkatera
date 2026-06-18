-- Durable idempotency for Stripe webhooks.
--
-- The webhook route previously tracked processed event IDs in a per-lambda
-- in-memory Map AND marked events processed before the handler ran AND
-- returned 200 on handler failure. Consequences: a transient DB failure
-- during e.g. checkout.session.completed permanently lost the subscription
-- activation (Stripe got a 200 so never retried), while genuine Stripe
-- retries landing on a cold instance re-ran non-idempotent side effects
-- (duplicate audit rows, duplicate emails, grace-period restarts).
--
-- This table makes idempotency durable across instances. The route inserts
-- the event id before processing, marks processed = true only after the
-- handler succeeds, and returns 500 on failure so Stripe retries.

create table if not exists public.stripe_webhook_events (
  id text primary key,                  -- Stripe event id (evt_...)
  type text not null,
  processed boolean not null default false,
  error text,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

comment on table public.stripe_webhook_events is
  'Durable idempotency log for Stripe webhook events. Service-role access only.';

-- Service-role only: no policies means anon/authenticated are denied.
alter table public.stripe_webhook_events enable row level security;

-- Housekeeping index for purging old rows (events older than ~30 days are
-- safely beyond Stripe's retry horizon).
create index if not exists idx_stripe_webhook_events_created_at
  on public.stripe_webhook_events (created_at);
