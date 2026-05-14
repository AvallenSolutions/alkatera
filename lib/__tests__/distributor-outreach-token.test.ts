import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { validateUploadToken } from '@/lib/distributor/outreach/token-validator';

function mockClient(row: unknown) {
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: row, error: null }),
        }),
      }),
    }),
  } as unknown as SupabaseClient;
}

describe('validateUploadToken', () => {
  it('rejects an obviously too-short token without querying', async () => {
    const supabase = mockClient(null);
    const result = await validateUploadToken(supabase, 'short');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('not_found');
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('returns not_found when the token has no matching row', async () => {
    const supabase = mockClient(null);
    const result = await validateUploadToken(supabase, 'a'.repeat(32));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('not_found');
  });

  it('returns expired when upload_token_expires_at is in the past', async () => {
    const supabase = mockClient({
      id: 'brand-1',
      distributor_org_id: 'dist-1',
      name: 'Brand',
      category: null,
      country_of_origin: null,
      upload_token_expires_at: new Date(Date.now() - 1000).toISOString(),
    });
    const result = await validateUploadToken(supabase, 'a'.repeat(32));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('expired');
  });

  it('returns ok + sanitised brand for a valid token', async () => {
    const supabase = mockClient({
      id: 'brand-1',
      distributor_org_id: 'dist-1',
      name: 'Château Margaux',
      category: 'wine',
      country_of_origin: 'France',
      upload_token_expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    });
    const result = await validateUploadToken(supabase, 'a'.repeat(32));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.brand.name).toBe('Château Margaux');
      expect(result.brand.distributor_org_id).toBe('dist-1');
    }
  });
});
