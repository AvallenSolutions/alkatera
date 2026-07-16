# /demo — book a 30-minute demo with Tim

Public marketing page at **alkatera.com/demo**. Full landing + native booking against
Tim's live Infomaniak calendar (CalDAV), reusing the proven AgentOS integration.

## Decisions (locked with Tim, 2026-07-13)
- Availability: **Mon–Thu, 09:00–17:00 Europe/London**, 30-min slots (last start 16:30).
- Horizon: **next 30 days**, minimum **4h** notice.
- Meeting: **auto kMeet** video room per booking (no API token; room exists on first visit).
- Page: **full landing** (hero, what you'll cover, trust signals) + booking widget.

## Build
- [ ] Add deps: `tsdav`, `ical.js` (cribbed from `~/AgentOS/web`).
- [ ] Env: `INFOMANIAK_CALDAV_URL/USERNAME/PASSWORD` (copy from AgentOS), reuse `RESEND_API_KEY`.
- [ ] `lib/calendar/infomaniak-caldav.ts` — server-only CalDAV read (busy) + write (create event).
- [ ] `lib/calendar/demo-availability.ts` — pure slot engine (portable TZ offset for Node 18).
- [ ] `app/api/demo/availability/route.ts` (GET) — free slots grouped by London date.
- [ ] `app/api/demo/book/route.ts` (POST) — re-validate, create event + kMeet, email booker + Tim (.ics).
- [ ] `app/demo/page.tsx` + `marketing/components/DemoPageClient.tsx` — dark `#050505`/`#ccff00`, Nav + Footer.
- [ ] Add `/demo` to `app/sitemap.ts` + nav CTA.

## Verify
- [ ] Typecheck new files; dev server renders real free slots; test booking creates event + emails.

## Review (2026-07-13)
Built and verified:
- `lib/calendar/infomaniak-caldav.ts` — server-only CalDAV read (`listBusy`) + write (`createEvent`) + `.ics` invite builder, cribbed from AgentOS.
- `lib/calendar/demo-availability.ts` — pure slot engine. Unit-tested: BST + GMT correctness, 4h notice, Mon–Thu only, 30-day horizon, busy + all-day subtraction, slot validation, grouping. All assertions pass.
- `GET /api/demo/availability` + `POST /api/demo/book` (re-validate → CalDAV write + kMeet room → Resend confirmation to guest with `.ics` + team nudge; email is best-effort so a mail hiccup never fails the booking).
- `app/demo/page.tsx` + `marketing/components/DemoPageClient.tsx` — full landing + booking widget, on-brand dark/#ccff00, Nav + Footer.
- Nav CTA "Book a demo" + `/demo` in sitemap.
- Deps: `tsdav`, `ical.js`. New env documented in `.env.example`.

Verified live: page renders end-to-end; availability route returns graceful 503 + "email us" fallback when creds absent; **read-only** CalDAV round-trip against Tim's real calendar succeeds (auth + parse OK). Write path uses the identical `createCalendarObject` call AgentOS runs in production; not exercised to avoid test bookings.

## Outstanding (needs Tim)
- Set env in **Netlify** (Site settings → Environment variables) AND local `.env.local` — copy from `~/AgentOS/web/.env.local`:
  `INFOMANIAK_CALDAV_URL`, `INFOMANIAK_CALDAV_USERNAME`, `INFOMANIAK_CALDAV_PASSWORD` (+ optional `DEMO_NOTIFY_EMAIL`, `DEMO_ORGANIZER_EMAIL`). `RESEND_API_KEY` already set.
- The classifier blocked me writing secrets into the workspace `.env.local`, so this step is manual.
- Watch first Netlify deploy for the pnpm nested-require bundling gotcha (low risk: tsdav/ical.js are imported in route handlers, bundled by Next).
- Not committed — say the word and I'll commit (incl. `package.json` + `pnpm-lock.yaml` + all new files) and push to main.
