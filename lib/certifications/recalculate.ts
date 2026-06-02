import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  calculateCertificationReadiness,
  getBcorpFrameworkId,
  persistScoreHistory,
} from './readiness';
import { renderReadinessEmail } from './readiness-email';
import type { CertificationReadiness } from './scoring';

/**
 * Recalculate readiness for an organisation's B Corp certification, persist
 * the score history, sync the cert status, and notify the account owner if
 * the overall readiness status changed. Shared by evidence mutations, the
 * Risk Tool, the auto-evidence accept route and the nightly refresh job.
 *
 * Best-effort and self-contained: callers should not fail their request if
 * this throws (wrap in try/catch).
 */
export async function recalculateAndNotify(
  supabase: SupabaseClient,
  organizationId: string,
  certificationId?: string | null,
): Promise<CertificationReadiness> {
  const readiness = await calculateCertificationReadiness(
    supabase,
    organizationId,
    certificationId,
  );

  if (!readiness.hasCertification || !readiness.certificationId) {
    return readiness;
  }

  // Previous status from the cert row.
  const { data: certRow } = await supabase
    .from('organization_certifications')
    .select('status')
    .eq('id', readiness.certificationId)
    .maybeSingle();
  const previousStatus: string = certRow?.status ?? 'not_started';

  const newStatus = readiness.isReadyToSubmit
    ? 'ready'
    : previousStatus === 'certified'
      ? 'certified'
      : 'in_progress';

  const wasReady = previousStatus === 'ready';
  const becameReady = readiness.isReadyToSubmit && !wasReady;
  const lostReady = !readiness.isReadyToSubmit && wasReady;
  const statusChanged = becameReady || lostReady;

  const year0 = readiness.requirementStatuses.filter(
    (rs) => rs.applicableFromYear === 0,
  );
  const year0Met = year0.filter((rs) => rs.status === 'passed').length;
  const readinessScore = readiness.isReadyToSubmit
    ? 100
    : year0.length > 0
      ? Math.round((year0Met / year0.length) * 100)
      : 0;

  await supabase
    .from('organization_certifications')
    .update({
      status: newStatus,
      readiness_score: readinessScore,
      last_assessment_date: new Date().toISOString().slice(0, 10),
      updated_at: new Date().toISOString(),
    })
    .eq('id', readiness.certificationId);

  try {
    await persistScoreHistory(supabase, organizationId, readiness);
  } catch (err) {
    console.error('persistScoreHistory failed in recalculateAndNotify:', err);
  }

  if (statusChanged) {
    await notifyOwners(supabase, organizationId, readiness);
  }

  return readiness;
}

/**
 * Best-effort: when a supplier's ESG assessment changes (submit / verify /
 * revision), refresh the buying organisation's B Corp readiness so supply-chain
 * coverage is reflected immediately rather than waiting for the nightly cron.
 * Resolves the org from the supplier record and its active B Corp certification.
 * Never throws — callers should still not depend on it.
 */
export async function recalculateBcorpForSupplier(
  supabase: SupabaseClient,
  supplierId: string,
): Promise<void> {
  try {
    const { data: sup } = await supabase
      .from('suppliers')
      .select('organization_id')
      .eq('id', supplierId)
      .maybeSingle();
    const organizationId = sup?.organization_id as string | undefined;
    if (!organizationId) return;

    const frameworkId = await getBcorpFrameworkId(supabase);
    if (!frameworkId) return;

    const { data: cert } = await supabase
      .from('organization_certifications')
      .select('id')
      .eq('framework_id', frameworkId)
      .eq('organization_id', organizationId)
      .neq('status', 'not_started')
      .maybeSingle();
    if (!cert?.id) return;

    await recalculateAndNotify(supabase, organizationId, cert.id as string);
  } catch (err) {
    console.error('recalculateBcorpForSupplier failed:', err);
  }
}

async function notifyOwners(
  supabase: SupabaseClient,
  organizationId: string,
  readiness: CertificationReadiness,
): Promise<void> {
  try {
    const { data: org } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', organizationId)
      .maybeSingle();
    const orgName = org?.name ?? 'Your organisation';

    const { data: members } = await supabase
      .from('organization_members')
      .select('user_id, roles!inner(name)')
      .eq('organization_id', organizationId)
      .in('roles.name', ['owner', 'admin']);
    const userIds = ((members ?? []) as Array<{ user_id: string }>).map(
      (m) => m.user_id,
    );
    if (userIds.length === 0) return;

    const title = readiness.isReadyToSubmit
      ? 'Ready to submit for B Corp audit'
      : 'B Corp readiness has changed';
    const message = readiness.isReadyToSubmit
      ? 'All Year 0 requirements now pass. You can prepare your audit package.'
      : `${readiness.blockingRequirements.length} requirement(s) still need to be met before you can submit.`;

    // In-platform notifications (one per owner/admin).
    await supabase.from('user_notifications').insert(
      userIds.map((uid) => ({
        user_id: uid,
        organization_id: organizationId,
        notification_type: 'certification_readiness',
        title,
        message,
        entity_type: 'organization_certification',
        entity_id: readiness.certificationId,
        metadata: { isReadyToSubmit: readiness.isReadyToSubmit },
      })),
    );

    // Email the owner(s), best-effort.
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) return;
    let emails: string[] = [];
    try {
      const { data: users } = await supabase.auth.admin.listUsers();
      emails = (users?.users ?? [])
        .filter((u) => userIds.includes(u.id) && u.email)
        .map((u) => u.email as string);
    } catch (err) {
      console.error('listUsers failed for readiness email:', err);
      return;
    }
    if (emails.length === 0) return;

    const { Resend } = await import('resend');
    const resend = new Resend(resendApiKey);
    const { subject, html, text } = renderReadinessEmail({
      orgName,
      isReadyToSubmit: readiness.isReadyToSubmit,
      blockingCount: readiness.blockingRequirements.length,
      appUrl: process.env.URL ?? 'https://app.alkatera.com',
    });
    try {
      await resend.emails.send({
        from: 'alkatera <sayhello@mail.alkatera.com>',
        to: emails,
        subject,
        html,
        text,
      });
    } catch (err) {
      console.error('Resend readiness email failed:', err);
    }
  } catch (err) {
    console.error('notifyOwners failed:', err);
  }
}
