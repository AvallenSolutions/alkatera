"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@/components/ui/toggle-group';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  FileText,
  Download,
  Info,
} from 'lucide-react';
import Link from 'next/link';

export type ContainerType = 'bottle' | 'can' | 'keg';

interface CarbonBreakdown {
  rawMaterials: number;
  processing: number;
  packaging: number;
  transport: number;
  endOfLife?: number;
  usePhase?: number;
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

const LAYER_COLORS = {
  rawMaterials: { fill: '#84cc16', glow: 'rgba(132, 204, 22, 0.4)', label: 'Raw Materials' },
  processing: { fill: '#a855f7', glow: 'rgba(168, 85, 247, 0.4)', label: 'Processing' },
  packaging: { fill: '#f97316', glow: 'rgba(249, 115, 22, 0.4)', label: 'Packaging' },
  transport: { fill: '#06b6d4', glow: 'rgba(6, 182, 212, 0.4)', label: 'Transport' },
  endOfLife: { fill: '#6b7280', glow: 'rgba(107, 114, 128, 0.4)', label: 'End of Life' },
  usePhase: { fill: '#ec4899', glow: 'rgba(236, 72, 153, 0.4)', label: 'Use Phase' },
};

function BottleVisualization({
  breakdown,
  className,
}: {
  breakdown: CarbonBreakdown;
  className?: string;
}) {
  const total = breakdown.rawMaterials + breakdown.processing + breakdown.packaging + breakdown.transport + (breakdown.endOfLife || 0) + (breakdown.usePhase || 0);

  const getPercentage = (value: number) => total > 0 ? (value / total) * 100 : 0;

  const rawPct = getPercentage(breakdown.rawMaterials);
  const processPct = getPercentage(breakdown.processing);
  const packagingPct = getPercentage(breakdown.packaging);
  const transportPct = getPercentage(breakdown.transport);

  // Define fill region for bottle body only (excluding narrow neck)
  const bottleFillTop = 60;  // Below the neck where body widens
  const bottleFillBottom = 195;  // Just above bottom curve
  const fillHeight = bottleFillBottom - bottleFillTop;

  const minVisibleHeight = 3;
  const applyMinHeight = (calculatedHeight: number, percentage: number) => {
    if (percentage > 0 && calculatedHeight < minVisibleHeight) {
      return minVisibleHeight;
    }
    return calculatedHeight;
  };

  const transportHeight = applyMinHeight((transportPct / 100) * fillHeight, transportPct);
  const packagingHeight = applyMinHeight((packagingPct / 100) * fillHeight, packagingPct);
  const processingHeight = applyMinHeight((processPct / 100) * fillHeight, processPct);
  const rawHeight = applyMinHeight((rawPct / 100) * fillHeight, rawPct);

  const transportY = bottleFillBottom - transportHeight;
  const packagingY = transportY - packagingHeight;
  const processingY = packagingY - processingHeight;
  const rawY = bottleFillTop;

  const bottleOutline = "M38,10 L62,10 L62,55 C62,75 80,85 80,110 L80,185 C80,193 75,198 65,198 L35,198 C25,198 20,193 20,185 L20,110 C20,85 38,75 38,55 Z";

  return (
    <div className={cn('relative w-[100px] h-[200px]', className)}>
      <svg viewBox="0 0 100 200" className="w-full h-full drop-shadow-2xl">
        <defs>
          <linearGradient id="glassOverlay" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.15)" />
            <stop offset="50%" stopColor="rgba(255,255,255,0.05)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
          <mask id="bottleMask">
            <path d={bottleOutline} fill="white" />
          </mask>
          <filter id="bottleGlow">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g mask="url(#bottleMask)">
          <rect x="0" y={rawY} width="100" height={rawHeight} fill={LAYER_COLORS.rawMaterials.fill} />
          <rect x="0" y={processingY} width="100" height={processingHeight} fill={LAYER_COLORS.processing.fill} />
          <rect x="0" y={packagingY} width="100" height={packagingHeight} fill={LAYER_COLORS.packaging.fill} />
          <rect x="0" y={transportY} width="100" height={transportHeight} fill={LAYER_COLORS.transport.fill} />
          <rect x="0" y={bottleFillTop} width="100" height={fillHeight} fill="url(#glassOverlay)" />
        </g>

        <path
          d={bottleOutline}
          fill="none"
          stroke="white"
          strokeWidth="1.5"
          className="opacity-80"
          filter="url(#bottleGlow)"
        />

        <rect x="38" y="2" width="24" height="6" rx="1" fill="none" stroke="white" strokeWidth="1.5" className="opacity-80" />
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
  const total = breakdown.rawMaterials + breakdown.processing + breakdown.packaging + breakdown.transport + (breakdown.endOfLife || 0) + (breakdown.usePhase || 0);

  const getPercentage = (value: number) => total > 0 ? (value / total) * 100 : 0;

  const rawPct = getPercentage(breakdown.rawMaterials);
  const processPct = getPercentage(breakdown.processing);
  const packagingPct = getPercentage(breakdown.packaging);
  const transportPct = getPercentage(breakdown.transport);

  // Define fill region for can body only (excluding tapered top and curved bottom)
  const canFillTop = 48;  // Where the can body starts (after the lip taper)
  const canFillBottom = 175;  // Just above the bottom curve
  const fillHeight = canFillBottom - canFillTop;

  const minVisibleHeight = 3;
  const applyMinHeight = (calculatedHeight: number, percentage: number) => {
    if (percentage > 0 && calculatedHeight < minVisibleHeight) {
      return minVisibleHeight;
    }
    return calculatedHeight;
  };

  const transportHeight = applyMinHeight((transportPct / 100) * fillHeight, transportPct);
  const packagingHeight = applyMinHeight((packagingPct / 100) * fillHeight, packagingPct);
  const processingHeight = applyMinHeight((processPct / 100) * fillHeight, processPct);
  const rawHeight = applyMinHeight((rawPct / 100) * fillHeight, rawPct);

  const transportY = canFillBottom - transportHeight;
  const packagingY = transportY - packagingHeight;
  const processingY = packagingY - processingHeight;
  const rawY = canFillTop;

  const canOutline = "M28,32 L72,32 L72,36 L80,48 L80,170 C80,180 72,185 50,185 C28,185 20,180 20,170 L20,48 L28,36 Z";

  return (
    <div className={cn('relative w-[100px] h-[200px]', className)}>
      <svg viewBox="0 0 100 200" className="w-full h-full drop-shadow-2xl">
        <defs>
          <linearGradient id="canGlassOverlay" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.15)" />
            <stop offset="50%" stopColor="rgba(255,255,255,0.05)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
          <mask id="canMask">
            <path d={canOutline} fill="white" />
          </mask>
          <filter id="canGlow">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g mask="url(#canMask)">
          <rect x="0" y={rawY} width="100" height={rawHeight} fill={LAYER_COLORS.rawMaterials.fill} />
          <rect x="0" y={processingY} width="100" height={processingHeight} fill={LAYER_COLORS.processing.fill} />
          <rect x="0" y={packagingY} width="100" height={packagingHeight} fill={LAYER_COLORS.packaging.fill} />
          <rect x="0" y={transportY} width="100" height={transportHeight} fill={LAYER_COLORS.transport.fill} />
          <rect x="0" y={canFillTop} width="100" height={fillHeight} fill="url(#canGlassOverlay)" />
        </g>

        <path
          d={canOutline}
          fill="none"
          stroke="white"
          strokeWidth="1.5"
          className="opacity-80"
          filter="url(#canGlow)"
        />

        <path d="M28,36 L72,36" fill="none" stroke="white" strokeWidth="1.5" className="opacity-80" />
        <path d="M32,32 C32,38 68,38 68,32" fill="none" stroke="white" strokeWidth="1" className="opacity-50" />
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
  const total = breakdown.rawMaterials + breakdown.processing + breakdown.packaging + breakdown.transport + (breakdown.endOfLife || 0) + (breakdown.usePhase || 0);

  const getPercentage = (value: number) => total > 0 ? (value / total) * 100 : 0;

  const rawPct = getPercentage(breakdown.rawMaterials);
  const processPct = getPercentage(breakdown.processing);
  const packagingPct = getPercentage(breakdown.packaging);
  const transportPct = getPercentage(breakdown.transport);

  const kegFillTop = 40;
  const kegFillBottom = 160;
  const kegFillHeight = kegFillBottom - kegFillTop;

  const minVisibleHeight = 3;
  const applyMinHeight = (calculatedHeight: number, percentage: number) => {
    if (percentage > 0 && calculatedHeight < minVisibleHeight) {
      return minVisibleHeight;
    }
    return calculatedHeight;
  };

  const transportHeight = applyMinHeight((transportPct / 100) * kegFillHeight, transportPct);
  const packagingHeight = applyMinHeight((packagingPct / 100) * kegFillHeight, packagingPct);
  const processingHeight = applyMinHeight((processPct / 100) * kegFillHeight, processPct);
  const rawHeight = applyMinHeight((rawPct / 100) * kegFillHeight, rawPct);

  const transportY = kegFillBottom - transportHeight;
  const packagingY = transportY - packagingHeight;
  const processingY = packagingY - processingHeight;
  const rawY = kegFillTop;

  const kegOutline = "M15,40 L85,40 L85,160 L15,160 Z";

  return (
    <div className={cn('relative w-[100px] h-[200px]', className)}>
      <svg viewBox="0 0 100 200" className="w-full h-full drop-shadow-2xl">
        <defs>
          <linearGradient id="kegGlassOverlay" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.15)" />
            <stop offset="50%" stopColor="rgba(255,255,255,0.05)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
          <mask id="kegMask">
            <path d={kegOutline} fill="white" />
          </mask>
          <filter id="kegGlow">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g mask="url(#kegMask)">
          <rect x="0" y={rawY} width="100" height={rawHeight} fill={LAYER_COLORS.rawMaterials.fill} />
          <rect x="0" y={processingY} width="100" height={processingHeight} fill={LAYER_COLORS.processing.fill} />
          <rect x="0" y={packagingY} width="100" height={packagingHeight} fill={LAYER_COLORS.packaging.fill} />
          <rect x="0" y={transportY} width="100" height={transportHeight} fill={LAYER_COLORS.transport.fill} />
          <rect x="0" y={kegFillTop} width="100" height={kegFillHeight} fill="url(#kegGlassOverlay)" />
        </g>

        <path
          d={kegOutline}
          fill="none"
          stroke="white"
          strokeWidth="1.5"
          className="opacity-80"
          filter="url(#kegGlow)"
        />

        <path d="M15,40 L15,25 C15,20 85,20 85,25 L85,40" fill="none" stroke="white" strokeWidth="1.5" className="opacity-80" />
        <path d="M15,160 L15,175 C15,180 85,180 85,175 L85,160" fill="none" stroke="white" strokeWidth="1.5" className="opacity-80" />

        <path d="M15,70 Q50,75 85,70" fill="none" stroke="white" strokeWidth="1" className="opacity-40" />
        <path d="M15,130 Q50,135 85,130" fill="none" stroke="white" strokeWidth="1" className="opacity-40" />

        <path d="M25,28 L35,28" fill="none" stroke="white" strokeWidth="2" className="opacity-60" strokeLinecap="round" />
        <path d="M65,28 L75,28" fill="none" stroke="white" strokeWidth="2" className="opacity-60" strokeLinecap="round" />
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

  const TrendIcon = trendDirection === 'up' ? TrendingUp :
                    trendDirection === 'down' ? TrendingDown : Minus;

  const ContainerViz = containerType === 'bottle' ? BottleVisualization :
                       containerType === 'can' ? CanVisualization : KegVisualization;

  return (
    <div className={cn(
      'relative overflow-hidden rounded-2xl',
      'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900',
      'border border-slate-700/50',
      className
    )}>
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -right-32 w-64 h-64 bg-lime-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -left-32 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 p-6 lg:p-8">
        <div className="flex flex-col lg:flex-row gap-8">
          <div className="flex flex-col items-center lg:items-start gap-4">
            {productImage ? (
              <img
                src={productImage}
                alt={productName}
                className="w-32 h-32 object-cover rounded-xl border border-white/10"
              />
            ) : (
              <div className="w-32 h-32 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                <span className="text-4xl opacity-50">📦</span>
              </div>
            )}

            <div className="text-center lg:text-left">
              <h1 className="text-xl font-bold text-white">{productName}</h1>
              {sku && <p className="text-sm text-white/50">SKU: {sku}</p>}
              {category && (
                <Badge variant="secondary" className="mt-2 bg-white/10 text-white/70">
                  {category}
                </Badge>
              )}
            </div>
          </div>

          <div className="flex-1 flex flex-col lg:flex-row items-center gap-8">
            <div className="flex flex-col items-center gap-3">
              <div className="w-40 h-72 lg:w-48 lg:h-80">
                <ContainerViz breakdown={carbonBreakdown} className="w-full h-full" />
              </div>

              <TooltipProvider>
                <ToggleGroup
                  type="single"
                  value={containerType}
                  onValueChange={handleContainerChange}
                  className="flex flex-row gap-1 bg-white/10 p-1.5 rounded-lg"
                >
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <ToggleGroupItem
                        value="bottle"
                        className="w-9 h-9 text-lg data-[state=on]:bg-white/20 rounded-md"
                      >
                        🍾
                      </ToggleGroupItem>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">Bottle</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <ToggleGroupItem
                        value="can"
                        className="w-9 h-9 text-lg data-[state=on]:bg-white/20 rounded-md"
                      >
                        🥫
                      </ToggleGroupItem>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">Can</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <ToggleGroupItem
                        value="keg"
                        className="w-9 h-9 text-lg data-[state=on]:bg-white/20 rounded-md"
                      >
                        🛢️
                      </ToggleGroupItem>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">Keg</TooltipContent>
                  </Tooltip>
                </ToggleGroup>
              </TooltipProvider>
            </div>

            <div className="flex-1 text-center lg:text-left">
              <div className="mb-6">
                <p className="text-sm text-white/50 mb-1">Climate Impact</p>
                <div className="flex items-baseline gap-2 justify-center lg:justify-start">
                  <span className="text-5xl lg:text-6xl font-bold text-white tabular-nums">
                    {totalCarbonFootprint.toFixed(2)}
                  </span>
                  <span className="text-lg text-white/70">kg CO₂e</span>
                </div>
                <p className="text-sm text-white/50 mt-1">per {functionalUnit}</p>
              </div>

              {(benchmarkDiff !== null || trend !== undefined) && (
                <div className="flex flex-wrap items-center gap-3 justify-center lg:justify-start mb-6">
                  {benchmarkDiff !== null && (
                    <div className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium',
                      isBetterThanBenchmark
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-red-500/20 text-red-400'
                    )}>
                      {isBetterThanBenchmark ? (
                        <>
                          <TrendingDown className="h-4 w-4" />
                          <span>{Math.abs(benchmarkDiff).toFixed(0)}% better than {benchmarkLabel}</span>
                        </>
                      ) : (
                        <>
                          <TrendingUp className="h-4 w-4" />
                          <span>{Math.abs(benchmarkDiff).toFixed(0)}% above {benchmarkLabel}</span>
                        </>
                      )}
                    </div>
                  )}

                  {trend !== undefined && trendDirection && (
                    <div className={cn(
                      'flex items-center gap-1 px-3 py-1.5 rounded-full text-sm',
                      trendDirection === 'down' ? 'bg-green-500/20 text-green-400' :
                      trendDirection === 'up' ? 'bg-red-500/20 text-red-400' :
                      'bg-gray-500/20 text-gray-400'
                    )}>
                      <TrendIcon className="h-4 w-4" />
                      <span>{trend > 0 ? '+' : ''}{trend}% vs last version</span>
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-wrap gap-2 justify-center lg:justify-start">
                {lcaReportUrl && (
                  <Button variant="secondary" asChild className="bg-white/10 hover:bg-white/20 text-white border-0">
                    <Link href={lcaReportUrl}>
                      <FileText className="h-4 w-4 mr-2" />
                      View Full LCA Report
                    </Link>
                  </Button>
                )}
                {onDownloadReport && (
                  <Button variant="ghost" onClick={onDownloadReport} className="text-white/70 hover:text-white hover:bg-white/10">
                    <Download className="h-4 w-4 mr-2" />
                    Download PDF
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-white/10">
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-sm font-medium text-white/70">Lifecycle Breakdown</h3>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-3.5 w-3.5 text-white/40" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Emissions by lifecycle stage (ISO 14044)</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="flex flex-wrap gap-4">
            {(() => {
              const entries = Object.entries(carbonBreakdown).filter(
                ([key, value]) => !((key === 'endOfLife' || key === 'usePhase') && !value)
              );
              const total = Object.values(carbonBreakdown).reduce((sum, v) => sum + (v || 0), 0);
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
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: config.fill }}
                    />
                    <span className="text-sm text-white/70">{config.label}</span>
                    <span className="text-sm font-medium text-white">{adjusted[idx]}%</span>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      </div>

    </div>
  );
}
