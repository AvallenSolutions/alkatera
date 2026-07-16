import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { calendarConfigured, listBusy } from '@/lib/calendar/infomaniak-caldav';
import {
  DEMO_CONFIG,
  computeAvailableSlots,
  groupSlotsByDay,
} from '@/lib/calendar/demo-availability';

// This reads Tim's live calendar, so it must never be statically cached.
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';

  // Generous limit: the widget fetches once on load, but people re-open the page.
  const { success } = await rateLimit(`demo-availability:${ip}`, 30, 60_000);
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

  try {
    const now = new Date();
    const from = new Date(now.getTime() + DEMO_CONFIG.minNoticeMinutes * 60000);
    const to = new Date(now.getTime() + (DEMO_CONFIG.horizonDays + 1) * 86400000);

    const busy = await listBusy({ from, to });
    const slots = computeAvailableSlots(now, busy);
    const days = groupSlotsByDay(slots);

    return NextResponse.json(
      {
        timeZone: DEMO_CONFIG.timeZone,
        slotMinutes: DEMO_CONFIG.slotMinutes,
        days,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    console.error('Demo availability lookup failed:', err);
    return NextResponse.json(
      { error: 'Could not load availability. Please email hello@alkatera.com.' },
      { status: 502 },
    );
  }
}
