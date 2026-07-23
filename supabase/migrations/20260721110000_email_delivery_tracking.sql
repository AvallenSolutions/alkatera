-- Email delivery tracking for outbound platform email.
--
-- Context. Between 2 and 14 Jul 2026 the alkatera.com zone was re-plumbed
-- (Infomaniak rebuild, apex -> Netlify, Resend/SES records added). Every ESG
-- survey London Botanical Drinks sent on 7 Jul hard-bounced. Nothing in the
-- platform noticed, because Resend ACCEPTED the sends (HTTP 200) and bounced
-- them afterwards, and the only Resend webhook on the account pointed at a
-- different application. The invitations sat at 'pending' for two weeks while
-- the brand believed their suppliers had been emailed.
--
-- This migration adds the storage that /api/webhooks/resend writes to, so a
-- bounce is visible in the product instead of only in the Resend dashboard.

-- 1. Generic event log. Every Resend event lands here, not just survey
--    invitations, so a bounced password reset or Pulse alert is visible too.
create table if not exists public.email_delivery_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'resend',
  -- Svix message id from the webhook. The true idempotency key: Svix retries
  -- redeliver the same event, and we upsert on this rather than inserting
  -- duplicates. Deduping on (email_id, event_type) instead would have
  -- collapsed legitimately repeated events such as opens and clicks.
  provider_event_id text,
  provider_email_id text,
  event_type text not null,
  recipient text,
  subject text,
  reason text,
  occurred_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists email_delivery_events_provider_event_id_idx
  on public.email_delivery_events (provider_event_id)
  where provider_event_id is not null;

create index if not exists email_delivery_events_provider_email_id_idx
  on public.email_delivery_events (provider_email_id);

create index if not exists email_delivery_events_occurred_at_idx
  on public.email_delivery_events (occurred_at desc);

alter table public.email_delivery_events enable row level security;

-- Deliberately no policies: this is service-role only. The webhook writes with
-- the service key (which bypasses RLS) and any admin read goes through an API
-- route that verifies the caller first. Enabling RLS with no policies means a
-- leaked anon/authenticated key cannot read recipient addresses.

comment on table public.email_delivery_events is
  'Delivery events (sent/delivered/bounced/complained/...) for outbound email. Written by /api/webhooks/resend.';

-- 2. Denormalised last-known state on the invitation, so the supplier list can
--    show "bounced" without joining the event log on every render.
alter table public.supplier_invitations
  add column if not exists email_provider_id text,
  add column if not exists email_status text,
  add column if not exists email_status_at timestamptz,
  add column if not exists email_error text;

create index if not exists supplier_invitations_email_provider_id_idx
  on public.supplier_invitations (email_provider_id);

comment on column public.supplier_invitations.email_status is
  'Last known delivery state from the email provider: sent, delivered, bounced, complained, failed, delivery_delayed, suppressed, unsubscribed. NULL means no send was ever attempted.';

comment on column public.supplier_invitations.email_error is
  'Provider-supplied reason when email_status is bounced, complained or failed.';
