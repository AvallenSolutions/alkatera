import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { randomBytes } from 'node:crypto';
import { rateLimit } from '@/lib/rate-limit';
import { calendarConfigured, listBusy, createEvent } from '@/lib/calendar/infomaniak-caldav';
import { DEMO_CONFIG, validateSlot } from '@/lib/calendar/demo-availability';

export const dynamic = 'force-dynamic';

// Where the "new booking" nudge lands. Overridable via env; defaults to the
// monitored shared inbox used by the contact form.
const NOTIFY_EMAIL = process.env.DEMO_NOTIFY_EMAIL || 'hello@alkatera.com';
const ORGANIZER_EMAIL = process.env.DEMO_ORGANIZER_EMAIL || 'hello@alkatera.com';
const FROM_EMAIL = 'alkatera <sayhello@mail.alkatera.com>';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function formatWhen(startISO: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: DEMO_CONFIG.timeZone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(startISO));
}

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';

  // Bookings are heavier than a form submit: cap tighter.
  const { success } = await rateLimit(`demo-book:${ip}`, 5, 60_000);
  if (!success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again shortly.' },
      { status: 429 },
    );
  }

  if (!calendarConfigured()) {
    return NextResponse.json(
      { error: 'Booking is temporarily unavailable. Please email hello@alkatera.com.' },
      { status: 503 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const name = String(body.name || '').trim();
  const email = String(body.email || '').trim();
  const company = String(body.company || '').trim();
  const notes = String(body.notes || '').trim();
  const startISO = String(body.startISO || '').trim();

  if (!name || !email || !startISO) {
    return NextResponse.json(
      { error: 'Name, email and a chosen time are required.' },
      { status: 400 },
    );
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
  }

  try {
    // Re-read the calendar and re-validate the slot server-side: guards against a
    // stale slot (someone booked it in the meantime) or a tampered request.
    const now = new Date();
    const slotStart = new Date(startISO);
    if (Number.isNaN(slotStart.getTime())) {
      return NextResponse.json({ error: 'Invalid time selected.' }, { status: 400 });
    }
    const window = {
      from: new Date(slotStart.getTime() - 60 * 60000),
      to: new Date(slotStart.getTime() + (DEMO_CONFIG.slotMinutes + 60) * 60000),
    };
    const busy = await listBusy(window);
    const valid = validateSlot(startISO, now, busy);
    if (!valid) {
      return NextResponse.json(
        { error: 'That slot is no longer available. Please pick another time.' },
        { status: 409 },
      );
    }

    const start = new Date(valid.startISO);
    const end = new Date(valid.endISO);
    const kmeetUrl = `https://kmeet.infomaniak.com/alkatera-demo-${randomBytes(4).toString('hex')}`;

    const summary = `alkatera demo — ${name}${company ? ` (${company})` : ''}`;
    const descriptionLines = [
      `30-minute alkatera demo with ${name}.`,
      company ? `Company: ${company}` : '',
      `Guest email: ${email}`,
      notes ? `Notes: ${notes}` : '',
      '',
      `Video call: ${kmeetUrl}`,
    ].filter(Boolean);

    const { ics } = await createEvent({
      summary,
      start,
      end,
      description: descriptionLines.join('\n'),
      location: kmeetUrl,
      url: kmeetUrl,
      organizer: ORGANIZER_EMAIL,
      attendees: [email],
    });

    const when = formatWhen(valid.startISO);

    // Email is best-effort: the calendar event is already written, so a mail
    // hiccup must not fail the booking. Send confirmation to the guest + a nudge
    // to the team.
    const resendApiKey = process.env.RESEND_API_KEY;
    if (resendApiKey) {
      const resend = new Resend(resendApiKey);
      const icsAttachment = {
        filename: 'alkatera-demo.ics',
        content: Buffer.from(ics, 'utf-8'),
        contentType: 'text/calendar; method=REQUEST',
      };

      const guestHtml = `
        <div style="font-family: Arial, Helvetica, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0a; color: #e0e0e0; padding: 40px; border: 1px solid #222;">
          <h1 style="color: #ccff00; font-size: 16px; text-transform: uppercase; letter-spacing: 3px; margin: 0 0 24px;">Your demo is booked</h1>
          <p style="color:#fff; font-size:15px; line-height:1.6;">Hi ${name.split(' ')[0]},</p>
          <p style="color:#ccc; font-size:15px; line-height:1.6;">Thanks for booking a 30-minute demo with alka<strong>tera</strong>. Here are the details:</p>
          <table style="width:100%; border-collapse:collapse; margin:24px 0;">
            <tr><td style="padding:8px 0; color:#888; font-size:12px; text-transform:uppercase; letter-spacing:2px; width:110px;">When</td><td style="padding:8px 0; color:#fff; font-size:15px;">${when} (UK time)</td></tr>
            <tr><td style="padding:8px 0; color:#888; font-size:12px; text-transform:uppercase; letter-spacing:2px;">Join</td><td style="padding:8px 0;"><a href="${kmeetUrl}" style="color:#ccff00;">${kmeetUrl}</a></td></tr>
          </table>
          <p style="color:#ccc; font-size:14px; line-height:1.6;">A calendar invitation is attached. If you need to move or cancel, just reply to this email.</p>
          <p style="color:#666; font-size:12px; margin-top:32px;">alka<strong>tera</strong> — sustainability, distilled.</p>
        </div>`;

      const teamHtml = `
        <div style="font-family: 'Courier New', monospace; max-width: 600px; margin: 0 auto; background: #0a0a0a; color: #e0e0e0; padding: 40px; border: 1px solid #222;">
          <h1 style="color:#ccff00; font-size:14px; text-transform:uppercase; letter-spacing:3px; margin:0 0 24px;">New demo booked</h1>
          <table style="width:100%; border-collapse:collapse;">
            <tr><td style="padding:8px 0; color:#888; font-size:11px; text-transform:uppercase; letter-spacing:2px; width:120px;">When</td><td style="padding:8px 0; color:#ccff00; font-size:14px;">${when} (UK)</td></tr>
            <tr><td style="padding:8px 0; color:#888; font-size:11px; text-transform:uppercase; letter-spacing:2px;">Name</td><td style="padding:8px 0; color:#fff; font-size:14px;">${name}</td></tr>
            <tr><td style="padding:8px 0; color:#888; font-size:11px; text-transform:uppercase; letter-spacing:2px;">Email</td><td style="padding:8px 0; color:#fff; font-size:14px;"><a href="mailto:${email}" style="color:#ccff00;">${email}</a></td></tr>
            <tr><td style="padding:8px 0; color:#888; font-size:11px; text-transform:uppercase; letter-spacing:2px;">Company</td><td style="padding:8px 0; color:#fff; font-size:14px;">${company || 'Not provided'}</td></tr>
            <tr><td style="padding:8px 0; color:#888; font-size:11px; text-transform:uppercase; letter-spacing:2px;">Join</td><td style="padding:8px 0;"><a href="${kmeetUrl}" style="color:#ccff00;">${kmeetUrl}</a></td></tr>
            ${notes ? `<tr><td style="padding:8px 0; color:#888; font-size:11px; text-transform:uppercase; letter-spacing:2px; vertical-align:top;">Notes</td><td style="padding:8px 0; color:#fff; font-size:14px;">${notes.replace(/</g, '&lt;')}</td></tr>` : ''}
          </table>
        </div>`;

      try {
        // resend.emails.send resolves with { data, error } and does NOT throw on
        // an API error (e.g. an unverified sending domain), so we must inspect the
        // returned error explicitly or failures go silent.
        const [guestRes, teamRes] = await Promise.all([
          resend.emails.send({
            from: FROM_EMAIL,
            to: [email],
            replyTo: NOTIFY_EMAIL,
            subject: 'Your alkatera demo is booked',
            html: guestHtml,
            attachments: [icsAttachment],
          }),
          resend.emails.send({
            from: FROM_EMAIL,
            to: [NOTIFY_EMAIL],
            replyTo: email,
            subject: `New demo booked: ${name}${company ? ` (${company})` : ''} — ${when}`,
            html: teamHtml,
            attachments: [icsAttachment],
          }),
        ]);
        if (guestRes.error) {
          console.error('Demo booking guest email failed (event still created):', guestRes.error);
        }
        if (teamRes.error) {
          console.error('Demo booking team email failed (event still created):', teamRes.error);
        }
      } catch (mailErr) {
        console.error('Demo booking emails threw (event still created):', mailErr);
      }
    }

    return NextResponse.json({ ok: true, when, joinUrl: kmeetUrl, startISO: valid.startISO });
  } catch (err) {
    console.error('Demo booking failed:', err);
    return NextResponse.json(
      { error: 'Could not complete the booking. Please email hello@alkatera.com.' },
      { status: 502 },
    );
  }
}
