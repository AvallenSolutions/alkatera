'use client';

/**
 * Pulse Overview -- setup checklist.
 *
 * The day-one experience: instead of a wall of empty widgets, one card that
 * says what to set up to get more from Pulse. Shown while two or more items
 * are incomplete; disappears once the dashboard has enough to work with.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, Circle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/lib/supabaseClient';
import { useOrganization } from '@/lib/organizationContext';
import { cn } from '@/lib/utils';

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
    <Card className="rounded-[6px] border-dashed border-border bg-card">
      <CardContent className="space-y-3 p-5">
        <div>
          <h3 className="text-sm font-semibold">Get more from Pulse</h3>
          <p className="text-xs text-muted-foreground">
            The more of these you complete, the more Pulse can tell you.
          </p>
        </div>
        <ul className="grid gap-2 sm:grid-cols-2">
          {items.map(item => (
            <li key={item.key}>
              <Link
                href={item.href}
                className={cn(
                  'group flex items-center gap-2 rounded-md border border-border/40 px-3 py-2 text-sm transition-colors',
                  item.done ? 'text-muted-foreground' : 'hover:border-studio-forest/50',
                )}
              >
                {item.done ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-studio-good" />
                ) : (
                  <Circle className="h-4 w-4 shrink-0 text-muted-foreground/50" />
                )}
                <span className={cn('flex-1', item.done && 'line-through decoration-muted-foreground/40')}>
                  {item.label}
                </span>
                {!item.done && (
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                )}
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
