/**
 * Mark an LCA report template as the org default.
 *
 *   POST /api/lca-templates/[id]/set-default   (admin/owner)
 *
 * The BEFORE INSERT OR UPDATE trigger `enforce_single_lca_template_default`
 * on public.lca_report_templates clears any existing default in the same
 * org atomically before this row is committed, so the partial unique
 * index `idx_lca_templates_one_default_per_org` is never violated and
 * no app-side transaction ordering is required.
 *
 * To _clear_ the org default (e.g. "we no longer want auto-apply on new
 * products"), PATCH the current default template directly — the partial
 * unique index allows zero defaults per org.
 */
import { NextRequest, NextResponse } from 'next/server';

import { getSupabaseServerClient } from '@/lib/supabase/server-client';
import { getMemberRole } from '@/app/api/stripe/_helpers/get-member-role';
import type { LcaReportTemplate } from '@/types/lca-templates';

const ADMIN_ROLES = new Set(['owner', 'admin']);

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = getSupabaseServerClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  const { data: existing, error: fetchError } = await supabase
    .from('lca_report_templates')
    .select('id, organization_id')
    .eq('id', params.id)
    .maybeSingle();

  if (fetchError) {
    console.error('[lca-templates set-default] fetch error:', fetchError);
    return NextResponse.json(
      { error: 'Failed to load template' },
      { status: 500 },
    );
  }
  if (!existing) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 });
  }

  const role = await getMemberRole(
    supabase,
    existing.organization_id,
    user.id,
  );
  if (!role || !ADMIN_ROLES.has(role)) {
    return NextResponse.json(
      {
        error:
          'Only organisation admins or owners can change the default template',
      },
      { status: 403 },
    );
  }

  const { data, error } = await supabase
    .from('lca_report_templates')
    .update({ is_org_default: true })
    .eq('id', params.id)
    .select('*')
    .single();

  if (error) {
    console.error('[lca-templates set-default] update error:', error);
    return NextResponse.json(
      { error: 'Failed to set default template' },
      { status: 500 },
    );
  }

  return NextResponse.json({ template: data as LcaReportTemplate });
}
