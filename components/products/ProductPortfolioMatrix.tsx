'use client';

/**
 * Product portfolio matrix: per-unit carbon (y) vs production volume (x),
 * bubble size = total annual footprint. Median lines split the plot into
 * four plain-language priority quadrants so a producer can see which product
 * to fix first. Pure maths lives in lib/products/portfolio.ts.
 */

import { useRouter } from 'next/navigation';
import {
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { STUDIO } from '@/components/studio/theme';
import { QUADRANT_LABELS, type PortfolioResult } from '@/lib/products/portfolio';

const CORNERS: Array<{ pos: string; label: string }> = [
  { pos: 'top-3 right-3 text-right', label: QUADRANT_LABELS.biggest_wins },
  { pos: 'bottom-9 right-3 text-right', label: QUADRANT_LABELS.doing_well_at_scale },
  { pos: 'top-3 left-14 text-left', label: QUADRANT_LABELS.high_impact_each },
  { pos: 'bottom-9 left-14 text-left', label: QUADRANT_LABELS.lower_priority },
];

function fmtKg(kg: number): string {
  if (Math.abs(kg) >= 1000) return `${(kg / 1000).toLocaleString('en-GB', { maximumFractionDigits: 1 })} t`;
  return `${Math.round(kg).toLocaleString('en-GB')} kg`;
}

export function ProductPortfolioMatrix({ data }: { data: PortfolioResult }) {
  const router = useRouter();
  const { points, needsVolume, medianVolume, medianIntensity } = data;

  if (points.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Calculate a footprint and enter production volumes for your products to see them ranked here.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Which product to fix first</CardTitle>
          <p className="text-sm text-muted-foreground">
            Bigger bubbles carry more total carbon. Products in the top right give you the most to gain.
          </p>
        </CardHeader>
        <CardContent>
          <div className="relative" style={{ width: '100%', height: 380 }}>
            <ResponsiveContainer>
              <ScatterChart margin={{ top: 16, right: 24, bottom: 36, left: 12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  type="number"
                  dataKey="annualVolume"
                  name="Production volume"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  tickLine={false}
                  tickFormatter={(v) => Number(v).toLocaleString('en-GB')}
                  label={{ value: 'Production volume (per latest assessment)', position: 'bottom', fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                />
                <YAxis
                  type="number"
                  dataKey="perUnitKgCo2e"
                  name="Per unit"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  tickLine={false}
                  tickFormatter={(v) => `${Number(v).toFixed(1)}`}
                  label={{ value: 'kg CO2e per unit', angle: -90, position: 'insideLeft', fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                />
                <ZAxis type="number" dataKey="totalKgCo2e" range={[60, 900]} name="Total" />
                {medianVolume !== null && (
                  <ReferenceLine x={medianVolume} stroke="hsl(var(--border))" strokeDasharray="4 4" />
                )}
                {medianIntensity !== null && (
                  <ReferenceLine y={medianIntensity} stroke="hsl(var(--border))" strokeDasharray="4 4" />
                )}
                <Tooltip
                  cursor={{ strokeDasharray: '3 3' }}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="rounded-md border border-border bg-card p-2 text-xs shadow-sm">
                        <p className="font-medium text-foreground">{d.name}</p>
                        <p className="text-muted-foreground">{d.perUnitKgCo2e.toFixed(2)} kg CO2e per unit</p>
                        <p className="text-muted-foreground">{Number(d.annualVolume).toLocaleString('en-GB')} units</p>
                        <p className="text-muted-foreground">{fmtKg(d.totalKgCo2e)} CO2e total</p>
                        <p className="mt-1 text-room-accent">{QUADRANT_LABELS[d.quadrant as keyof typeof QUADRANT_LABELS]}</p>
                      </div>
                    );
                  }}
                />
                <Scatter
                  data={points}
                  // The cellar's ink, not the workbench's: this chart sat in
                  // cobalt on a plum page. A hex literal rather than the room
                  // variable because var() does not resolve in SVG attributes.
                  fill={STUDIO.plum}
                  fillOpacity={0.55}
                  stroke={STUDIO.plum}
                  onClick={(p: any) => p?.id != null && router.push(`/products/${p.id}`)}
                  className="cursor-pointer"
                />
              </ScatterChart>
            </ResponsiveContainer>

            {points.length >= 3 &&
              CORNERS.map((c) => (
                <span
                  key={c.pos}
                  className={cn(
                    'pointer-events-none absolute max-w-[42%] text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70',
                    c.pos,
                  )}
                >
                  {c.label}
                </span>
              ))}
          </div>
          {points.length < 3 && (
            <p className="mt-2 text-xs text-muted-foreground">
              Once you have a few products with footprints and volumes, this splits into priority quadrants.
            </p>
          )}
        </CardContent>
      </Card>

      {needsVolume.length > 0 && (
        <Card className="border-dashed">
          <CardContent className="py-4">
            <p className="text-sm font-medium">Add production data to place these</p>
            <p className="mb-2 text-xs text-muted-foreground">
              These products have a footprint but no production volume yet, so they can&apos;t be ranked.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {needsVolume.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => router.push(`/products/${p.id}`)}
                  className="rounded-[6px] border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-room-accent hover:text-foreground"
                >
                  {p.name}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
