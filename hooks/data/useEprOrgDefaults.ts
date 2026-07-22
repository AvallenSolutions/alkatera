import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useOrganization } from '@/lib/organizationContext';
import type { EPROrgDefaults } from '@/lib/epr/inheritance';

/**
 * The organisation's EPR defaults, for the packaging rows that inherit them.
 *
 * Cached per organisation at module scope because a product with secondary and
 * tertiary packaging renders a dozen `PackagingFormCard`s, and every one of
 * them needs the same three values. Without the cache each card would issue
 * its own request for a single row.
 *
 * `PackagingFormCard` sits six components below anything that knows the
 * organisation, so this reads the context directly rather than threading a
 * prop through `PackagingEditorTabs`, `RecipeEditorPanel`, `PackagingComposer`,
 * `BOMImportFlow` and the packaging wizard.
 */
const cache = new Map<string, Promise<EPROrgDefaults | null>>();

/** Drops the cached row so the next mount refetches, e.g. after EPR settings are saved. */
export function invalidateEprOrgDefaults(organizationId?: string) {
  if (organizationId) cache.delete(organizationId);
  else cache.clear();
}

function fetchDefaults(organizationId: string): Promise<EPROrgDefaults | null> {
  const existing = cache.get(organizationId);
  if (existing) return existing;

  const request = Promise.resolve(
    supabase
      .from('epr_organization_settings')
      .select('default_packaging_activity, default_uk_nation, default_is_household')
      .eq('organization_id', organizationId)
      .maybeSingle()
  )
    .then(({ data, error }) => {
      if (error) {
        // A failed lookup must not be cached as "this org has no defaults",
        // or every packaging row would show as overriding nothing.
        cache.delete(organizationId);
        throw error;
      }
      return (data as EPROrgDefaults | null) ?? null;
    });

  cache.set(organizationId, request);
  return request;
}

export function useEprOrgDefaults(): { defaults: EPROrgDefaults | null; loading: boolean } {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;
  const [defaults, setDefaults] = useState<EPROrgDefaults | null>(null);
  const [loading, setLoading] = useState(Boolean(orgId));

  useEffect(() => {
    if (!orgId) {
      setDefaults(null);
      setLoading(false);
      return;
    }
    let live = true;
    setLoading(true);
    fetchDefaults(orgId)
      .then((row) => {
        if (live) setDefaults(row);
      })
      .catch((err) => {
        console.error('Failed to load EPR organisation defaults:', err);
        if (live) setDefaults(null);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [orgId]);

  return { defaults, loading };
}
