'use client';

import { Cloud, Droplets, Trash2, Leaf } from 'lucide-react';

interface ProductImpactSummary {
  total: number;
  withClimate: number;
  withWater: number;
  withWaste: number;
  withLand: number;
}

interface DataCompletenessCardProps {
  summary: ProductImpactSummary;
}

const PILLARS = [
  { key: 'withClimate' as const, label: 'Climate', icon: Cloud, colour: 'bg-blue-500' },
  { key: 'withWater' as const, label: 'Water', icon: Droplets, colour: 'bg-cyan-500' },
  { key: 'withWaste' as const, label: 'Waste', icon: Trash2, colour: 'bg-amber-500' },
  { key: 'withLand' as const, label: 'Land & Biodiversity', icon: Leaf, colour: 'bg-emerald-500' },
];

export function DataCompletenessCard({ summary }: DataCompletenessCardProps) {
  if (summary.total === 0) {
    return (
      <div className="p-5 rounded-xl border border-border bg-card">
        <h3 className="text-sm font-semibold text-foreground mb-3">Data Completeness</h3>
        <p className="text-sm text-muted-foreground">
          Add products to your catalogue to see data completeness across impact pillars.
        </p>
      </div>
    );
  }

  return (
    <div className="p-5 rounded-xl border border-border bg-card">
      <h3 className="text-sm font-semibold text-foreground mb-4">Data Completeness</h3>
      <div className="space-y-3">
        {PILLARS.map((pillar) => {
          const count = summary[pillar.key];
          const pct = Math.round((count / summary.total) * 100);
          const Icon = pillar.icon;

          return (
            <div key={pillar.key} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Icon className="h-3.5 w-3.5" />
                  {pillar.label}
                </span>
                <span className="text-foreground font-medium">
                  {count}/{summary.total} ({pct}%)
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full ${pillar.colour} transition-all duration-500`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
