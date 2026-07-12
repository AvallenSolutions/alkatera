"use client";

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@/components/ui/toggle-group';
import { Eyebrow } from '@/components/studio/eyebrow';
import { BigNumber } from '@/components/studio/big-number';
import { StateChip } from '@/components/studio/state-chip';
import { PillButton } from '@/components/studio/pill-button';
import { Panel } from '@/components/studio/panel';

export type ContainerType = 'bottle' | 'can' | 'keg';

interface CarbonBreakdown {
  rawMaterials: number;
  processing: number;
  packaging: number;
  transport: number;
  endOfLife?: number;
  usePhase?: number;
  viticulture?: number;
  purchasedIngredients?: number;
  hasViticulture?: boolean;
  soilCarbonRemovals?: number;
}

interface ProductHeroImpactProps {
  productName: string;
  productImage?: string;
  sku?: string;
  category?: string;
  totalCarbonFootprint: number;
  functionalUnit: string;
  carbonBreakdown: CarbonBreakdown;
  benchmark?: number;
  benchmarkLabel?: string;
  trend?: number;
  trendDirection?: 'up' | 'down' | 'stable';
  containerType?: ContainerType;
  onContainerChange?: (type: ContainerType) => void;
  lcaReportUrl?: string;
  onDownloadReport?: () => void;
  className?: string;
}

const LAYER_COLORS: Record<string, { fill: string; label: string }> = {
  rawMaterials: { fill: '#2B46C0', label: 'Raw Materials' },
  viticulture: { fill: '#047857', label: 'Viticulture' },
  purchasedIngredients: { fill: '#205E40', label: 'Purchased Ingredients' },
  processing: { fill: '#6D28D9', label: 'Processing' },
  packaging: { fill: '#A97C14', label: 'Packaging' },
  transport: { fill: '#6F6F68', label: 'Transport' },
  endOfLife: { fill: '#BE123C', label: 'End of Life' },
  usePhase: { fill: '#BF4B2A', label: 'Use Phase' },
};

function BottleVisualization({
  breakdown,
  className,
}: {
  breakdown: CarbonBreakdown;
  className?: string;
}) {
  // Only use positive values for visual display (negative values like end-of-life credits can't be shown as fill)
  const positiveRaw = Math.max(0, breakdown.rawMaterials);
  const positiveProcessing = Math.max(0, breakdown.processing);
  const positivePackaging = Math.max(0, breakdown.packaging);
  const positiveTransport = Math.max(0, breakdown.transport);
  const positiveEndOfLife = Math.max(0, breakdown.endOfLife || 0);
  const positiveUsePhase = Math.max(0, breakdown.usePhase || 0);

  const positiveTotal = positiveRaw + positiveProcessing + positivePackaging + positiveTransport + positiveEndOfLife + positiveUsePhase;

  const getPercentage = (value: number) => positiveTotal > 0 ? (value / positiveTotal) * 100 : 0;

  const rawPct = getPercentage(positiveRaw);
  const processPct = getPercentage(positiveProcessing);
  const packagingPct = getPercentage(positivePackaging);
  const transportPct = getPercentage(positiveTransport);
  const endOfLifePct = getPercentage(positiveEndOfLife);
  const usePhasePct = getPercentage(positiveUsePhase);

  // Define fill region for bottle body only (excluding narrow neck)
  const bottleFillTop = 60;  // Below the neck where body widens
  const bottleFillBottom = 198;  // Match bottle outline bottom (mask clips overflow)
  const fillHeight = bottleFillBottom - bottleFillTop;

  const minVisibleHeight = 3;
  const applyMinHeight = (calculatedHeight: number, percentage: number) => {
    if (percentage > 0 && calculatedHeight < minVisibleHeight) {
      return minVisibleHeight;
    }
    return calculatedHeight;
  };

  // Build layers, filter to positive, sort by size descending (biggest at bottom)
  const layers = [
    { key: 'rawMaterials' as const, pct: rawPct },
    { key: 'processing' as const, pct: processPct },
    { key: 'packaging' as const, pct: packagingPct },
    { key: 'transport' as const, pct: transportPct },
    { key: 'endOfLife' as const, pct: endOfLifePct },
    { key: 'usePhase' as const, pct: usePhasePct },
  ].filter(l => l.pct > 0).sort((a, b) => b.pct - a.pct);

  // Calculate heights with min visible height, then normalise to fit exactly
  const layerData = layers.map(layer => ({
    ...layer,
    rawHeight: applyMinHeight((layer.pct / 100) * fillHeight, layer.pct),
  }));
  const totalRawHeight = layerData.reduce((sum, l) => sum + l.rawHeight, 0);

  // Stack bottom-to-top: biggest at bottom, smallest at top
  const layerRects: { key: string; y: number; height: number; fill: string }[] = [];
  let currentY = bottleFillBottom;
  for (const layer of layerData) {
    const height = totalRawHeight > 0 ? (layer.rawHeight / totalRawHeight) * fillHeight : 0;
    currentY -= height;
    layerRects.push({ key: layer.key, y: currentY, height, fill: LAYER_COLORS[layer.key].fill });
  }

  const bottleOutline = "M38,10 L62,10 L62,55 C62,75 80,85 80,110 L80,185 C80,193 75,198 65,198 L35,198 C25,198 20,193 20,185 L20,110 C20,85 38,75 38,55 Z";

  return (
    <div className={cn('relative w-[100px] h-[200px]', className)}>
      <svg viewBox="0 0 100 200" className="w-full h-full">
        <defs>
          <mask id="bottleMask">
            <path d={bottleOutline} fill="white" />
          </mask>
        </defs>

        <g mask="url(#bottleMask)">
          {layerRects.map(layer => (
            <rect key={layer.key} x="0" y={layer.y} width="100" height={layer.height} fill={layer.fill} />
          ))}
        </g>

        <path
          d={bottleOutline}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="opacity-80 text-foreground"
        />

        <rect x="38" y="2" width="24" height="6" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5" className="opacity-80 text-foreground" />
      </svg>
    </div>
  );
}

