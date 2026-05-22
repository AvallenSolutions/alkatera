import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAPIClient } from '@/lib/supabase/api-client';
import { resolveUserOrganization } from '@/lib/supabase/resolve-organization';
import { ECGT_SUBMISSION_DEADLINE } from '@/lib/certifications/ecgt';

const VALID_STAGES = [
  'exported',
  'submitted',
  'scheduled',
  'in_progress',
  'clarifications',
  'certified',
  'not_certified',
];

export async function PATCH(request: NextRequest) {
  try {
    const { client: supabase, user, error: authError } =
      await getSupabaseAPIClient();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { organizationId, error: orgError } = await resolveUserOrganization(
      supabase,
      user,
    );
    if (orgError || !organizationId) {
      return NextResponse.json(
        { error: orgError || 'No organisation found' },
        { status: 403 },
      );
    }

    const body = await request.json();
    if (!body.package_id) {
      return NextResponse.json(
        { error: 'package_id is required' },
        { status: 400 },
      );
    }
    if (body.audit_stage && !VALID_STAGES.includes(body.audit_stage)) {
      return NextResponse.json(
        { error: 'Invalid audit_stage' },
        { status: 400 },
      );
    }

    const update: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (body.audit_stage !== undefined) update.audit_stage = body.audit_stage;
    if (body.audit_scheduled_date !== undefined) {
      update.audit_scheduled_date = body.audit_scheduled_date;
    }
    if (body.auditor_name !== undefined) {
      update.auditor_name = body.auditor_name;
    }

    const { data: pkg, error } = await supabase
      .from('certification_audit_packages')
      .update(update)
      .eq('id', body.package_id)
      .eq('organization_id', organizationId)
      .select()
      .single();

    if (error) {
      console.error('Error updating audit package stage:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 },
      );
    }

    // On submission, record ECGT submission date + auditor on the cert.
    let ecgt: {
      applicable: boolean;
      submissionDate: string | null;
      submittedBeforeDeadline: boolean | null;
    } = { applicable: false, submissionDate: null, submittedBeforeDeadline: null };

    if (body.audit_stage === 'submitted' && pkg?.framework_id) {
      const { data: cert } = await supabase
        .from('organization_certifications')
        .select('id, ecgt_applicable, ecgt_submission_date')
        .eq('organization_id', organizationId)
        .eq('framework_id', pkg.framework_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cert) {
        const submissionDate =
          cert.ecgt_submission_date ??
          new Date().toISOString().slice(0, 10);
        const certUpdate: Record<string, unknown> = {
          ecgt_submission_date: submissionDate,
          updated_at: new Date().toISOString(),
        };
        if (body.auditor_name) certUpdate.auditor_name = body.auditor_name;
        await supabase
          .from('organization_certifications')
          .update(certUpdate)
          .eq('id', cert.id);

        ecgt = {
          applicable: !!cert.ecgt_applicable,
          submissionDate,
          submittedBeforeDeadline:
            submissionDate <= ECGT_SUBMISSION_DEADLINE,
        };
      }
    }

    return NextResponse.json({ package: pkg, ecgt });
  } catch (error) {
    console.error('Error in PATCH /api/certifications/audit-package:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
