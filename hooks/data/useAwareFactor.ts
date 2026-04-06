'use client';

import { useState, useEffect } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client';

/**
 * Fetches the AWARE (Available WAter REmaining) characterisation factor
 * for a given country. Returns 1.0 (world average) if not found.
 */
export function useAwareFactor(countryCode: string | null | undefined): {
  awareFactor: number;
  loading: boolean;
} {
  const [awareFactor, setAwareFactor] = useState(1.0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!countryCode) {
      setAwareFactor(1.0);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const supabase = getSupabaseBrowserClient();
    supabase
      .from('aware_factors')
      .select('aware_factor')
      .eq('country_code', countryCode.toUpperCase())
      .maybeSingle()
      .then(
        ({ data }) => {
          if (cancelled) return;
          setAwareFactor(data?.aware_factor ? Number(data.aware_factor) : 1.0);
          setLoading(false);
        },
        () => {
          if (cancelled) return;
          setAwareFactor(1.0);
          setLoading(false);
        }
      );

    return () => {
      cancelled = true;
    };
  }, [countryCode]);

  return { awareFactor, loading };
}
