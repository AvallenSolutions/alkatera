'use client';

import Link from 'next/link';
import { Copy, MoreVertical, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { BigNumber } from '@/components/studio/big-number';
import { StateChip } from '@/components/studio/state-chip';
import { ProvenanceChip } from '@/components/studio/provenance-chip';
import { provenanceFromPcfStatus } from '@/lib/provenance';
import { getBoundaryLabel, normaliseBoundary } from '@/lib/system-boundaries';
import type { CellarProductRow } from '@/app/api/cellar/products/route';

interface ProductCardProps {
  product: CellarProductRow;
  duplicating: boolean;
  onDuplicate: (product: CellarProductRow, e: React.MouseEvent) => void;
  onDelete: (product: CellarProductRow, e: React.MouseEvent) => void;
}

/** "700 ml", falling back to the free-text functional unit. */
function functionalUnit(product: CellarProductRow): string | null {
  if (product.unit_size_value && product.unit_size_unit) {
    return `${product.unit_size_value} ${product.unit_size_unit}`;
  }
  return product.functional_unit || null;
}

/** The boundary the footprint was actually run at beats the products-table default. */
function boundaryLabel(product: CellarProductRow): string {
  return getBoundaryLabel(
    normaliseBoundary(product.pcf_boundary || product.system_boundary || 'cradle_to_gate'),
  );
}

/**
 * One product on the shelf: the picture, the name, the number, and how much
 * to trust it.
 *
 * The card used to carry a status chip (LCA complete / In progress / No LCA
 * yet) beside the provenance chip, which said the same thing twice and, worse,
 * disagreed: a product reading "LCA complete" on the list read "0% confirmed"
 * on its own dossier. Provenance is the single status vocabulary now. The
 * number shows for estimates too, because every product is born with a
 * footprint and a blank would be the lie.
 */
export function ProductCard({ product, duplicating, onDuplicate, onDelete }: ProductCardProps) {
  const unit = functionalUnit(product);
  const hasFootprint = product.footprint_per_unit != null;

  return (
    <div className="group relative">
      <div className="absolute right-3 top-3 z-10 opacity-0 transition-opacity duration-150 ease-studio focus-within:opacity-100 group-hover:opacity-100">
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 border border-studio-hairline bg-studio-cream"
              aria-label={`Actions for ${product.name}`}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={(e) => onDuplicate(product, e)} disabled={duplicating}>
              <Copy className="mr-2 h-4 w-4" />
              {duplicating ? 'Duplicating…' : 'Duplicate product'}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-studio-stale focus:text-studio-stale"
              onClick={(e) => onDelete(product, e)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete product
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Link
        href={`/products/${product.id}`}
        className="block rounded-[6px] border border-studio-hairline bg-studio-cream p-4 transition-colors duration-150 ease-studio hover:border-room-accent"
      >
        {product.product_image_url ? (
          <div className="mb-4 flex aspect-video items-center justify-center overflow-hidden rounded-[4px] bg-studio-paper">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={product.product_image_url}
              alt=""
              className="max-h-full max-w-full object-contain"
            />
          </div>
        ) : (
          <div className="mb-4 flex aspect-video items-center justify-center rounded-[4px] border border-studio-hairline bg-studio-paper">
            <span className="font-display text-3xl font-bold text-muted-foreground/40">
              {product.name.charAt(0).toUpperCase()}
            </span>
          </div>
        )}

        <div className="flex items-start gap-2">
          <h3 className="line-clamp-2 font-display text-[15px] font-semibold text-foreground">
            {product.name}
          </h3>
          {product.archived_at && <StateChip tone="quiet">Archived</StateChip>}
        </div>

        <div className="mt-4">
          {hasFootprint ? (
            <BigNumber
              size="panel"
              value={product.footprint_per_unit!.toLocaleString('en-GB', {
                maximumFractionDigits: 2,
              })}
              label="kg CO₂e / unit"
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              The footprint forms as the recipe does.
            </p>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-studio-hairline pt-3">
          {product.latest_pcf_status ? (
            <ProvenanceChip
              provenance={provenanceFromPcfStatus(product.latest_pcf_status)}
              compact
            />
          ) : (
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
              Not started
            </span>
          )}
          <span className="truncate font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            {unit ? `${unit} · ` : ''}
            {boundaryLabel(product)}
          </span>
        </div>
      </Link>
    </div>
  );
}
