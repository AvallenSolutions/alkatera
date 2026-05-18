import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { safeCompare } from '@/lib/utils/safe-compare';
import { getBcorpFrameworkId } from '@/lib/certifications/readiness';
import {
  getMappedRequirementCodes,
  queryPlatformEvidence,
} from '@/lib/certifications/platform-data';
import { recalculateAndNotify } from '@/lib/certifications/recalculate';
import { computeHealthScore } from '@/lib/certifications/health-score';
import { isRecertPrepActive } from '@/lib/certifications/scoring';

/**
 * Cron: B Corp — nightly auto-evidence refresh.
 *
 * POST /api/cron/refresh-auto-evidence
 *
 * For every active B Corp 2026 certification, re-runs the mapped platform
 * module queries. New data becomes a `suggested` row; accepted evidence
 * whose source data changed materially is flagged `needs_review`. Readiness
 * is recalculated for any certification whose evidence changed.
 *
 * Schedule: nightly. Triggered externally with the CRON_SECRET bearer token,
 * the same way the other /api/cron/* routes are invoked.
 */
export const runtime = 'nodejs';
export const maxDuration = 300;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (
      !cronSecret ||
      !authHeader ||
      !safeCompare(authHeader, `Bearer ${cronSecret}`)
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY ??
        process.env.SUPABASE_SERVICE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const frameworkId = await getBcorpFrameworkId(supabase);
    if (!frameworkId) {
      return NextResponse.json({ error: 'B Corp framework not found' });
    }

    const codes = getMappedRequirementCodes();
    const { data: reqRows } = await supabase
      .from('certification_framework_requirements')
      .select('id, requirement_code')
      .eq('framework_id', frameworkId)
      .in('requirement_code', codes);
    const reqByCode = new Map<string, string>(
      (reqRows ?? []).map((r: any) => [r.requirement_code, r.id]),
    );

    const { data: certs } = await supabase
      .from('organization_certifications')
      .select('id, organization_id, status')
      .eq('framework_id', frameworkId)
      .neq('status', 'not_started');

    let newSuggestions = 0;
    let flaggedNeedsReview = 0;
    const changedCerts = new Set<string>();

    for (const cert of certs ?? []) {
      const orgId = cert.organization_id as string;
      for (const code of codes) {
        const requirementId = reqByCode.get(code);
        if (!requirementId) continue;

        const platform = await queryPlatformEvidence(supabase, code, orgId);
        if (!platform) continue;

        for (const item of platform.items) {
          const sourceRecordId = UUID_RE.test(item.sourceRecordId)
            ? item.sourceRecordId
            : null;
          const key = {
            organization_id: orgId,
            requirement_id: requirementId,
            source_module: platform.module,
            source_record_id: sourceRecordId,
          };
          const { data: existing } = await supabase
            .from('certification_auto_evidence')
            .select('id, status, source_summary')
            .match(key)
            .maybeSingle();

          if (!existing) {
            await supabase.from('certification_auto_evidence').insert({
              ...key,
              certification_id: cert.id,
              source_label: item.label,
              source_summary: item.summary,
              completeness_flag: platform.completeness,
              completeness_note: platform.completenessNote,
              status: 'suggested',
            });
            newSuggestions += 1;
            changedCerts.add(cert.id);
            continue;
          }

          if (existing.source_summary === item.summary) continue;

          // Source data changed materially.
          await supabase
            .from('certification_auto_evidence')
            .update({
              source_label: item.label,
              source_summary: item.summary,
              completeness_flag: platform.completeness,
              completeness_note: platform.completenessNote,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id);

          if (existing.status === 'accepted') {
            const evKey: Record<string, unknown> = {
              organization_id: orgId,
              requirement_id: requirementId,
              source_module: platform.module,
            };
            if (sourceRecordId) evKey.source_record_id = sourceRecordId;
            await supabase
              .from('certification_evidence_links')
              .update({
                verification_status: 'needs_review',
                updated_at: new Date().toISOString(),
              })
              .match(evKey);
            flaggedNeedsReview += 1;
            changedCerts.add(cert.id);
          }
        }
      }
    }

    for (const certId of Array.from(changedCerts)) {
      const cert = (certs ?? []).find((c: any) => c.id === certId);
      if (cert) {
        try {
          await recalculateAndNotify(
            supabase,
            cert.organization_id,
            certId,
          );
        } catch (e) {
          console.error('recalc in refresh-auto-evidence failed:', e);
        }
      }
    }

    // Phase 4: health-score alerts + recertification activation.
    let healthAlerts = 0;
    let recertActivated = 0;
    for (const cert of certs ?? []) {
      const orgId = cert.organization_id as string;
      try {
        const health = await computeHealthScore(supabase, orgId);
        if (health && health.score < 70) {
          const { data: members } = await supabase
            .from('organization_members')
            .select('user_id, roles!inner(name)')
            .eq('organization_id', orgId)
            .in('roles.name', ['owner', 'admin']);
          const userIds = (
            (members ?? []) as Array<{ user_id: string }>
          ).map((m) => m.user_id);
          if (userIds.length > 0) {
            await supabase.from('user_notifications').insert(
              userIds.map((uid) => ({
                user_id: uid,
                organization_id: orgId,
                notification_type: 'certification_health_low',
                title: 'B Corp health score has dropped',
                message:
                  'Your B Corp certification health score has dropped below 70. Review your evidence and data to stay on track.',
                entity_type: 'organization',
                entity_id: orgId,
                metadata: { score: health.score },
              })),
            );
            healthAlerts += 1;
          }
        }
      } catch (e) {
        console.error('health alert failed:', e);
      }

      // Recertification preparation mode activation (one-shot via notes marker).
      const { data: certRow } = await supabase
        .from('organization_certifications')
        .select('id, certification_start_date, notes')
        .eq('id', cert.id)
        .maybeSingle();
      if (
        certRow &&
        isRecertPrepActive(certRow.certification_start_date) &&
        !String(certRow.notes ?? '').includes('[recert_notified]')
      ) {
        const { data: members } = await supabase
          .from('organization_members')
          .select('user_id, roles!inner(name)')
          .eq('organization_id', orgId)
          .in('roles.name', ['owner', 'admin']);
        const userIds = (
          (members ?? []) as Array<{ user_id: string }>
        ).map((m) => m.user_id);
        if (userIds.length > 0) {
          await supabase.from('user_notifications').insert(
            userIds.map((uid) => ({
              user_id: uid,
              organization_id: orgId,
              notification_type: 'certification_recert_prep',
              title: 'Recertification preparation has started',
              message:
                'Your certification expires in approximately 12 months. Start preparing your recertification submission now.',
              entity_type: 'organization_certification',
              entity_id: cert.id,
              metadata: {},
            })),
          );
        }
        const resendApiKey = process.env.RESEND_API_KEY;
        if (resendApiKey && userIds.length > 0) {
          try {
            const { data: users } = await supabase.auth.admin.listUsers();
            const emails = (users?.users ?? [])
              .filter((u) => userIds.includes(u.id) && u.email)
              .map((u) => u.email as string);
            if (emails.length > 0) {
              const { Resend } = await import('resend');
              const resend = new Resend(resendApiKey);
              await resend.emails.send({
                from: 'alkatera <sayhello@mail.alkatera.com>',
                to: emails,
                subject: 'Recertification preparation has started',
                text: 'Your B Corp certification expires in approximately 12 months. Open alkatera to begin preparing your recertification submission.',
              });
            }
          } catch (e) {
            console.error('recert email failed:', e);
          }
        }
        await supabase
          .from('organization_certifications')
          .update({
            notes: `${certRow.notes ?? ''} [recert_notified]`.trim(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', cert.id);
        recertActivated += 1;
      }
    }

    return NextResponse.json({
      certs_checked: certs?.length ?? 0,
      new_suggestions: newSuggestions,
      flagged_needs_review: flaggedNeedsReview,
      recalculated: changedCerts.size,
      health_alerts: healthAlerts,
      recert_activated: recertActivated,
    });
  } catch (err) {
    console.error('[refresh-auto-evidence cron]', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
