// Pure slot engine for the /demo booking page.
//
// Generates candidate 30-minute demo slots inside Tim's working window, in
// Europe/London wall-clock, then subtracts busy windows read from his calendar.
// Kept dependency-free and portable: timezone offsets are computed with the
// two-formatter technique so it works on Node 18 (Netlify) without date-fns-tz
// or `shortOffset` support.

export const DEMO_CONFIG = {
  timeZone: 'Europe/London',
  slotMinutes: 30,
  // Working window, London wall-clock. Slots start every 30 min from START up to
  // (but not including) END, so the last 30-min slot ends exactly at END.
  workStartHour: 9,
  workEndHour: 17,
  // Weekdays allowed (0=Sun … 6=Sat). Mon–Thu.
  allowedWeekdays: [1, 2, 3, 4],
  // How far ahead bookings open, and the minimum notice required.
  horizonDays: 30,
  minNoticeMinutes: 4 * 60,
} as const;

export type Slot = {
  /** UTC instant of the slot start. */
  startISO: string;
  /** UTC instant of the slot end. */
  endISO: string;
};

export type DayGroup = {
  /** London civil date, YYYY-MM-DD. */
  date: string;
  /** e.g. "Thursday" */
  weekday: string;
  /** e.g. "17 Jul" */
  label: string;
  slots: Array<{ startISO: string; endISO: string; time: string }>;
};

/**
 * Offset of a timezone from UTC, in minutes (positive = east of UTC), at a given
 * instant. Works on any Node/ICU version.
 */
function tzOffsetMinutes(instant: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = dtf.formatToParts(instant).reduce<Record<string, string>>((acc, p) => {
    if (p.type !== 'literal') acc[p.type] = p.value;
    return acc;
  }, {});
  // Intl can render hour "24" at midnight; normalise to 0.
  const hour = parts.hour === '24' ? 0 : Number(parts.hour);
  const asUTC = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    hour,
    Number(parts.minute),
    Number(parts.second),
  );
  return Math.round((asUTC - instant.getTime()) / 60000);
}

/** Convert a London wall-clock date/time to the corresponding UTC instant. */
function londonWallClockToUtc(
  y: number,
  m: number,
  d: number,
  hh: number,
  mm: number,
): Date {
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const offset = tzOffsetMinutes(new Date(guess), DEMO_CONFIG.timeZone);
  // Single pass is safe: the working window (09:00–17:00) never straddles the
  // 01:00–02:00 DST transition, so the offset at `guess` equals the real offset.
  return new Date(guess - offset * 60000);
}

/** The London civil date (YYYY-MM-DD) of an instant. */
function londonCivilDate(instant: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: DEMO_CONFIG.timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

function overlapsBusy(
  start: Date,
  end: Date,
  busy: Array<{ start: Date; end: Date; allDay: boolean }>,
  civilDate: string,
): boolean {
  for (const b of busy) {
    if (b.allDay) {
      // Block the whole London day the all-day event covers.
      if (
        londonCivilDate(b.start) <= civilDate &&
        civilDate < londonCivilDate(b.end)
      ) {
        return true;
      }
      continue;
    }
    if (start.getTime() < b.end.getTime() && end.getTime() > b.start.getTime()) {
      return true;
    }
  }
  return false;
}

/**
 * Build the list of bookable slots. `now` and `busy` are injected so this stays a
 * pure, testable function.
 */
export function computeAvailableSlots(
  now: Date,
  busy: Array<{ start: Date; end: Date; allDay: boolean }>,
): Slot[] {
  const { workStartHour, workEndHour, slotMinutes, allowedWeekdays } = DEMO_CONFIG;
  const earliest = new Date(now.getTime() + DEMO_CONFIG.minNoticeMinutes * 60000);
  const latest = new Date(now.getTime() + DEMO_CONFIG.horizonDays * 86400000);

  const slots: Slot[] = [];

  // Anchor iteration on London civil dates so day boundaries and DST are correct.
  const todayCivil = londonCivilDate(now);
  const anchor = new Date(`${todayCivil}T00:00:00Z`);

  for (let i = 0; i <= DEMO_CONFIG.horizonDays; i++) {
    const day = new Date(anchor.getTime() + i * 86400000);
    const y = day.getUTCFullYear();
    const m = day.getUTCMonth() + 1;
    const d = day.getUTCDate();
    // Weekday of a pure civil date is stable in UTC.
    if (!(allowedWeekdays as readonly number[]).includes(day.getUTCDay())) continue;
    const civilDate = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

    for (let minutes = workStartHour * 60; minutes + slotMinutes <= workEndHour * 60; minutes += slotMinutes) {
      const hh = Math.floor(minutes / 60);
      const mm = minutes % 60;
      const start = londonWallClockToUtc(y, m, d, hh, mm);
      const end = new Date(start.getTime() + slotMinutes * 60000);

      if (start.getTime() < earliest.getTime()) continue;
      if (start.getTime() > latest.getTime()) continue;
      if (overlapsBusy(start, end, busy, civilDate)) continue;

      slots.push({ startISO: start.toISOString(), endISO: end.toISOString() });
    }
  }

  return slots;
}

/** Group slots by London day, with display labels, for the front end. */
export function groupSlotsByDay(slots: Slot[]): DayGroup[] {
  const dayFmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: DEMO_CONFIG.timeZone,
    weekday: 'long',
  });
  const labelFmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: DEMO_CONFIG.timeZone,
    day: 'numeric',
    month: 'short',
  });
  const timeFmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: DEMO_CONFIG.timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const groups = new Map<string, DayGroup>();
  for (const s of slots) {
    const start = new Date(s.startISO);
    const date = londonCivilDate(start);
    let g = groups.get(date);
    if (!g) {
      g = {
        date,
        weekday: dayFmt.format(start),
        label: labelFmt.format(start),
        slots: [],
      };
      groups.set(date, g);
    }
    g.slots.push({ startISO: s.startISO, endISO: s.endISO, time: timeFmt.format(start) });
  }
  return Array.from(groups.values()).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Validate that a proposed slot start is a real, currently-bookable slot. Used by
 * the booking route as a server-side guard against tampered or stale requests.
 * Returns the matching end instant, or null if invalid.
 */
export function validateSlot(
  startISO: string,
  now: Date,
  busy: Array<{ start: Date; end: Date; allDay: boolean }>,
): { startISO: string; endISO: string } | null {
  const slots = computeAvailableSlots(now, busy);
  const match = slots.find((s) => s.startISO === startISO);
  return match ? { startISO: match.startISO, endISO: match.endISO } : null;
}