function CanVisualization({
  breakdown,
  className,
}: {
  breakdown: CarbonBreakdown;
  className?: string;
}) {
  // Only use positive values for visual display (negative values like end-of-life credits can't be shown as fill)
  const positiveRaw = Math.max(0, breakdown.rawMaterials);
  const positiveProcessing = Math.max(0, breakdown.processing);
  const positivePackaging = Math.max(0, breakdown.packaging);
  const positiveTransport = Math.max(0, breakdown.transport);
  const positiveEndOfLife = Math.max(0, breakdown.endOfLife || 0);
  const positiveUsePhase = Math.max(0, breakdown.usePhase || 0);

  const positiveTotal = positiveRaw + positiveProcessing + positivePackaging + positiveTransport + positiveEndOfLife + positiveUsePhase;

  const getPercentage = (value: number) => positiveTotal > 0 ? (value / positiveTotal) * 100 : 0;

  const rawPct = getPercentage(positiveRaw);
  const processPct = getPercentage(positiveProcessing);
  const packagingPct = getPercentage(positivePackaging);
  const transportPct = getPercentage(positiveTransport);
  const endOfLifePct = getPercentage(positiveEndOfLife);
  const usePhasePct = getPercentage(positiveUsePhase);

  // Define fill region for can body only (excluding tapered top and curved bottom)
  const canFillTop = 48;  // Where the can body starts (after the lip taper)
  const canFillBottom = 185;  // Match can outline bottom (mask clips overflow)
  const fillHeight = canFillBottom - canFillTop;

  const minVisibleHeight = 3;
  const applyMinHeight = (calculatedHeight: number, percentage: number) => {
    if (percentage > 0 && calculatedHeight < minVisibleHeight) {
      return minVisibleHeight;
    }
    return calculatedHeight;
  };

  // Build layers, filter to positive, sort by size descending (biggest at bottom)
  const layers = [
    { key: 'rawMaterials' as const, pct: rawPct },
    { key: 'processing' as const, pct: processPct },
    { key: 'packaging' as const, pct: packagingPct },
    { key: 'transport' as const, pct: transportPct },
    { key: 'endOfLife' as const, pct: endOfLifePct },
    { key: 'usePhase' as const, pct: usePhasePct },
  ].filter(l => l.pct > 0).sort((a, b) => b.pct - a.pct);

  // Calculate heights with min visible height, then normalise to fit exactly
  const layerData = layers.map(layer => ({
    ...layer,
    rawHeight: applyMinHeight((layer.pct / 100) * fillHeight, layer.pct),
  }));
  const totalRawHeight = layerData.reduce((sum, l) => sum + l.rawHeight, 0);

  // Stack bottom-to-top: biggest at bottom, smallest at top
  const layerRects: { key: string; y: number; height: number; fill: string }[] = [];
  let currentY = canFillBottom;
  for (const layer of layerData) {
    const height = totalRawHeight > 0 ? (layer.rawHeight / totalRawHeight) * fillHeight : 0;
    currentY -= height;
    layerRects.push({ key: layer.key, y: currentY, height, fill: LAYER_COLORS[layer.key].fill });
  }

  const canOutline = "M28,32 L72,32 L72,36 L80,48 L80,170 C80,180 72,185 50,185 C28,185 20,180 20,170 L20,48 L28,36 Z";

  return (
    <div className={cn('relative w-[100px] h-[200px]', className)}>
      <svg viewBox="0 0 100 200" className="w-full h-full">
        <defs>
          <mask id="canMask">
            <path d={canOutline} fill="white" />
          </mask>
        </defs>

        <g mask="url(#canMask)">
          {layerRects.map(layer => (
            <rect key={layer.key} x="0" y={layer.y} width="100" height={layer.height} fill={layer.fill} />
          ))}
        </g>

        <path
          d={canOutline}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="opacity-80 text-foreground"
        />

        <path d="M28,36 L72,36" fill="none" stroke="currentColor" strokeWidth="1.5" className="opacity-80 text-foreground" />
        <path d="M32,32 C32,38 68,38 68,32" fill="none" stroke="currentColor" strokeWidth="1" className="opacity-50 text-foreground" />
      </svg>
    </div>
  );
}

