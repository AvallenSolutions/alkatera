import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * DELETE /api/admin/suppliers/[id]
 *
 * Fully removes a supplier from the platform (alkatera admins only). The previous
 * client-side delete only touched platform_suppliers and was silently blocked by
 * RLS. This service-role route purges the whole footprint in FK-safe order:
 *   1. supplier_invitations (by email + referencing the supplier rows)
 *   2. suppliers rows (cascades ESG assessments/evidence/products/engagements)
 *   3. platform_suppliers (the targeted id + same-email dupes; cascades org links)
 *
 * The auth.users account is intentionally left intact.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Missing authorization header' }, { status: 401 });
    }
    const token = authHeader.replace('Bearer ', '');

    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });
    const {
      data: { user },
      error: authError,
    } = await adminClient.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Gate to alkatera admins. Service-role bypasses RLS, so verify explicitly via
    // a token-scoped client so is_alkatera_admin() resolves auth.uid().
    const userScoped = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false },
    });
    const { data: isAdmin } = await userScoped.rpc('is_alkatera_admin');
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const platformSupplierId = params.id;

    const { data: ps } = await adminClient
      .from('platform_suppliers')
      .select('id, contact_email, user_id')
      .eq('id', platformSupplierId)
      .maybeSingle();
    if (!ps) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });
    }

    const email = (ps.contact_email || '').trim();

    // Collect the supplier rows to remove (by email and/or linked user).
    const supplierIds = new Set<string>();
    if (email) {
      const { data } = await adminClient.from('suppliers').select('id').ilike('contact_email', email);
      (data ?? []).forEach((r: any) => supplierIds.add(r.id));
    }
    if (ps.user_id) {
      const { data } = await adminClient.from('suppliers').select('id').eq('user_id', ps.user_id);
      (data ?? []).forEach((r: any) => supplierIds.add(r.id));
    }
    const ids = Array.from(supplierIds);

    // 1. Invitations (FK to suppliers) — by email and by supplier reference.
    if (email) {
      await adminClient.from('supplier_invitations').delete().ilike('supplier_email', email);
    }
    if (ids.length > 0) {
      await adminClient.from('supplier_invitations').delete().in('supplier_id', ids);
    }

    // 2. Supplier rows (cascades assessments, evidence, products, engagements).
    if (ids.length > 0) {
      const { error } = await adminClient.from('suppliers').delete().in('id', ids);
      if (error) {
        console.error('Error deleting supplier rows:', error);
        return NextResponse.json({ error: 'Failed to delete supplier records' }, { status: 500 });
      }
    }

    // 3. Platform directory entries (cascades organization_suppliers links).
    if (email) {
      await adminClient.from('platform_suppliers').delete().ilike('contact_email', email);
    }
    const { error: psErr } = await adminClient
      .from('platform_suppliers')
      .delete()
      .eq('id', platformSupplierId);
    if (psErr) {
      console.error('Error deleting platform supplier:', psErr);
      return NextResponse.json({ error: 'Failed to delete supplier directory entry' }, { status: 500 });
    }

    return NextResponse.json({ success: true, suppliers_removed: ids.length });
  } catch (error: any) {
    console.error('Error in DELETE /api/admin/suppliers/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
