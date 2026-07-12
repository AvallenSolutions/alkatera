'use client'

import type { MaterialityTopic } from '@/lib/materiality/topic-library'
import { cn } from '@/lib/utils'

// Studio palette literals (SVG needs concrete values). These equal the design tokens.
const CREAM = '#F2F1EA'
const HAIRLINE = '#D9D6CB'
const DIM = '#6F6F68'
const INK = '#1A1B1D'
// The room's one saturated colour, read from the live CSS variable.
const ROOM = 'rgb(var(--room-accent-rgb))'

// Short mono tag per ESG category — replaces the old colour-coded legend dots.
const CATEGORY_TAG: Record<MaterialityTopic['category'], string> = {
  environmental: 'ENV',
  social: 'SOC',
  governance: 'GOV',
}

interface MaterialityMatrixProps {
  topics: MaterialityTopic[]
  /** Topic currently being hovered/selected — highlighted in the matrix */
  activeTopicId?: string
  onTopicClick?: (topic: MaterialityTopic) => void
  className?: string
}

/**
 * Interactive 2x2 double-materiality matrix.
 *
 * X axis: Financial Risk/Opportunity Score (1-5, left=low, right=high)
 * Y axis: Impact Score (1-5, bottom=low, top=high)
 *
 * Only plots topics with status === 'material' and both scores set.
 */
export function MaterialityMatrix({ topics, activeTopicId, onTopicClick, className }: MaterialityMatrixProps) {
  const plottable = topics.filter(
    t => t.status === 'material' && t.impactScore && t.financialScore,
  )

  return (
    <div className={cn('select-none', className)}>
      {/* Axis labels */}
      <div className="flex items-center gap-2 mb-1">
        <div className="w-8 flex-shrink-0" /> {/* spacer for Y-axis label */}
        <div className="flex-1 text-center text-xs text-studio-dim font-mono uppercase tracking-widest">
          Financial Risk / Opportunity
        </div>
      </div>

      <div className="flex gap-2">
        {/* Y-axis label (rotated) */}
        <div className="w-8 flex-shrink-0 flex items-center justify-center">
          <span
            className="text-xs text-studio-dim font-mono uppercase tracking-widest"
            style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
          >
            Impact on People &amp; Planet
          </span>
        </div>

        {/* Matrix grid */}
        <div className="flex-1 relative">
          <svg viewBox="0 0 400 360" className="w-full">
            {/* Quadrant backgrounds */}
            {/* Bottom-left: Low-Low */}
            <rect x={0} y={180} width={200} height={180} fill={CREAM} />
            {/* Bottom-right: Financial material only */}
            <rect x={200} y={180} width={200} height={180} fill={HAIRLINE} opacity="0.35" />
            {/* Top-left: Impact material only */}
            <rect x={0} y={0} width={200} height={180} fill={HAIRLINE} opacity="0.35" />
            {/* Top-right: Double material, both high — the one saturated block */}
            <rect x={200} y={0} width={200} height={180} fill={ROOM} opacity="0.12" />

            {/* Quadrant labels */}
            <text x={100} y={350} textAnchor="middle" fontSize={9} fill={DIM} fontFamily="ui-monospace,monospace">LOW PRIORITY</text>
            <text x={300} y={350} textAnchor="middle" fontSize={9} fill={DIM} fontFamily="ui-monospace,monospace">FINANCIAL RISK</text>
            <text x={100} y={16} textAnchor="middle" fontSize={9} fill={DIM} fontFamily="ui-monospace,monospace">IMPACT MATERIAL</text>
            <text x={300} y={16} textAnchor="middle" fontSize={9} fill={ROOM} fontFamily="ui-monospace,monospace" fontWeight="700">DOUBLE MATERIAL</text>

            {/* Axis lines */}
            <line x1={200} y1={0} x2={200} y2={360} stroke={HAIRLINE} strokeWidth={1} strokeDasharray="4 2" />
            <line x1={0} y1={180} x2={400} y2={180} stroke={HAIRLINE} strokeWidth={1} strokeDasharray="4 2" />

            {/* Grid ticks */}
            {[1, 2, 3, 4, 5].map(tick => {
              const x = (tick / 5) * 400 - 40
              const y = 360 - ((tick / 5) * 360 - 36)
              return (
                <g key={tick}>
                  <text x={x} y={355} textAnchor="middle" fontSize={8} fill={HAIRLINE} fontFamily="ui-monospace,monospace">{tick}</text>
                  <text x={4} y={y + 3} textAnchor="start" fontSize={8} fill={HAIRLINE} fontFamily="ui-monospace,monospace">{6 - tick}</text>
                </g>
              )
            })}

            {/* Plotted topics — all in the room's one colour; position carries the meaning */}
            {plottable.map(topic => {
              const cx = ((topic.financialScore! - 0.5) / 5) * 400
              const cy = 360 - ((topic.impactScore! - 0.5) / 5) * 360
              const isActive = topic.id === activeTopicId

              return (
                <g
                  key={topic.id}
                  className="cursor-pointer"
                  onClick={() => onTopicClick?.(topic)}
                >
                  <circle
                    cx={cx}
                    cy={cy}
                    r={isActive ? 12 : 8}
                    fill={ROOM}
                    opacity={isActive ? 0.95 : 0.6}
                    stroke={isActive ? INK : CREAM}
                    strokeWidth={isActive ? 2 : 1.5}
                  />
                  {isActive && (
                    <text
                      x={cx}
                      y={cy - 16}
                      textAnchor="middle"
                      fontSize={8}
                      fill={INK}
                      fontFamily="Inter,system-ui,sans-serif"
                      fontWeight="600"
                    >
                      {topic.name.length > 20 ? topic.name.slice(0, 18) + '…' : topic.name}
                    </text>
                  )}
                </g>
              )
            })}
          </svg>

          {/* No topics placeholder */}
          {plottable.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <p className="text-sm text-muted-foreground text-center px-8">
                Mark topics as Material and score them to see them plotted here.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Legend — categories as mono tags, not colour dots */}
      <div className="flex gap-4 mt-2 pl-10 flex-wrap items-center">
        {(['environmental', 'social', 'governance'] as const).map(cat => (
          <span key={cat} className="font-mono text-[9.5px] font-bold uppercase tracking-[0.2em] text-studio-dim">
            {CATEGORY_TAG[cat]} · <span className="capitalize font-normal tracking-normal">{cat}</span>
          </span>
        ))}
        {plottable.length > 0 && (
          <span className="text-xs text-studio-dim">{plottable.length} topic{plottable.length !== 1 ? 's' : ''} plotted</span>
        )}
      </div>
    </div>
  )
}
