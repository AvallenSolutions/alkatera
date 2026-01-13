"use client";

import React, { useState } from 'react';
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
};

function BottleVisualization({
  breakdown,
  className,
}: {
  breakdown: CarbonBreakdown;
  className?: string;
}) {
  const total = breakdown.rawMaterials + breakdown.processing + breakdown.packaging + breakdown.transport + (breakdown.endOfLife || 0);

  const getPercentage = (value: number) => total > 0 ? (value / total) * 100 : 0;

  const rawPct = getPercentage(breakdown.rawMaterials);
  const processPct = getPercentage(breakdown.processing);
  const packagingPct = getPercentage(breakdown.packaging);
  const transportPct = getPercentage(breakdown.transport);

  return (
    <div className={cn('relative', className)}>
      <svg viewBox="0 0 120 280" className="w-full h-full drop-shadow-2xl">
        <defs>
          <linearGradient id="bottleGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.3)" />
            <stop offset="50%" stopColor="rgba(255,255,255,0.1)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.05)" />
          </linearGradient>
          <filter id="bottleGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <clipPath id="bottleClip">
            <path d="M45 30 Q45 20 50 15 L50 8 Q50 5 55 5 L65 5 Q70 5 70 8 L70 15 Q75 20 75 30 L80 50 Q85 60 85 80 L85 250 Q85 270 60 270 Q35 270 35 250 L35 80 Q35 60 40 50 Z" />
          </clipPath>
        </defs>

        <g filter="url(#bottleGlow)">
          <path
            d="M45 30 Q45 20 50 15 L50 8 Q50 5 55 5 L65 5 Q70 5 70 8 L70 15 Q75 20 75 30 L80 50 Q85 60 85 80 L85 250 Q85 270 60 270 Q35 270 35 250 L35 80 Q35 60 40 50 Z"
            fill="rgba(30, 30, 30, 0.8)"
            stroke="rgba(255,255,255,0.2)"
            strokeWidth="1"
          />
        </g>

        <g clipPath="url(#bottleClip)">
          <rect x="35" y={270 - (transportPct * 2.2)} width="50" height={transportPct * 2.2}
            fill={LAYER_COLORS.transport.fill} className="transition-all duration-700" />
          <rect x="35" y={270 - (transportPct * 2.2) - (packagingPct * 2.2)} width="50" height={packagingPct * 2.2}
            fill={LAYER_COLORS.packaging.fill} className="transition-all duration-700" />
          <rect x="35" y={270 - (transportPct * 2.2) - (packagingPct * 2.2) - (processPct * 2.2)} width="50" height={processPct * 2.2}
            fill={LAYER_COLORS.processing.fill} className="transition-all duration-700" />
          <rect x="35" y={270 - (transportPct * 2.2) - (packagingPct * 2.2) - (processPct * 2.2) - (rawPct * 2.2)} width="50" height={rawPct * 2.2}
            fill={LAYER_COLORS.rawMaterials.fill} className="transition-all duration-700" />
        </g>

        <path
          d="M45 30 Q45 20 50 15 L50 8 Q50 5 55 5 L65 5 Q70 5 70 8 L70 15 Q75 20 75 30 L80 50 Q85 60 85 80 L85 250 Q85 270 60 270 Q35 270 35 250 L35 80 Q35 60 40 50 Z"
          fill="url(#bottleGradient)"
          stroke="rgba(255,255,255,0.3)"
          strokeWidth="1"
        />
      </svg>

      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="absolute w-2 h-2 rounded-full bg-white/40 animate-bubble"
            style={{
              left: `${Math.random() * 40 - 20}px`,
              animationDelay: `${i * 0.5}s`,
              animationDuration: `${2 + Math.random()}s`,
            }}
          />
        ))}
      </div>
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
  const total = breakdown.rawMaterials + breakdown.processing + breakdown.packaging + breakdown.transport + (breakdown.endOfLife || 0);

  const getPercentage = (value: number) => total > 0 ? (value / total) * 100 : 0;

  const rawPct = getPercentage(breakdown.rawMaterials);
  const processPct = getPercentage(breakdown.processing);
  const packagingPct = getPercentage(breakdown.packaging);
  const transportPct = getPercentage(breakdown.transport);

  return (
    <div className={cn('relative', className)}>
      <svg viewBox="0 0 100 180" className="w-full h-full drop-shadow-2xl">
        <defs>
          <linearGradient id="canGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.4)" />
            <stop offset="30%" stopColor="rgba(255,255,255,0.1)" />
            <stop offset="70%" stopColor="rgba(255,255,255,0.05)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.2)" />
          </linearGradient>
          <clipPath id="canClip">
            <path d="M20 25 Q20 15 50 15 Q80 15 80 25 L80 155 Q80 165 50 165 Q20 165 20 155 Z" />
          </clipPath>
          <filter id="canGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g filter="url(#canGlow)">
          <path
            d="M20 25 Q20 15 50 15 Q80 15 80 25 L80 155 Q80 165 50 165 Q20 165 20 155 Z"
            fill="rgba(40, 40, 40, 0.9)"
            stroke="rgba(255,255,255,0.3)"
            strokeWidth="1"
          />
        </g>

        <g clipPath="url(#canClip)">
          <rect x="20" y={165 - (transportPct * 1.4)} width="60" height={transportPct * 1.4}
            fill={LAYER_COLORS.transport.fill} className="transition-all duration-700" />
          <rect x="20" y={165 - (transportPct * 1.4) - (packagingPct * 1.4)} width="60" height={packagingPct * 1.4}
            fill={LAYER_COLORS.packaging.fill} className="transition-all duration-700" />
          <rect x="20" y={165 - (transportPct * 1.4) - (packagingPct * 1.4) - (processPct * 1.4)} width="60" height={processPct * 1.4}
            fill={LAYER_COLORS.processing.fill} className="transition-all duration-700" />
          <rect x="20" y={165 - (transportPct * 1.4) - (packagingPct * 1.4) - (processPct * 1.4) - (rawPct * 1.4)} width="60" height={rawPct * 1.4}
            fill={LAYER_COLORS.rawMaterials.fill} className="transition-all duration-700" />
        </g>

        <ellipse cx="50" cy="15" rx="30" ry="8" fill="rgba(60,60,60,0.8)" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
        <ellipse cx="50" cy="15" rx="20" ry="5" fill="rgba(80,80,80,0.9)" />
        <circle cx="50" cy="15" r="6" fill="rgba(100,100,100,1)" stroke="rgba(255,255,255,0.2)" />

        <path
          d="M20 25 Q20 15 50 15 Q80 15 80 25 L80 155 Q80 165 50 165 Q20 165 20 155 Z"
          fill="url(#canGradient)"
          stroke="rgba(255,255,255,0.2)"
          strokeWidth="0.5"
        />
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
  const total = breakdown.rawMaterials + breakdown.processing + breakdown.packaging + breakdown.transport + (breakdown.endOfLife || 0);

  const getPercentage = (value: number) => total > 0 ? (value / total) * 100 : 0;

  const rawPct = getPercentage(breakdown.rawMaterials);
  const processPct = getPercentage(breakdown.processing);
  const packagingPct = getPercentage(breakdown.packaging);
  const transportPct = getPercentage(breakdown.transport);

  return (
    <div className={cn('relative', className)}>
      <svg viewBox="0 0 140 200" className="w-full h-full drop-shadow-2xl">
        <defs>
          <linearGradient id="kegGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.3)" />
            <stop offset="50%" stopColor="rgba(255,255,255,0.1)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.2)" />
          </linearGradient>
          <clipPath id="kegClip">
            <path d="M25 40 Q25 25 70 25 Q115 25 115 40 L115 160 Q115 175 70 175 Q25 175 25 160 Z" />
          </clipPath>
          <filter id="kegGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g filter="url(#kegGlow)">
          <path
            d="M25 40 Q25 25 70 25 Q115 25 115 40 L115 160 Q115 175 70 175 Q25 175 25 160 Z"
            fill="rgba(50, 50, 50, 0.9)"
            stroke="rgba(200,200,200,0.4)"
            strokeWidth="2"
          />
        </g>

        <g clipPath="url(#kegClip)">
          <rect x="25" y={175 - (transportPct * 1.35)} width="90" height={transportPct * 1.35}
            fill={LAYER_COLORS.transport.fill} className="transition-all duration-700" />
          <rect x="25" y={175 - (transportPct * 1.35) - (packagingPct * 1.35)} width="90" height={packagingPct * 1.35}
            fill={LAYER_COLORS.packaging.fill} className="transition-all duration-700" />
          <rect x="25" y={175 - (transportPct * 1.35) - (packagingPct * 1.35) - (processPct * 1.35)} width="90" height={processPct * 1.35}
            fill={LAYER_COLORS.processing.fill} className="transition-all duration-700" />
          <rect x="25" y={175 - (transportPct * 1.35) - (packagingPct * 1.35) - (processPct * 1.35) - (rawPct * 1.35)} width="90" height={rawPct * 1.35}
            fill={LAYER_COLORS.rawMaterials.fill} className="transition-all duration-700" />
        </g>

        <ellipse cx="70" cy="25" rx="45" ry="12" fill="rgba(60,60,60,0.8)" stroke="rgba(200,200,200,0.4)" strokeWidth="2" />
        <ellipse cx="70" cy="22" rx="15" ry="6" fill="rgba(80,80,80,0.9)" />
        <rect x="62" y="10" width="16" height="12" rx="3" fill="rgba(100,100,100,1)" stroke="rgba(200,200,200,0.3)" />

        <line x1="25" y1="55" x2="115" y2="55" stroke="rgba(150,150,150,0.5)" strokeWidth="3" />
        <line x1="25" y1="145" x2="115" y2="145" stroke="rgba(150,150,150,0.5)" strokeWidth="3" />

        <path
          d="M25 40 Q25 25 70 25 Q115 25 115 40 L115 160 Q115 175 70 175 Q25 175 25 160 Z"
          fill="url(#kegGradient)"
          stroke="rgba(200,200,200,0.3)"
          strokeWidth="1"
        />
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
            <div className="relative w-40 h-72 lg:w-48 lg:h-80">
              <ContainerViz breakdown={carbonBreakdown} className="w-full h-full" />

              <div className="absolute -right-2 top-4 flex flex-col gap-2">
                <TooltipProvider>
                  <ToggleGroup
                    type="single"
                    value={containerType}
                    onValueChange={handleContainerChange}
                    className="flex flex-col gap-1 bg-white/10 p-1 rounded-lg"
                  >
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <ToggleGroupItem
                          value="bottle"
                          className="w-8 h-8 text-lg data-[state=on]:bg-white/20"
                        >
                          🍾
                        </ToggleGroupItem>
                      </TooltipTrigger>
                      <TooltipContent side="right">Bottle</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <ToggleGroupItem
                          value="can"
                          className="w-8 h-8 text-lg data-[state=on]:bg-white/20"
                        >
                          🥫
                        </ToggleGroupItem>
                      </TooltipTrigger>
                      <TooltipContent side="right">Can</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <ToggleGroupItem
                          value="keg"
                          className="w-8 h-8 text-lg data-[state=on]:bg-white/20"
                        >
                          🛢️
                        </ToggleGroupItem>
                      </TooltipTrigger>
                      <TooltipContent side="right">Keg</TooltipContent>
                    </Tooltip>
                  </ToggleGroup>
                </TooltipProvider>
              </div>
            </div>

            <div className="flex-1 text-center lg:text-left">
              <div className="mb-6">
                <p className="text-sm text-white/50 mb-1">Carbon Footprint</p>
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
            {Object.entries(carbonBreakdown).map(([key, value]) => {
              if (key === 'endOfLife' && !value) return null;
              const config = LAYER_COLORS[key as keyof typeof LAYER_COLORS];
              const total = Object.values(carbonBreakdown).reduce((sum, v) => sum + (v || 0), 0);
              const percentage = total > 0 ? (value / total) * 100 : 0;

              return (
                <div key={key} className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: config.fill }}
                  />
                  <span className="text-sm text-white/70">{config.label}</span>
                  <span className="text-sm font-medium text-white">{percentage.toFixed(0)}%</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes bubble {
          0% { transform: translateY(0) scale(1); opacity: 0.6; }
          100% { transform: translateY(-100px) scale(0); opacity: 0; }
        }
        .animate-bubble {
          animation: bubble 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
