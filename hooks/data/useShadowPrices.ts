'use client';

/**
 * Pulse -- useShadowPrices
 *
 * Loads the active org's resolved shadow-price map once and caches it in
 * module-level state per-org. Returns a memoised lookup + a refresh function
 * that the settings page calls after saving a new price.
 *
 * The price set is small (one row per metric), so we keep it in a simple
 * Map rather than reaching for SWR. A manual `refresh()` is enough to keep
 * the UI in sync after writes.
 */

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { loadShadowPrices, type ShadowPrice } from '@/lib/pulse/shadow-prices';
import { useOrganization } from '@/lib/organizationContext';

let browserClient: ReturnType<typeof createClient> | null = null;
function getBrowserClient() {
  if (browserClient) return browserClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error('Supabase env vars missing');
  browserClient = createClient(url, anon);
  return browserClient;
}

export function useShadowPrices() {
  const { currentOrganization } = useOrganization();
  const [prices, setPrices] = useState<Record<string, ShadowPrice>>({});
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!currentOrganization?.id) {
      setPrices({});
      setLoading(false);
      return;
    }
    setLoading(true);
    const next = await loadShadowPrices(getBrowserClient(), currentOrganization.id);
    setPrices(next);
    setLoading(false);
  }, [currentOrganization?.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { prices, loading, refresh };
}
