import { schedule } from '@netlify/functions';

/**
 * Distributor portal — outreach reminder dispatcher (Netlify Scheduled Function)
 *
 * Runs once a day at 09:00 UTC. Hits /api/cron/process-reminders which
 * walks every active outreach_reminder_schedules row and dispatches
 * reminder emails to any brands that are due one.
 *
 * Required env vars: URL (auto), CRON_SECRET.
 *
 * Cron "0 9 * * *" = 09:00 UTC daily. Office hours friendly for UK + EU
 * distributors, late evening for US — picked so reminders go out while
 * the audit trail can be reviewed same-day rather than overnight.
 */
export const handler = schedule('0 9 * * *', async () => {
  const baseUrl = process.env.URL;
  const cronSecret = process.env.CRON_SECRET;

  if (!baseUrl) {
    return { statusCode: 500, body: JSON.stringify({ error: 'URL env var missing' }) };
  }
  if (!cronSecret) {
    return { statusCode: 500, body: JSON.stringify({ error: 'CRON_SECRET env var missing' }) };
  }

  const target = `${baseUrl}/api/cron/process-reminders`;

  try {
    const res = await fetch(target, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cronSecret}`,
        'Content-Type': 'application/json',
      },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error('Reminder cron failed:', res.status, body);
    } else {
      console.log('Reminder cron success:', body);
    }
    return { statusCode: res.status, body: JSON.stringify(body) };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Reminder cron threw:', message);
    return { statusCode: 500, body: JSON.stringify({ error: message }) };
  }
});
