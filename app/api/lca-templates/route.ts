/**
 * Collection endpoints for org-scoped reusable LCA wizard templates.
 *
 *   GET  /api/lca-templates?organizationId=...  (any org member)
 *   POST /api/lca-templates                      (admin/owner)
 *
 * Individual-template operations live at ./[id]/route.ts, and marking a
 * template as the org default lives at ./[id]/set-default/route.ts.
 *
 * RLS on public.lca_report_templates also enforces org membership, but we
 * check app-side too for clear 401/403 responses and defense in depth.
 */
import { NextRequest, NextResponse } from 'next/server';

import { getSupabaseServerClient } from '@/lib/supabase/server-client';
import { getMemberRole } from '@/app/api/stripe/_helpers/get-member-role';
import type { LcaReportTemplate } from '@/types/lca-templates';

const ADMIN_ROLES = new Set(['owner', 'admin']);

/**
 * List templates for an organisation, ordered with the org default first
 * (if any), then by most-recently-updated.
 */
export async function GET(request: NextRequest) {
  const supabase = getSupabaseServerClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  const organizationId = request.nextUrl.searchParams.get('organizationId');
  if (!organizationId) {
    return NextResponse.json(
      { error: 'organizationId query parameter is required' },
      { status: 400 },
    );
  }

  const role = await getMemberRole(supabase, organizationId, user.id);
  if (!role) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  const { data, error } = await supabase
    .from('lca_report_templates')
    .select('*')
    .eq('organization_id', organizationId)
    .order('is_org_default', { ascending: false })
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('[lca-templates GET] list error:', error);
    return NextResponse.json(
      { error: 'Failed to load templates' },
      { status: 500 },
    );
  }

  return NextResponse.json({
    templates: (data ?? []) as LcaReportTemplate[],
  });
}

/**
 * Create a new template.
 *
 * Body: { organizationId, name, description?, settings, setAsDefault? }
 *
 * The unique (organization_id, name) constraint surfaces as Postgres 23505
 * and is translated to HTTP 409 with a human-readable message the UI can
 * render inline on the "Save as template" dialog.
 */
export async function POST(request: NextRequest) {
  const supabase = getSupabaseServerClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { organizationId, name, description, settings, setAsDefault } =
    body ?? {};

  if (!organizationId || typeof organizationId !== 'string') {
    return NextResponse.json(
      { error: 'organizationId is required' },
      { status: 400 },
    );
  }
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return NextResponse.json(
      { error: 'name is required' },
      { status: 400 },
    );
  }
  if (!settings || typeof settings !== 'object') {
    return NextResponse.json(
      { error: 'settings is required and must be an object' },
      { status: 400 },
    );
  }

  const role = await getMemberRole(supabase, organizationId, user.id);
  if (!role || !ADMIN_ROLES.has(role)) {
    return NextResponse.json(
      {
        error:
          'Only organisation admins or owners can create LCA report templates',
      },
      { status: 403 },
    );
  }

  const trimmedName = name.trim();

  const { data, error } = await supabase
    .from('lca_report_templates')
    .insert({
      organization_id: organizationId,
      name: trimmedName,
      description: typeof description === 'string' ? description : null,
      settings,
      is_org_default: setAsDefault === true,
      created_by: user.id,
    })
    .select('*')
    .single();

  if (error) {
    if ((error as { code?: string }).code === '23505') {
      return NextResponse.json(
        {
          error: `A template named "${trimmedName}" already exists in this organisation.`,
        },
        { status: 409 },
      );
    }
    console.error('[lca-templates POST] insert error:', error);
    return NextResponse.json(
      { error: 'Failed to create template' },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { template: data as LcaReportTemplate },
    { status: 201 },
  );
}
