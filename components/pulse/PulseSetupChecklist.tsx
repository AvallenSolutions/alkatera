'use client';

/**
 * Pulse -- setup checklist.
 *
 * The day-one experience: instead of a wall of empty widgets, a few hairline
 * fact rows under the statement saying what to set up to get more from
 * Pulse. Shown while two or more items are incomplete; disappears once the
 * dashboard has enough to work with. No card, no icons: rows on hairlines.
 */

import { useEffect, useState } from 'react';
import { Eyebrow } from '@/components/studio/eyebrow';
import { FactList } from '@/components/studio/fact-list';
import { supabase } from '@/lib/supabaseClient';
import { useOrganization } from '@/lib/organizationContext';

interface ChecklistItem {
  key: string;
  label: string;
  done: boolean;
  href: string;
}

export function PulseSetupChecklist() {
  const { currentOrganization } = useOrganization();
  const [items, setItems] = useState<ChecklistItem[] | null>(null);

  useEffect(() => {
    if (!currentOrganization?.id) return;
    const orgId = currentOrganization.id;
    let cancelled = false;
    (async () => {
      const [targets, initiatives, suppliers, lcas] = await Promise.all([
        supabase.from('sustainability_targets').select('id', { count: 'exact', head: true }).eq('organization_id', orgId),
        supabase.from('reduction_initiatives').select('id', { count: 'exact', head: true }).eq('organization_id', orgId),
        supabase.from('suppliers').select('id', { count: 'exact', head: true }).eq('organization_id', orgId),
        supabase
          .from('product_carbon_footprints')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', orgId)
          .eq('status', 'completed'),
      ]);
      if (cancelled) return;
      setItems([
        {
          key: 'target',
          label: 'Set a reduction target',
          done: (targets.count ?? 0) > 0,
          href: '/pulse/targets',
        },
        {
          key: 'action',
          label: 'Plan your first action',
          done: (initiatives.count ?? 0) > 0,
          href: '/pulse/targets#actions',
        },
        {
          key: 'lca',
          label: 'Complete a product footprint',
          done: (lcas.count ?? 0) > 0,
          href: '/products',
        },
        {
          key: 'suppliers',
          label: 'Add your suppliers',
          done: (suppliers.count ?? 0) > 0,
          href: '/suppliers',
        },
      ]);
    })();
    return () => {
      cancelled = true;
    };
  }, [currentOrganization?.id]);

  if (!items) return null;
  const incomplete = items.filter(i => !i.done);
  if (incomplete.length < 2) return null;

  return (
    <section>
      <Eyebrow tone="dim">Getting set up</Eyebrow>
      <p className="mt-1 text-xs text-muted-foreground">
        The more of these you complete, the more Pulse can tell you.
      </p>
      <FactList
        dense
        className="mt-2 border-t border-studio-hairline"
        items={items.map(item => ({
          id: item.key,
          title: item.label,
          chip: item.done ? { tone: 'good' as const, label: 'Done' } : undefined,
          meta: item.done ? undefined : 'TO DO',
          href: item.href,
        }))}
      />
    </section>
  );
}
