import 'server-only'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import type { Database } from '@/types/db_types'

type Result =
  | { organizationId: string; error: null }
  | { organizationId: null; error: string }

/**
 * Resolve and verify the current user's organisation.
 *
 * 1. Reads `current_organization_id` from user metadata.
 * 2. Falls back to the user's first active membership if metadata is empty.
 * 3. **Always** verifies the user is an active member of the resolved org
 *    (the previous pattern skipped verification when the org came from metadata).
 *
 * Returns `{ organizationId }` on success or `{ error }` on failure.
 */
export async function resolveUserOrganization(
  supabase: SupabaseClient<Database>,
  user: User,
): Promise<Result> {
  const metadataOrgId: string | undefined =
    user.user_metadata?.current_organization_id

  if (metadataOrgId) {
    // Verify the user is actually a member of this org
    const { data: membership } = await supabase
      .from('organization_members')
      .select('id')
      .eq('organization_id', metadataOrgId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (membership) {
      return { organizationId: metadataOrgId, error: null }
    }
    // Metadata points to an org the user is no longer a member of — fall through
  }

  // Fall back to first membership
  const { data: membership } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  if (!membership) {
    return { organizationId: null, error: 'No organisation found for user' }
  }

  return { organizationId: membership.organization_id, error: null }
}
