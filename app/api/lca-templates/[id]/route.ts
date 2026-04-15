/**
 * Single-template endpoints for org-scoped LCA wizard templates.
 *
 *   GET    /api/lca-templates/[id]   (any org member)
 *   PATCH  /api/lca-templates/[id]   (admin/owner)  — name / description / settings
 *   DELETE /api/lca-templates/[id]   (admin/owner)
 *
 * is_org_default is NOT mutated here; it has its own sibling endpoint
 * (./set-default/route.ts) so the set-as-default semantics stay explicit
 * and the BEFORE INSERT/UPDATE trigger handles the swap atomically.
 *
 * On every request we first fetch the template to resolve its
 * organization_id, then call getMemberRole against that org. RLS on
 * public.lca_report_templates provides a second layer of defence.
 */
import { NextRequest, NextResponse } from 'next/server';

import { getSupabaseServerClient } from '@/lib/supabase/server-client';
import { getMemberRole } from '@/app/api/stripe/_helpers/get-member-role';
import type { LcaReportTemplate } from '@/types/lca-templates';

const ADMIN_ROLES = new Set(['owner', 'admin']);

export async function GET(
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

  const { data, error } = await supabase
    .from('lca_report_templates')
    .select('*')
    .eq('id', params.id)
    .maybeSingle();

  if (error) {
    console.error('[lca-templates GET by id] fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to load template' },
      { status: 500 },
    );
  }
  if (!data) {
    // Either the template doesn't exist, or RLS hid it because the caller
    // isn't an org member. Either way the user gets a 404.
    return NextResponse.json({ error: 'Template not found' }, { status: 404 });
  }

  const role = await getMemberRole(supabase, data.organization_id, user.id);
  if (!role) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 });
  }

  return NextResponse.json({ template: data as LcaReportTemplate });
}

/**
 * Update name / description / settings on an existing template.
 * Admin/owner only. Duplicate-name errors return 409.
 */
export async function PATCH(
  request: NextRequest,
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

  // Resolve organization_id + existing name up-front so we can role-gate
  // and produce a readable 409 message if name collision happens.
  const { data: existing, error: fetchError } = await supabase
    .from('lca_report_templates')
    .select('id, organization_id, name')
    .eq('id', params.id)
    .maybeSingle();

  if (fetchError) {
    console.error('[lca-templates PATCH] fetch error:', fetchError);
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
          'Only organisation admins or owners can update LCA report templates',
      },
      { status: 403 },
    );
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};

  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || body.name.trim().length === 0) {
      return NextResponse.json(
        { error: 'name must be a non-empty string' },
        { status: 400 },
      );
    }
    patch.name = body.name.trim();
  }

  if (body.description !== undefined) {
    if (body.description !== null && typeof body.description !== 'string') {
      return NextResponse.json(
        { error: 'description must be a string or null' },
        { status: 400 },
      );
    }
    patch.description = body.description;
  }

  if (body.settings !== undefined) {
    if (!body.settings || typeof body.settings !== 'object') {
      return NextResponse.json(
        { error: 'settings must be an object' },
        { status: 400 },
      );
    }
    patch.settings = body.settings;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json(
      { error: 'No updatable fields provided' },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from('lca_report_templates')
    .update(patch)
    .eq('id', params.id)
    .select('*')
    .single();

  if (error) {
    if ((error as { code?: string }).code === '23505') {
      const attempted =
        (patch.name as string | undefined) ?? existing.name;
      return NextResponse.json(
        {
          error: `A template named "${attempted}" already exists in this organisation.`,
        },
        { status: 409 },
      );
    }
    console.error('[lca-templates PATCH] update error:', error);
    return NextResponse.json(
      { error: 'Failed to update template' },
      { status: 500 },
    );
  }

  return NextResponse.json({ template: data as LcaReportTemplate });
}

export async function DELETE(
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
    console.error('[lca-templates DELETE] fetch error:', fetchError);
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
          'Only organisation admins or owners can delete LCA report templates',
      },
      { status: 403 },
    );
  }

  const { error } = await supabase
    .from('lca_report_templates')
    .delete()
    .eq('id', params.id);

  if (error) {
    console.error('[lca-templates DELETE] error:', error);
    return NextResponse.json(
      { error: 'Failed to delete template' },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