function KegVisualization({
  breakdown,
  className,
}: {
  breakdown: CarbonBreakdown;
  className?: string;
}) {
  // Only use positive values for visual display (negative values like end-of-life credits can't be shown as fill)
  const positiveRaw = Math.max(0, breakdown.rawMaterials);
  const positiveProcessing = Math.max(0, breakdown.processing);
  const positivePackaging = Math.max(0, breakdown.packaging);
  const positiveTransport = Math.max(0, breakdown.transport);
  const positiveEndOfLife = Math.max(0, breakdown.endOfLife || 0);
  const positiveUsePhase = Math.max(0, breakdown.usePhase || 0);

  const positiveTotal = positiveRaw + positiveProcessing + positivePackaging + positiveTransport + positiveEndOfLife + positiveUsePhase;

  const getPercentage = (value: number) => positiveTotal > 0 ? (value / positiveTotal) * 100 : 0;

  const rawPct = getPercentage(positiveRaw);
  const processPct = getPercentage(positiveProcessing);
  const packagingPct = getPercentage(positivePackaging);
  const transportPct = getPercentage(positiveTransport);
  const endOfLifePct = getPercentage(positiveEndOfLife);
  const usePhasePct = getPercentage(positiveUsePhase);

  const kegFillTop = 40;
  const kegFillBottom = 180;  // Match keg bottom curve (mask clips overflow)
  const kegFillHeight = kegFillBottom - kegFillTop;

  const minVisibleHeight = 3;
  const applyMinHeight = (calculatedHeight: number, percentage: number) => {
    if (percentage > 0 && calculatedHeight < minVisibleHeight) {
      return minVisibleHeight;
    }
    return calculatedHeight;
  };

  // Build layers, filter to positive, sort by size descending (biggest at bottom)
  const layers = [
    { key: 'rawMaterials' as const, pct: rawPct },
    { key: 'processing' as const, pct: processPct },
    { key: 'packaging' as const, pct: packagingPct },
    { key: 'transport' as const, pct: transportPct },
    { key: 'endOfLife' as const, pct: endOfLifePct },
    { key: 'usePhase' as const, pct: usePhasePct },
  ].filter(l => l.pct > 0).sort((a, b) => b.pct - a.pct);

  // Calculate heights with min visible height, then normalise to fit exactly
  const layerData = layers.map(layer => ({
    ...layer,
    rawHeight: applyMinHeight((layer.pct / 100) * kegFillHeight, layer.pct),
  }));
  const totalRawHeight = layerData.reduce((sum, l) => sum + l.rawHeight, 0);

  // Stack bottom-to-top: biggest at bottom, smallest at top
  const layerRects: { key: string; y: number; height: number; fill: string }[] = [];
  let currentY = kegFillBottom;
  for (const layer of layerData) {
    const height = totalRawHeight > 0 ? (layer.rawHeight / totalRawHeight) * kegFillHeight : 0;
    currentY -= height;
    layerRects.push({ key: layer.key, y: currentY, height, fill: LAYER_COLORS[layer.key].fill });
  }

  // Include bottom curve in outline so mask covers the full keg shape
  const kegOutline = "M15,40 L85,40 L85,175 C85,180 15,180 15,175 Z";

  return (
    <div className={cn('relative w-[100px] h-[200px]', className)}>
      <svg viewBox="0 0 100 200" className="w-full h-full">
        <defs>
          <mask id="kegMask">
            <path d={kegOutline} fill="white" />
          </mask>
        </defs>

        <g mask="url(#kegMask)">
          {layerRects.map(layer => (
            <rect key={layer.key} x="0" y={layer.y} width="100" height={layer.height} fill={layer.fill} />
          ))}
        </g>

        <path
          d={kegOutline}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="opacity-80 text-foreground"
        />

        <path d="M15,40 L15,25 C15,20 85,20 85,25 L85,40" fill="none" stroke="currentColor" strokeWidth="1.5" className="opacity-80 text-foreground" />
        <path d="M15,160 L15,175 C15,180 85,180 85,175 L85,160" fill="none" stroke="currentColor" strokeWidth="1.5" className="opacity-80 text-foreground" />

        <path d="M15,70 Q50,75 85,70" fill="none" stroke="currentColor" strokeWidth="1" className="opacity-40 text-foreground" />
        <path d="M15,130 Q50,135 85,130" fill="none" stroke="currentColor" strokeWidth="1" className="opacity-40 text-foreground" />

        <path d="M25,28 L35,28" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-60 text-foreground" strokeLinecap="round" />
        <path d="M65,28 L75,28" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-60 text-foreground" strokeLinecap="round" />
      </svg>
    </div>
  );
}

