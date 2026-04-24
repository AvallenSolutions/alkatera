'use client';

/**
 * Pulse -- Per-product environmental cost widget.
 *
 * Lists every product with a completed LCA, showing its embedded £/unit
 * environmental cost (kg CO2e per functional unit × carbon shadow price).
 * Useful for:
 *   - Pricing decisions ("this premium gin costs £0.83/bottle in externalities")
 *   - Margin analysis with environmental cost included
 *   - Sustainable-pricing conversations with customers
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Loader2, Package } from 'lucide-react';
import { useOrganization } from '@/lib/organizationContext';
import { Card, CardContent } from '@/components/ui/card';

interface ProductRow {
  pcf_id: string;
  product_id: string;
  product_name: string;
  product_type: string | null;
  functional_unit: string;
  status: 'completed' | 'draft';
  kg_co2e_per_unit: number;
  litres_water_per_unit?: number;
  gbp_per_unit: number;
  gbp_carbon?: number;
  gbp_water?: number;
  breakdown_gbp: {
    raw_materials: number;
    packaging: number;
    transport: number;
  };
}

interface ApiPayload {
  ok: boolean;
  carbon_price_gbp_per_tonne: number;
  carbon_price_source: string | null;
  water_price_gbp_per_m3?: number;
  water_price_source?: string | null;
  product_count: number;
  lcas_without_climate_figure: number;
  products: ProductRow[];
}

export function ProductEnvironmentalCostWidget() {
  const { currentOrganization } = useOrganization();
  const [data, setData] = useState<ApiPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentOrganization?.id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/pulse/product-costs?organization_id=${currentOrganization.id}`,
        );
        const json = await res.json();
        if (!cancelled && res.ok) setData(json as ApiPayload);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentOrganization?.id]);

  const maxGbp = data
    ? Math.max(...data.products.map(p => p.gbp_per_unit), 0.001)
    : 1;

  return (
    <Card className="border-border/60">
      <CardContent className="space-y-4 p-6">
        <header className="flex items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Package className="h-3 w-3 text-[#ccff00]" />
              Environmental cost per unit
            </p>
            <h3 className="mt-0.5 text-sm font-semibold text-foreground">
              What every SKU carries in externalities
            </h3>
          </div>
          <Link
            href="/products"
            className="text-[11px] text-muted-foreground hover:text-foreground"
          >
            All products <ArrowRight className="ml-0.5 inline h-3 w-3" />
          </Link>
        </header>

        {loading && (
          <div className="flex h-24 items-center justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && data && data.product_count === 0 && (
          <p className="rounded-lg border border-dashed border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
            {data.lcas_without_climate_figure > 0 ? (
              <>
                {data.lcas_without_climate_figure} LCA
                {data.lcas_without_climate_figure === 1 ? '' : 's'} found, but
                none have a climate impact figure recorded yet. Open any LCA in
                the{' '}
                <Link href="/products" className="text-[#ccff00] hover:underline">
                  Products area
                </Link>{' '}
                and re-run the calculation to populate{' '}
                <code className="text-[10px]">climate_change_gwp100</code>.
              </>
            ) : (
              <>
                No product LCAs on file yet. Complete one in the{' '}
                <Link href="/products" className="text-[#ccff00] hover:underline">
                  Products area
                </Link>{' '}
                and it will appear here with its embedded £/unit environmental cost.
              </>
            )}
          </p>
        )}

        {!loading && data && data.product_count > 0 && (
          <>
            <ul className="space-y-2">
              {data.products.slice(0, 10).map(p => (
                <ProductRowEl key={p.pcf_id} product={p} maxGbp={maxGbp} />
              ))}
            </ul>
            <p className="text-[10px] text-muted-foreground/70">
              Monetised at £{data.carbon_price_gbp_per_tonne}/tCO₂e
              {data.water_price_gbp_per_m3
                ? ` + £${data.water_price_gbp_per_m3}/m³ water`
                : ''}
              . Covers carbon
              {data.water_price_gbp_per_m3 ? ' and water' : ''} only -- other
              LCA impact categories (eutrophication, land use, etc.) aren&apos;t
              yet priced. Change rates on the{' '}
              <Link
                href="/pulse/settings/shadow-prices/"
                className="text-[#ccff00] hover:underline"
              >
                Prices page
              </Link>
              .
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ProductRowEl({
  product,
  maxGbp,
}: {
  product: ProductRow;
  maxGbp: number;
}) {
  const widthPct = (product.gbp_per_unit / maxGbp) * 100;
  const { raw_materials, packaging, transport } = product.breakdown_gbp;
  const breakdownTotal = raw_materials + packaging + transport;
  return (
    <li className="rounded-md border border-border/40 bg-card/30 p-3">
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Link
              href={`/products/${product.product_id}`}
              className="block truncate text-sm font-medium text-foreground hover:text-[#ccff00]"
            >
              {product.product_name}
            </Link>
            {product.status === 'draft' && (
              <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-500">
                Draft
              </span>
            )}
          </div>
          {product.product_type && (
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70">
              {product.product_type}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-0.5 text-right">
          <span className="text-base font-semibold tabular-nums text-foreground">
            {formatGbp(product.gbp_per_unit)}
          </span>
          <span className="text-[10px] tabular-nums text-muted-foreground">
            {product.kg_co2e_per_unit.toLocaleString('en-GB', {
              maximumFractionDigits: 2,
            })}
            {' '}kg CO₂e
            {product.litres_water_per_unit && product.litres_water_per_unit > 0
              ? ` + ${product.litres_water_per_unit.toLocaleString('en-GB', { maximumFractionDigits: 1 })} L water`
              : ''}
            {' '}per {product.functional_unit}
          </span>
          {product.gbp_water !== undefined && product.gbp_water > 0 && (
            <span className="text-[10px] tabular-nums text-muted-foreground/70">
              Carbon {formatGbp(product.gbp_carbon ?? 0)} · Water{' '}
              {formatGbp(product.gbp_water)}
            </span>
          )}
        </div>
      </div>
      <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-muted">
        {breakdownTotal > 0 ? (
          <>
            <div
              className="bg-[#ccff00]"
              style={{ width: `${(raw_materials / breakdownTotal) * widthPct}%` }}
              title={`Raw materials: ${formatGbp(raw_materials)}`}
            />
            <div
              className="bg-amber-500"
              style={{ width: `${(packaging / breakdownTotal) * widthPct}%` }}
              title={`Packaging: ${formatGbp(packaging)}`}
            />
            <div
              className="bg-sky-500"
              style={{ width: `${(transport / breakdownTotal) * widthPct}%` }}
              title={`Transport: ${formatGbp(transport)}`}
            />
          </>
        ) : (
          <div className="bg-[#ccff00]" style={{ width: `${widthPct}%` }} />
        )}
      </div>
    </li>
  );
}

function formatGbp(v: number): string {
  if (v < 0.01) return '< £0.01';
  if (v < 10) {
    return v.toLocaleString('en-GB', {
      style: 'currency',
      currency: 'GBP',
      maximumFractionDigits: 2,
    });
  }
  return v.toLocaleString('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  });
}
