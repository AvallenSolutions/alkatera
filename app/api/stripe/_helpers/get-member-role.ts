import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/db_types';

/**
 * Get the role name for a user's organisation membership.
 *
 * The `organization_members` table stores `role_id` (UUID FK to `roles`),
 * not a plain `role` text column.  This helper joins through the `roles`
 * table and returns the role name string (e.g. "owner", "admin", "member").
 *
 * Returns `null` if the user is not a member.
 */
export async function getMemberRole(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  userId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('organization_members')
    .select('role_id, roles!inner(name)')
    .eq('organization_id', organizationId)
    .eq('user_id', userId)
    .single();

  if (error || !data) return null;

  // Supabase returns the joined row as `roles: { name: string }`
  return (data as any).roles?.name ?? null;
}
