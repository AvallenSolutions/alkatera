import { describe, it, expect } from 'vitest';
import { selectReminder } from '../trial-reminders';

describe('selectReminder', () => {
  const none = new Set<number>();

  it('sends the 7-day reminder first when a week out', () => {
    expect(selectReminder(7, none)).toEqual({ target: 7, toRecord: [7] });
    // 6/5/4 days still only qualify for the 7-day milestone
    expect(selectReminder(5, none)).toEqual({ target: 7, toRecord: [7] });
  });

  it('sends the 3-day reminder once inside 3 days (7 already sent)', () => {
    expect(selectReminder(3, new Set([7]))).toEqual({ target: 3, toRecord: [3] });
  });

  it('sends the 1-day reminder on the final day (7 and 3 already sent)', () => {
    expect(selectReminder(1, new Set([7, 3]))).toEqual({ target: 1, toRecord: [1] });
  });

  it('returns null when the qualifying milestone is already sent', () => {
    expect(selectReminder(6, new Set([7]))).toBeNull();
    expect(selectReminder(1, new Set([7, 3, 1]))).toBeNull();
  });

  it('supersedes skipped milestones: a missed-cron jump to 1 day sends only "1 day"', () => {
    // Cron missed the 7- and 3-day windows; first time we see this org it has 1 day left.
    // We send the most-urgent (1 day) and record 7/3/1 so no stale notice ever follows.
    expect(selectReminder(1, none)).toEqual({ target: 1, toRecord: [7, 3, 1] });
  });

  it('jump to 2 days sends the 3-day reminder and records 7+3 (not 1)', () => {
    expect(selectReminder(2, none)).toEqual({ target: 3, toRecord: [7, 3] });
  });

  it('day-by-day sweep sends exactly one email per milestone, in order', () => {
    const sent = new Set<number>();
    const emails: number[] = [];
    // Simulate a daily run from 7 days down to 0.
    for (const days of [7, 6, 5, 4, 3, 2, 1, 0]) {
      const d = selectReminder(days, sent);
      if (d) {
        emails.push(d.target);
        d.toRecord.forEach((m) => sent.add(m));
      }
    }
    // Three reminders fired, at the 7 / 3 / 1 milestones, each exactly once.
    expect(emails).toEqual([7, 3, 1]);
  });

  it('does not fire below zero / on an already-charged trial', () => {
    expect(selectReminder(0, new Set([7, 3, 1]))).toBeNull();
  });
});
