/**
 * Pulse — scheduled sweep orchestrators.
 *
 * Each of these walks every organisation and does the same work the
 * corresponding `/api/cron/*` route used to do inline. Extracted here so
 * both the route (kept for manual/admin trigger) and the Inngest cron
 * function (lib/inngest/functions/pulse-jobs.ts) call one implementation —
 * no duplicated business logic between the two dispatch paths.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { computeOrgSnapshots, writeSnapshots } from './snapshots';
import { gatherInsightContext, generateInsight, persistInsight } from './insights';
import { detectAnomaliesForOrg, persistAnomalies } from './anomaly';
import { renderAnomalyAlertEmail } from './anomaly-alert-email';
import { REFERENCE_PRICES, REFERENCE_QUARTER } from './reference-shadow-prices';
import { getAppBaseUrl } from '@/lib/deployment/base-url';

const NOTIFY_THROTTLE_DAYS = 7;

// ─────────────────────────── Snapshots ───────────────────────────

export interface SnapshotsSweepResult {
  synced: number;
  failed: number;
  total: number;
  rows_written: number;
  failures: { organization_id: string; error: string }[];
}

export async function runSnapshotsSweep(supabase: SupabaseClient): Promise<SnapshotsSweepResult> {
  const { data: orgs, error: orgsError } = await supabase.from('organizations').select('id');
  if (orgsError) throw new Error(orgsError.message);
  if (!orgs || orgs.length === 0) {
    return { synced: 0, failed: 0, total: 0, rows_written: 0, failures: [] };
  }

  const today = new Date();
  let totalRowsWritten = 0;
  let successCount = 0;
  const failures: { organization_id: string; error: string }[] = [];

  for (const org of orgs) {
    try {
      const rows = await computeOrgSnapshots(supabase, org.id, today);
      const { written, error } = await writeSnapshots(supabase, rows);
      if (error) {
        failures.push({ organization_id: org.id, error });
      } else {
        totalRowsWritten += written;
        successCount += 1;
      }
    } catch (err: unknown) {
      failures.push({ organization_id: org.id, error: err instanceof Error ? err.message : 'Unknown error' });
      console.error(`Pulse snapshots failed for org ${org.id}:`, err);
    }
  }

  return { synced: successCount, failed: failures.length, total: orgs.length, rows_written: totalRowsWritten, failures };
}

// ─────────────────────────── Insights ───────────────────────────

export interface InsightsSweepResult {
  synced: number;
  failed: number;
  total: number;
  failures: { organization_id: string; reason: string }[];
}

/** Returns null if GEMINI_API_KEY isn't configured — caller decides how to report that. */
export async function runInsightsSweep(supabase: SupabaseClient): Promise<InsightsSweepResult | null> {
  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  if (!geminiKey) return null;

  const { data: orgs, error } = await supabase.from('organizations').select('id');
  if (error) throw new Error(error.message);

  let written = 0;
  const failures: { organization_id: string; reason: string }[] = [];

  for (const org of orgs ?? []) {
    try {
      const context = await gatherInsightContext(supabase, org.id);
      if (context.snapshots.length === 0) {
        failures.push({ organization_id: org.id, reason: 'no_snapshots' });
        continue;
      }
      const insight = await generateInsight(context, { period: 'daily' });
      if (!insight) {
        failures.push({ organization_id: org.id, reason: 'generation_failed' });
        continue;
      }
      const { error: writeError } = await persistInsight(supabase, org.id, insight, 'daily');
      if (writeError) {
        failures.push({ organization_id: org.id, reason: writeError });
      } else {
        written += 1;
      }
    } catch (err: any) {
      const reason = err?.status ? `${err.status} ${err.name ?? ''} ${err.message ?? ''}`.trim() : err?.message ?? 'unknown';
      console.error(`[pulse insights sweep] org ${org.id} failed:`, err);
      failures.push({ organization_id: org.id, reason });
    }
  }

  return { synced: written, failed: failures.length, total: orgs?.length ?? 0, failures };
}

// ─────────────────────────── Anomalies ───────────────────────────

export interface AnomalySweepResult {
  written: number;
  high_severity: number;
  orgs_checked: number;
}

