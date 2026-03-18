import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getMemberRole } from '../_helpers/get-member-role';

// Mock Supabase client
function createMockSupabase(queryResult: { data: any; error: any }) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(queryResult),
  };
  return chain as any;
}

describe('getMemberRole', () => {
  const orgId = 'org-123';
  const userId = 'user-456';

  it('returns role name when user is a member', async () => {
    const supabase = createMockSupabase({
      data: { role_id: 'role-uuid', roles: { name: 'owner' } },
      error: null,
    });

    const role = await getMemberRole(supabase, orgId, userId);

    expect(role).toBe('owner');
    expect(supabase.from).toHaveBeenCalledWith('organization_members');
    expect(supabase.select).toHaveBeenCalledWith('role_id, roles!inner(name)');
    expect(supabase.eq).toHaveBeenCalledWith('organization_id', orgId);
    expect(supabase.eq).toHaveBeenCalledWith('user_id', userId);
  });

  it('returns "admin" for admin members', async () => {
    const supabase = createMockSupabase({
      data: { role_id: 'role-uuid', roles: { name: 'admin' } },
      error: null,
    });

    const role = await getMemberRole(supabase, orgId, userId);
    expect(role).toBe('admin');
  });

  it('returns "member" for regular members', async () => {
    const supabase = createMockSupabase({
      data: { role_id: 'role-uuid', roles: { name: 'member' } },
      error: null,
    });

    const role = await getMemberRole(supabase, orgId, userId);
    expect(role).toBe('member');
  });

  it('returns null when user is not a member', async () => {
    const supabase = createMockSupabase({
      data: null,
      error: { message: 'No rows returned' },
    });

    const role = await getMemberRole(supabase, orgId, userId);
    expect(role).toBeNull();
  });

  it('returns null when query errors', async () => {
    const supabase = createMockSupabase({
      data: null,
      error: { message: 'Database error' },
    });

    const role = await getMemberRole(supabase, orgId, userId);
    expect(role).toBeNull();
  });

  it('returns null when roles join returns no name', async () => {
    const supabase = createMockSupabase({
      data: { role_id: 'role-uuid', roles: {} },
      error: null,
    });

    const role = await getMemberRole(supabase, orgId, userId);
    expect(role).toBeNull();
  });

  it('returns null when roles join is null', async () => {
    const supabase = createMockSupabase({
      data: { role_id: 'role-uuid', roles: null },
      error: null,
    });

    const role = await getMemberRole(supabase, orgId, userId);
    expect(role).toBeNull();
  });
});

describe('getMemberRole role-based access patterns', () => {
  it('owner passes admin-or-owner check', async () => {
    const supabase = createMockSupabase({
      data: { role_id: 'r', roles: { name: 'owner' } },
      error: null,
    });
    const role = await getMemberRole(supabase, 'org', 'user');
    expect(['owner', 'admin'].includes(role!)).toBe(true);
  });

  it('admin passes admin-or-owner check', async () => {
    const supabase = createMockSupabase({
      data: { role_id: 'r', roles: { name: 'admin' } },
      error: null,
    });
    const role = await getMemberRole(supabase, 'org', 'user');
    expect(['owner', 'admin'].includes(role!)).toBe(true);
  });

  it('member fails admin-or-owner check', async () => {
    const supabase = createMockSupabase({
      data: { role_id: 'r', roles: { name: 'member' } },
      error: null,
    });
    const role = await getMemberRole(supabase, 'org', 'user');
    expect(['owner', 'admin'].includes(role!)).toBe(false);
  });

  it('non-member fails all checks', async () => {
    const supabase = createMockSupabase({
      data: null,
      error: { message: 'not found' },
    });
    const role = await getMemberRole(supabase, 'org', 'user');
    expect(role).toBeNull();
    // This is how the routes use it: if (!role) return 403
    expect(!role).toBe(true);
  });
});
