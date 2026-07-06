'use client'

import React from 'react'
import {
  Bath,
  BatteryCharging,
  Car,
  Coffee,
  Droplets,
  Goal,
  Home,
  Info,
  Map,
  PawPrint,
  Plane,
  Shirt,
  Smartphone,
  Sparkles,
  Square,
  Trash2,
  User,
  Waves,
  Wine,
  type LucideIcon,
} from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { formatCount, relatable, type MetricKind } from '@/lib/relatable'

interface RelatableMetricProps {
  kind: MetricKind
  /** kg CO₂e (when kind === 'co2e') or kg of physical material (when kind === 'waste'). */
  valueKg?: number
  /** m³ of water (when kind === 'water'). */
  valueM3?: number
  /** kWh of energy (when kind === 'energy'). */
  valueKwh?: number
  /** hectares of land (when kind === 'land'). */
  valueHa?: number
  /** Max chips to render. Default 3. */
  max?: number
  /** Use light-on-dark colour palette (e.g. for the dark hero card). */
  variant?: 'light' | 'dark'
  className?: string
}

const ICONS: Record<string, LucideIcon> = {
  Bath,
  BatteryCharging,
  Car,
  Coffee,
  Droplets,
  Goal,
  Home,
  Map,
  PawPrint,
  Plane,
  Shirt,
  Smartphone,
  Sparkles,
  Square,
  Trash2,
  User,
  Waves,
  Wine,
}

function valueFor(props: RelatableMetricProps): number {
  switch (props.kind) {
    case 'co2e':
    case 'waste':
      return props.valueKg ?? 0
    case 'water':
      return props.valueM3 ?? 0
    case 'energy':
      return props.valueKwh ?? 0
    case 'land':
      return props.valueHa ?? 0
  }
}

export function RelatableMetric(props: RelatableMetricProps) {
  const { kind, max = 3, variant = 'dark', className } = props
  const value = valueFor(props)
  const comparisons = React.useMemo(
    () => relatable(kind, value, { max }),
    [kind, value, max],
  )

  if (comparisons.length === 0) return null

  const chipBg = variant === 'light'
    ? 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
    : 'bg-white/10 border-white/15 text-slate-100'

  const accent = variant === 'light' ? 'text-studio-good' : 'text-studio-cream'
  const muted = variant === 'light' ? 'text-slate-500 dark:text-slate-400' : 'text-slate-300/80'
  const trigger = variant === 'light' ? 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300' : 'text-slate-400 hover:text-slate-200'

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <span className={cn('text-xs font-medium uppercase tracking-wider', muted)}>
        That's like
      </span>
      {comparisons.map((c, idx) => {
        const Icon = ICONS[c.icon] ?? Sparkles
        return (
          <span
            key={idx}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs',
              chipBg,
            )}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden />
            <span className={cn('font-semibold tabular-nums', accent)}>
              {formatCount(c.count)}
            </span>
            <span>{c.label}</span>
          </span>
        )
      })}
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className={cn('inline-flex h-6 w-6 items-center justify-center rounded-full transition-colors', trigger)}
              aria-label="How these comparisons are calculated"
            >
              <Info className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-sm space-y-2">
            <p className="text-xs font-medium">How we calculate these</p>
            <p className="text-xs text-muted-foreground">
              We translate the figure into familiar anchors using UK-published
              conversion factors. Sources for the comparisons shown:
            </p>
            <ul className="space-y-1 text-[11px] text-muted-foreground">
              {comparisons.map((c, idx) => (
                <li key={idx} className="leading-snug">
                  <span className="font-medium text-foreground">{c.label}:</span>{' '}
                  {c.source}
                </li>
              ))}
            </ul>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  )
}
