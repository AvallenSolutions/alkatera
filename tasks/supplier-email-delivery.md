# Supplier ESG survey email delivery fix

_2026-07-21. Raised by Everleaf (London Botanical Drinks) reporting that none of
their suppliers received the ESG survey._

## What was actually wrong

Investigated via the Resend API rather than by guessing at DNS.

- **DNS and Resend are healthy.** `mail.alkatera.com` is verified and sending. SPF sits
  correctly on the `send.mail.alkatera.com` Return-Path, DKIM is present, and DMARC
  (`p=quarantine`, relaxed alignment) passes. This was never a DNS fault at the time of
  the complaint.
- **On 7 Jul 2026, 15:24 to 16:17, Matt Williams sent 16 ESG surveys and all 16 hard
  bounced**, including two to his own `matt.w@everleafdrinks.com`. Sixteen different
  receiving providers, 100 per cent failure: sender-side, not sixteen bad addresses.
- Surveys **before** that window delivered (11, 17, 26 Jun). Sends **after** it deliver
  (17 Jul broadcast, 21 Jul survey). The batch sits inside the domain re-plumbing window
  recorded in `docs/dns-records.md`: 26 Jun Infomaniak zone rebuild, 2 Jul apex to
  Netlify plus SPF change, 3 to 14 Jul Resend/SES records added. Two unrelated emails to
  `tim@alkatera.com` on 2 and 3 Jul also bounced, then the same email delivered on 4 Jul.
- **Nobody found out for two weeks** because the only Resend webhook on the account
  points at AgentOS (`agentos-sooty-chi.vercel.app`), not at alkatera. Resend accepts a
  send with HTTP 200 and reports the bounce out of band afterwards, so the platform
  never heard about it. Invitations sat at `pending` looking healthy.
- The 21 Jul send to a personal address **was delivered** and landed in junk (confirmed
  by the recipient). That is a deliverability problem, not a delivery one.

## Tasks

- [x] Migration: `email_delivery_events` table plus delivery columns on `supplier_invitations`
- [x] `POST /api/webhooks/resend` with Svix signature verification, failing closed
- [x] Check the Resend `{ data, error }` return in `/api/send-esg-survey` instead of discarding it
- [x] Persist `email_provider_id` so a later bounce can be attributed to its invitation
- [x] `List-Unsubscribe` and `List-Unsubscribe-Post`, backed by a real one-click endpoint
- [x] Serve the email logo from alkatera.com, not a raw `*.supabase.co` hostname
- [x] From name `<Brand> via alkatera`, and drop the `hello@alkatera.com` CC
- [x] Copy-invite-link fallback in the send dialog, plus honest success/failure reporting
- [x] Surface an undelivered invitation on the supplier detail page
- [x] Refuse to re-mail a contact who used one-click unsubscribe
- [x] Unit tests for signature verification and status precedence (15 passing)
- [x] Typecheck clean across the project
- [ ] Tim: run the migration in Supabase project **alkatera**
- [ ] Tim: add `RESEND_WEBHOOK_SECRET` to Netlify, point the Resend webhook at alkatera
- [ ] Tim: check SES reputation and the suppression list before resending to Everleaf's suppliers

## Review

Five new files, five changed.

New:
- `supabase/migrations/20260721100000_email_delivery_tracking.sql`
- `lib/email/resend-webhook.ts` (Svix verification, event-to-status mapping, precedence)
- `app/api/webhooks/resend/route.ts`
- `app/api/email/unsubscribe/route.ts`
- `lib/__tests__/resend-webhook.test.ts`

Changed:
- `app/api/send-esg-survey/route.ts`
- `app/api/suppliers/detail/route.ts`
- `hooks/data/useOrganizationSupplierDetail.ts`
- `app/(authenticated)/suppliers/[id]/page.tsx`
- `components/suppliers/SendEsgSurveyDialog.tsx`

Notes on the choices:

- **Svix implemented by hand rather than adding the `svix` package.** This repo has
  repeatedly hit "Cannot find module" at Netlify function init when a dependency is
  reached through nested requires across pnpm symlinks, and the algorithm is fifteen
  lines of `node:crypto`.
- **Status precedence rather than last-write-wins.** SES can report delivered and then
  an asynchronous bounce, and Svix redelivers on retry, so a naive update could leave a
  bounced invitation reading as delivered. `shouldOverwriteStatus` ranks the states.
- **Idempotency keyed on the Svix message id**, not on `(email_id, event_type)`. The
  latter would collapse legitimately repeated events such as opens and clicks.
- **`email_delivery_events` is generic**, not survey-specific, so a bounced password
  reset or Pulse alert is visible too. That whole class of blindness caused this incident.
- **RLS enabled with no policies**: service-role only, so a leaked anon key cannot read
  recipient addresses.

## Still open

Deliverability stays degraded for a while regardless of code. Roughly 19 bounces across
about 87 July sends is around 22 per cent, well past the 5 per cent level at which AWS
puts an SES account under review. Reputation recovers by sending clean mail over time.
Worth watching in the Resend dashboard.