async function sendAnomalyAlertEmail(
  supabase: SupabaseClient,
  org: { id: string; name: string },
  anomalies: { metric_key: string; observed: number; expected: number; z_score: number }[],
  appUrl: string,
): Promise<void> {
  // Outbound Pulse alert emails are opt-in.
  if (process.env.PULSE_EMAIL_ALERTS !== 'true') return;

  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) return;

  const throttleSince = new Date(Date.now() - NOTIFY_THROTTLE_DAYS * 86400_000).toISOString();
  const { data: recent } = await supabase
    .from('dashboard_anomalies')
    .select('metric_key')
    .eq('organization_id', org.id)
    .not('notified_at', 'is', null)
    .gte('notified_at', throttleSince);

  const recentlyNotified = new Set((recent ?? []).map((r: { metric_key: string }) => r.metric_key));
  const toSend = anomalies.filter((a) => !recentlyNotified.has(a.metric_key));
  if (toSend.length === 0) return;

  const { data: members } = await supabase
    .from('organization_members')
    .select('user_id, roles!inner(name)')
    .eq('organization_id', org.id)
    .in('roles.name', ['owner', 'admin']);

  const userIds = (members ?? []).map((m: any) => m.user_id);
  if (userIds.length === 0) return;

  const { data: users } = await supabase.auth.admin.listUsers();
  const emails = (users?.users ?? [])
    .filter((u) => userIds.includes(u.id) && u.email)
    .map((u) => u.email!) as string[];
  if (emails.length === 0) return;

  const { subject, html, text } = renderAnomalyAlertEmail({ orgName: org.name, anomalies: toSend, appUrl });

  const resend = new Resend(resendApiKey);
  try {
    await resend.emails.send({ from: 'alkatera Pulse <alerts@mail.alkatera.com>', to: emails, subject, html, text });
  } catch (err) {
    console.error('[pulse anomaly sweep] Resend email failed:', err);
    return;
  }

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
      await supabase.from('dashboard_anomalies').update({ notified_at: stampAt }).eq('id', latest.id);
    }
  }
}

export async function runAnomalyDetectionSweep(
  supabase: SupabaseClient,
  appUrl: string = getAppBaseUrl(),
): Promise<AnomalySweepResult> {
  const { data: orgs } = await supabase.from('organizations').select('id, name');
  let totalWritten = 0;
  let highSeverity = 0;

  for (const org of orgs ?? []) {
    const anomalies = await detectAnomaliesForOrg(supabase, org.id);
    if (anomalies.length === 0) continue;

    const { written } = await persistAnomalies(supabase, anomalies);
    totalWritten += written;

    const highs = anomalies.filter((a) => a.severity === 'high');
    highSeverity += highs.length;

    if (highs.length > 0) {
      await sendAnomalyAlertEmail(supabase, org as { id: string; name: string }, highs, appUrl);
    }
  }

  return { written: totalWritten, high_severity: highSeverity, orgs_checked: orgs?.length ?? 0 };
}

// ─────────────────────────── Shadow prices ───────────────────────────

export interface ShadowPriceRefreshResult {
  ok: boolean;
  quarter: string;
  effective_from: string;
  updated: { metric_key: string; price_per_unit: number; currency: string; source: string }[];
}

export async function runShadowPriceRefresh(supabase: SupabaseClient): Promise<ShadowPriceRefreshResult> {
  const today = new Date().toISOString().slice(0, 10);

  const rows = REFERENCE_PRICES.map((p) => ({
    organization_id: null,
    metric_key: p.metric_key,
    currency: p.currency,
    price_per_unit: p.price_per_unit,
    unit: p.unit,
    native_unit_multiplier: p.native_unit_multiplier,
    source: p.source,
    effective_from: today,
  }));

  const { error } = await supabase
    .from('org_shadow_prices')
    .upsert(rows, { onConflict: 'organization_id,metric_key,currency,effective_from', ignoreDuplicates: false });

  if (error) throw new Error(error.message);

  return {
    ok: true,
    quarter: REFERENCE_QUARTER,
    effective_from: today,
    updated: rows.map((r) => ({ metric_key: r.metric_key, price_per_unit: r.price_per_unit, currency: r.currency, source: r.source })),
  };
}
