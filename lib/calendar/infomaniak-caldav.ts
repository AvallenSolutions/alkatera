// Infomaniak calendar (CalDAV) — server-only read (busy windows) + write (create event).
//
// This is a trimmed, focused copy of the proven integration in ~/AgentOS/web
// (lib/integrations/infomaniak.ts): just the calendar half, no IMAP/email.
// It powers the public /demo booking page: read Tim's free/busy to offer slots,
// then write the confirmed booking straight into his calendar.
//
// Infomaniak quirk (validated end to end in AgentOS): CalDAV auth uses Infomaniak's
// internal user id (e.g. "TE01729") as the username plus a SEPARATE calendar app
// password, NOT the email address. Credentials live in env.
//
// NB: import this only from server code (route handlers). It pulls in `tsdav` and
// `ical.js`, which are Node-only.
import 'server-only';
import {
  fetchCalendarObjects,
  getBasicAuthHeaders,
  createCalendarObject,
} from 'tsdav';
import ICAL from 'ical.js';
import { randomUUID } from 'node:crypto';

const MAIL_DOMAIN =
  (process.env.INFOMANIAK_EMAIL || 'alkatera.com').split('@').pop() || 'alkatera.com';

export function calendarConfigured(): boolean {
  return !!(
    process.env.INFOMANIAK_CALDAV_USERNAME &&
    process.env.INFOMANIAK_CALDAV_PASSWORD &&
    process.env.INFOMANIAK_CALDAV_URL
  );
}

function caldavHeaders() {
  return getBasicAuthHeaders({
    username: process.env.INFOMANIAK_CALDAV_USERNAME!,
    password: process.env.INFOMANIAK_CALDAV_PASSWORD!,
  });
}

export type BusyWindow = {
  start: Date;
  end: Date;
  allDay: boolean;
};

/**
 * Every busy window in [from, to) on Tim's calendar. Recurring series are expanded
 * (server-side `expand`, with a client fallback). All-day events are returned with
 * their day span so the caller can block the whole day.
 *
 * "Free" here means simply "no VEVENT overlaps" — we don't read TRANSP/status, so a
 * tentatively-held slot still counts as busy, which is the safe default for a public
 * booking page.
 */
export async function listBusy(opts: { from: Date; to: Date }): Promise<BusyWindow[]> {
  if (!calendarConfigured()) throw new Error('Infomaniak calendar not configured');

  const objects = await fetchCalendarObjects({
    calendar: { url: process.env.INFOMANIAK_CALDAV_URL! },
    timeRange: { start: opts.from.toISOString(), end: opts.to.toISOString() },
    expand: true,
    headers: caldavHeaders(),
  });

  const busy: BusyWindow[] = [];
  for (const o of objects) {
    if (!o.data) continue;
    try {
      const comp = new ICAL.Component(ICAL.parse(o.data));
      for (const ve of comp.getAllSubcomponents('vevent')) {
        const event = new ICAL.Event(ve);
        if (!event.startDate) continue;
        const allDay = event.startDate.isDate ?? false;
        const durationMs =
          event.endDate && event.startDate
            ? event.endDate.toJSDate().getTime() - event.startDate.toJSDate().getTime()
            : allDay
              ? 24 * 60 * 60 * 1000
              : 0;

        const pushOccurrence = (s: Date) => {
          const end = new Date(s.getTime() + (durationMs || (allDay ? 86400000 : 0)));
          // Only keep windows that actually overlap the query range.
          if (s.getTime() < opts.to.getTime() && end.getTime() > opts.from.getTime()) {
            busy.push({ start: s, end, allDay });
          }
        };

        if (event.isRecurring()) {
          const it = event.iterator();
          let next: ICAL.Time | null;
          let guard = 0;
          while ((next = it.next()) && guard++ < 800) {
            const s = next.toJSDate();
            if (s.getTime() >= opts.to.getTime()) break;
            pushOccurrence(s);
          }
        } else {
          pushOccurrence(event.startDate.toJSDate());
        }
      }
    } catch {
      // Skip a single unparseable object rather than failing the whole lookup.
    }
  }
  return busy;
}

function icsStamp(d: Date): string {
  // YYYYMMDDTHHMMSSZ (UTC)
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function icsEscape(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

type EventInput = {
  summary: string;
  start: Date;
  end: Date;
  description?: string;
  location?: string;
  url?: string;
  organizer?: string;
  attendees?: string[];
};

function buildVEventLines(input: EventInput & { uid: string; method?: string }): string[] {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//alkatera//Demo Booking//EN',
    'CALSCALE:GREGORIAN',
  ];
  if (input.method) lines.push(`METHOD:${input.method}`);
  lines.push(
    'BEGIN:VEVENT',
    `UID:${input.uid}`,
    `DTSTAMP:${icsStamp(new Date())}`,
    `DTSTART:${icsStamp(input.start)}`,
    `DTEND:${icsStamp(input.end)}`,
    `SUMMARY:${icsEscape(input.summary)}`,
  );
  if (input.description) lines.push(`DESCRIPTION:${icsEscape(input.description)}`);
  if (input.location) lines.push(`LOCATION:${icsEscape(input.location)}`);
  if (input.url) lines.push(`URL:${input.url}`);
  if (input.organizer) lines.push(`ORGANIZER;CN=alkatera:mailto:${input.organizer}`);
  for (const a of input.attendees || []) {
    lines.push(
      `ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:${a}`,
    );
  }
  lines.push('END:VEVENT', 'END:VCALENDAR');
  return lines;
}

/**
 * A standalone iTIP invite (METHOD:REQUEST) suitable for emailing as an .ics
 * attachment so the recipient's mail client offers "add to calendar".
 */
export function buildInviteICS(input: EventInput & { uid: string }): string {
  return buildVEventLines({ ...input, method: 'REQUEST' }).join('\r\n');
}

/**
 * Write the booking straight into Tim's calendar. Returns the UID (also used as the
 * invite UID so the emailed .ics and the stored event stay in sync).
 */
export async function createEvent(
  input: EventInput,
): Promise<{ uid: string; url: string; ics: string }> {
  if (!calendarConfigured()) throw new Error('Infomaniak calendar not configured');
  const uid = `${randomUUID()}@${MAIL_DOMAIN}`;
  // Stored calendar objects must NOT carry an iTIP METHOD.
  const stored = buildVEventLines({ ...input, uid }).join('\r\n');
  const baseUrl = process.env.INFOMANIAK_CALDAV_URL!;
  const filename = `${uid}.ics`;
  const res = await createCalendarObject({
    calendar: { url: baseUrl },
    iCalString: stored,
    filename,
    headers: caldavHeaders(),
  });
  if (!res.ok) throw new Error(`Calendar create failed: HTTP ${res.status}`);
  const url = baseUrl.endsWith('/') ? baseUrl + filename : `${baseUrl}/${filename}`;
  const ics = buildInviteICS({ ...input, uid });
  return { uid, url, ics };
}
