'use client';

import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StateChip } from '@/components/studio/state-chip';
import type { PlatformSupplier } from './directory-types';

/**
 * One hairline result row in the directory sheet. Bold name, one Verified
 * StateChip, a mono meta line, an arrow that leans in on approach. A real
 * props-driven component (module level) so the controlled inputs elsewhere
 * in the sheet do not remount on every parent render.
 */
export function DirectoryListItem({
  supplier,
  selected,
  onSelect,
}: {
  supplier: PlatformSupplier;
  selected: boolean;
  onSelect: (supplier: PlatformSupplier) => void;
}) {
  const meta = [supplier.industry_sector, supplier.country].filter(Boolean).join(' · ');

  return (
    <button
      type="button"
      onClick={() => onSelect(supplier)}
      className={cn(
        'group flex w-full items-center gap-4 border-b border-studio-hairline px-1 py-3 text-left transition-colors duration-150 ease-studio hover:bg-studio-ink/5',
        selected && 'bg-studio-ink/5',
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-3">
          <span className="truncate font-display text-sm font-semibold text-foreground">
            {supplier.name}
          </span>
          {supplier.is_verified && <StateChip tone="good">Verified</StateChip>}
        </div>
        {meta && (
          <p className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            {meta}
          </p>
        )}
      </div>
      <ArrowRight
        className={cn(
          'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-150 ease-studio group-hover:translate-x-0.5 group-hover:text-room-accent',
          selected && 'text-room-accent',
        )}
        aria-hidden="true"
      />
    </button>
  );
}
