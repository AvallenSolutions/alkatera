import { NextRequest, NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { safeCompare } from '@/lib/utils/safe-compare';
import { detectAnomaliesForOrg, persistAnomalies } from '@/lib/pulse/anomaly';
import { METRIC_DEFINITIONS } from '@/lib/pulse/metric-keys';

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
      { auth: { autoRefreshToken: false, persistSession: false } },
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
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) return;

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

  const lines = anomalies
    .map(a => {
      const def = METRIC_DEFINITIONS[a.metric_key as keyof typeof METRIC_DEFINITIONS];
      const label = def?.label ?? a.metric_key;
      return `• ${label}: observed ${formatNumber(a.observed)} vs expected ~${formatNumber(a.expected)} (z = ${a.z_score.toFixed(1)})`;
    })
    .join('\n');

  const resend = new Resend(resendApiKey);
  try {
    await resend.emails.send({
      from: 'alkatera Pulse <alerts@mail.alkatera.com>',
      to: emails,
      subject: `Pulse alert: ${anomalies.length} high-severity anomal${anomalies.length === 1 ? 'y' : 'ies'} for ${org.name}`,
      text: `Pulse has detected unusual movement in your sustainability metrics:\n\n${lines}\n\nReview and acknowledge in Pulse: ${process.env.URL ?? 'https://app.alkatera.com'}/pulse\n\n— alkatera Pulse`,
    });
  } catch (err) {
    console.error('[detect-anomalies] Resend email failed:', err);
  }
}

function formatNumber(n: number): string {
  return n.toLocaleString('en-GB', { maximumFractionDigits: 1 });
}
