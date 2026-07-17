import { NextRequest, NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { safeCompare } from '@/lib/utils/safe-compare';
import { detectAnomaliesForOrg, persistAnomalies } from '@/lib/pulse/anomaly';
import { renderAnomalyAlertEmail } from '@/lib/pulse/anomaly-alert-email';

// Next.js patches global fetch and, on this route pattern (no next/headers
// call to auto-trigger dynamic mode), would otherwise cache these outbound
// Supabase requests across invocations — a GET with an identical URL every
// time would keep returning the first response it ever saw. no-store on
// every call is what makes this route actually live.
const noStoreFetch: typeof fetch = (input, init) => fetch(input, { ...init, cache: 'no-store' });

const NOTIFY_THROTTLE_DAYS = 7;

/**
 * Cron: Pulse — anomaly detection.
 *
 * POST /api/cron/detect-anomalies
 *
 * Iterates every org, runs the z-score detector against the latest
 * metric_snapshots for each metric, and writes any flagged anomalies to
 * dashboard_anomalies. High-severity anomalies trigger a Resend email
 * to org admins (best-effort; logged and skipped on failure).
 *
 * Schedule: hourly. The detector is idempotent within a (org, metric, day)
 * window thanks to the unique constraint on dashboard_anomalies.
 */
export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || !authHeader || !safeCompare(authHeader, `Bearer ${cronSecret}`)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false }, global: { fetch: noStoreFetch } },
    );

    const { data: orgs } = await supabase.from('organizations').select('id, name');
    let totalWritten = 0;
    let highSeverity = 0;

    for (const org of orgs ?? []) {
      const anomalies = await detectAnomaliesForOrg(supabase, org.id);
      if (anomalies.length === 0) continue;

      const { written } = await persistAnomalies(supabase, anomalies);
      totalWritten += written;

      const highs = anomalies.filter(a => a.severity === 'high');
      highSeverity += highs.length;

      if (highs.length > 0) {
        await sendAlertEmail(supabase, org as { id: string; name: string }, highs);
      }
    }

    return NextResponse.json({
      written: totalWritten,
      high_severity: highSeverity,
      orgs_checked: orgs?.length ?? 0,
    });
  } catch (err: any) {
    console.error('[detect-anomalies cron]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function sendAlertEmail(
  supabase: SupabaseClient,
  org: { id: string; name: string },
  anomalies: { metric_key: string; observed: number; expected: number; z_score: number }[],
): Promise<void> {
  // Outbound Pulse alert emails are opt-in. They are disabled unless
  // PULSE_EMAIL_ALERTS is explicitly set to 'true'. Anomaly detection and the
  // in-app Pulse inbox are unaffected; only email delivery is gated here.
  if (process.env.PULSE_EMAIL_ALERTS !== 'true') return;

  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) return;

  // Throttle: skip any metric we've already emailed about in the last 7 days
  // for this org. Source of truth is dashboard_anomalies.notified_at.
  const throttleSince = new Date(
    Date.now() - NOTIFY_THROTTLE_DAYS * 86400_000,
  ).toISOString();
  const { data: recent } = await supabase
    .from('dashboard_anomalies')
    .select('metric_key')
    .eq('organization_id', org.id)
    .not('notified_at', 'is', null)
    .gte('notified_at', throttleSince);

  const recentlyNotified = new Set(
    (recent ?? []).map((r: { metric_key: string }) => r.metric_key),
  );
  const toSend = anomalies.filter(a => !recentlyNotified.has(a.metric_key));
  if (toSend.length === 0) return;

  // Find admin/owner emails for this org.
  const { data: members } = await supabase
    .from('organization_members')
    .select('user_id, roles!inner(name)')
    .eq('organization_id', org.id)
    .in('roles.name', ['owner', 'admin']);

  const userIds = (members ?? []).map((m: any) => m.user_id);
  if (userIds.length === 0) return;

  const { data: users } = await supabase.auth.admin.listUsers();
  const emails = (users?.users ?? [])
    .filter(u => userIds.includes(u.id) && u.email)
    .map(u => u.email!) as string[];
  if (emails.length === 0) return;

  const { subject, html, text } = renderAnomalyAlertEmail({
    orgName: org.name,
    anomalies: toSend,
    appUrl: process.env.URL ?? 'https://app.alkatera.com',
  });

  const resend = new Resend(resendApiKey);
  try {
    await resend.emails.send({
      from: 'alkatera Pulse <alerts@mail.alkatera.com>',
      to: emails,
      subject,
      html,
      text,
    });
  } catch (err) {
    console.error('[detect-anomalies] Resend email failed:', err);
    return; // don't stamp notified_at if delivery failed
  }

  // Stamp notified_at on the most recent open row per (org, metric_key) we
  // just emailed about. The latest row is the one the user will see in the
  // Pulse inbox, so that's the row we mark as "notified".
  const stampAt = new Date().toISOString();
  for (const a of toSend) {
    const { data: latest } = await supabase
      .from('dashboard_anomalies')
      .select('id')
      .eq('organization_id', org.id)
      .eq('metric_key', a.metric_key)
      .order('detected_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latest?.id) {
      await supabase
        .from('dashboard_anomalies')
        .update({ notified_at: stampAt })
        .eq('id', latest.id);
    }
  }
}