export function ProductHeroImpact({
  productName,
  productImage,
  sku,
  category,
  totalCarbonFootprint,
  functionalUnit,
  carbonBreakdown,
  benchmark,
  benchmarkLabel = 'industry average',
  trend,
  trendDirection,
  containerType: initialContainerType = 'bottle',
  onContainerChange,
  lcaReportUrl,
  onDownloadReport,
  className,
}: ProductHeroImpactProps) {
  const [containerType, setContainerType] = useState<ContainerType>(initialContainerType);

  const handleContainerChange = (value: string) => {
    if (value) {
      const newType = value as ContainerType;
      setContainerType(newType);
      onContainerChange?.(newType);
    }
  };

  const benchmarkDiff = benchmark ? ((totalCarbonFootprint - benchmark) / benchmark) * 100 : null;
  const isBetterThanBenchmark = benchmarkDiff !== null && benchmarkDiff < 0;

  const ContainerViz = containerType === 'bottle' ? BottleVisualization :
                       containerType === 'can' ? CanVisualization : KegVisualization;

  const toggleItemClass =
    'h-8 px-3 rounded-full font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-studio-dim data-[state=on]:bg-studio-ink data-[state=on]:text-studio-cream';

  return (
    <Panel flush className={className}>
      <div className="relative z-10 p-6 lg:p-8">
        <div className="flex flex-col lg:flex-row gap-8">
          <div className="flex flex-col items-center lg:items-start gap-4">
            {productImage ? (
              <img
                src={productImage}
                alt={productName}
                className="w-32 h-32 object-cover rounded-[6px] border border-studio-hairline"
              />
            ) : (
              <div className="w-32 h-32 rounded-[6px] bg-studio-hairline/40 border border-studio-hairline" />
            )}

            <div className="text-center lg:text-left">
              <h1 className="font-display text-xl font-bold text-foreground">{productName}</h1>
              {sku && <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-studio-dim">SKU {sku}</p>}
              {category && (
                <p className="mt-2 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-studio-dim">
                  {category}
                </p>
              )}
            </div>
          </div>

          <div className="flex-1 flex flex-col lg:flex-row items-center gap-8">
            <div className="flex flex-col items-center gap-3">
              <div className="w-40 h-72 lg:w-48 lg:h-80">
                <ContainerViz breakdown={carbonBreakdown} className="w-full h-full" />
              </div>

              <ToggleGroup
                type="single"
                value={containerType}
                onValueChange={handleContainerChange}
                className="flex flex-row gap-1 bg-studio-hairline/40 p-1 rounded-full"
              >
                <ToggleGroupItem value="bottle" className={toggleItemClass}>
                  Bottle
                </ToggleGroupItem>
                <ToggleGroupItem value="can" className={toggleItemClass}>
                  Can
                </ToggleGroupItem>
                <ToggleGroupItem value="keg" className={toggleItemClass}>
                  Keg
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            <div className="flex-1 text-center lg:text-left">
              <div className="mb-6">
                <Eyebrow tone="dim" className="mb-2">Climate impact</Eyebrow>
                <BigNumber
                  size="display"
                  value={totalCarbonFootprint.toFixed(2)}
                  label="KG CO₂E"
                  className="inline-block"
                />
                <p className="mt-2 text-sm text-studio-dim">per {functionalUnit}</p>
              </div>

              {(benchmarkDiff !== null || trend !== undefined) && (
                <div className="flex flex-wrap items-center gap-4 justify-center lg:justify-start mb-6">
                  {benchmarkDiff !== null && (
                    <StateChip tone={isBetterThanBenchmark ? 'good' : 'stale'}>
                      {Math.abs(benchmarkDiff).toFixed(0)}% {isBetterThanBenchmark ? 'better than' : 'above'} {benchmarkLabel}
                    </StateChip>
                  )}

                  {trend !== undefined && trendDirection && (
                    <StateChip
                      tone={trendDirection === 'down' ? 'good' : trendDirection === 'up' ? 'stale' : 'quiet'}
                    >
                      {trend > 0 ? '+' : ''}{trend}% vs last version
                    </StateChip>
                  )}
                </div>
              )}

              <div className="flex flex-wrap gap-2 justify-center lg:justify-start">
                {lcaReportUrl && (
                  <PillButton variant="outline" href={lcaReportUrl}>
                    View full LCA report
                  </PillButton>
                )}
                {onDownloadReport && (
                  <PillButton variant="ghost" onClick={onDownloadReport}>
                    Download PDF
                  </PillButton>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-studio-hairline">
          <Eyebrow tone="dim" className="mb-3">Lifecycle breakdown</Eyebrow>
          <div className="flex flex-wrap gap-4">
            {(() => {
              const entries = Object.entries(carbonBreakdown).filter(
                ([key, value]) => key in LAYER_COLORS && typeof value === 'number' && !((key === 'endOfLife' || key === 'usePhase') && !value)
              );
              const total = entries.reduce((sum, [, v]) => sum + ((v as number) || 0), 0);
              const rawPcts = entries.map(([, value]) => total > 0 ? ((value || 0) / total) * 100 : 0);

              // Largest Remainder Method for integer percentages summing to 100
              const floored = rawPcts.map(v => Math.floor(v));
              const remainders = rawPcts.map((v, i) => v - floored[i]);
              let diff = 100 - floored.reduce((a, b) => a + b, 0);
              const indices = rawPcts.map((_, i) => i).sort((a, b) => remainders[b] - remainders[a]);
              const adjusted = [...floored];
              for (let i = 0; i < diff && i < indices.length; i++) {
                adjusted[indices[i]] += 1;
              }

              return entries.map(([key], idx) => {
                const config = LAYER_COLORS[key as keyof typeof LAYER_COLORS];
                return (
                  <div key={key} className="flex items-center gap-2">
                    <div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: config.fill }}
                    />
                    <span className="text-sm text-studio-dim">{config.label}</span>
                    <span className="font-mono text-xs font-bold tabular-nums text-foreground">{adjusted[idx]}%</span>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      </div>
    </Panel>
  );
}
