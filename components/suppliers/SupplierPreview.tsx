'use client';

import { PillButton } from '@/components/studio/pill-button';
import { StateChip } from '@/components/studio/state-chip';
import type { PlatformSupplier } from './directory-types';

/**
 * The preview pane on the right of the directory sheet. Quiet mono facts and
 * the one act the room exists for: add this supplier (the ochre room pill,
 * ink on ochre). Quiet studio tokens throughout, no spinners.
 */
export function SupplierPreview({
  supplier,
  canCreate,
  adding,
  atLimit,
  currentCount,
  maxCount,
  onAdd,
}: {
  supplier: PlatformSupplier;
  canCreate: boolean;
  adding: boolean;
  atLimit: boolean;
  currentCount: number | null | undefined;
  maxCount: number | null | undefined;
  onAdd: (supplier: PlatformSupplier) => void;
}) {
  const facts: Array<{ label: string; value: string }> = [];
  if (supplier.industry_sector) facts.push({ label: 'Industry', value: supplier.industry_sector });
  if (supplier.country) facts.push({ label: 'Location', value: supplier.country });
  if (supplier.website) {
    facts.push({ label: 'Website', value: supplier.website.replace(/^https?:\/\//, '') });
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-6 overflow-y-auto">
        <div className="flex items-start gap-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[6px] border border-studio-hairline bg-studio-paper">
            <span className="font-display text-2xl font-bold text-muted-foreground/50">
              {supplier.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="min-w-0">
            <h3 className="font-display text-lg font-semibold leading-tight text-foreground">
              {supplier.name}
            </h3>
            {supplier.is_verified && (
              <div className="mt-1.5">
                <StateChip tone="good">Verified</StateChip>
              </div>
            )}
          </div>
        </div>

        {supplier.description && (
          <p className="text-sm leading-relaxed text-muted-foreground">{supplier.description}</p>
        )}

        {facts.length > 0 && (
          <dl className="divide-y divide-studio-hairline border-t border-studio-hairline">
            {facts.map((fact) => (
              <div key={fact.label} className="flex items-baseline justify-between gap-4 py-2.5">
                <dt className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-studio-dim">
                  {fact.label}
                </dt>
                <dd className="min-w-0 truncate text-right text-sm font-medium text-foreground">
                  {fact.value}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      <div className="mt-4 border-t border-studio-hairline pt-4">
        {canCreate ? (
          <PillButton
            variant="room"
            className="w-full"
            disabled={adding || atLimit}
            onClick={() => onAdd(supplier)}
          >
            {adding ? 'Adding…' : 'Add to my suppliers'}
          </PillButton>
        ) : (
          <>
            <PillButton variant="outline" className="w-full" disabled>
              Add to my suppliers
            </PillButton>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Only administrators can add suppliers.
            </p>
          </>
        )}
        {atLimit && (
          <p className="mt-2 text-center text-xs text-studio-stale">
            Supplier limit reached ({currentCount}/{maxCount}).{' '}
            <a href="/dashboard/settings" className="underline">
              Upgrade
            </a>{' '}
            to add more.
          </p>
        )}
      </div>
    </div>
  );
}
