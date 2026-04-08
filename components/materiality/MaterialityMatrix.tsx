'use client'

import type { MaterialityTopic } from '@/lib/materiality/topic-library'
import { CATEGORY_COLOURS } from '@/lib/materiality/topic-library'
import { cn } from '@/lib/utils'

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
        <div className="flex-1 text-center text-xs text-stone-500 font-mono uppercase tracking-widest">
          Financial Risk / Opportunity
        </div>
      </div>

      <div className="flex gap-2">
        {/* Y-axis label (rotated) */}
        <div className="w-8 flex-shrink-0 flex items-center justify-center">
          <span
            className="text-xs text-stone-500 font-mono uppercase tracking-widest"
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
            <rect x={0} y={180} width={200} height={180} fill="#f5f5f4" />
            {/* Bottom-right: Financial material only */}
            <rect x={200} y={180} width={200} height={180} fill="#fef3c7" opacity="0.5" />
            {/* Top-left: Impact material only */}
            <rect x={0} y={0} width={200} height={180} fill="#dcfce7" opacity="0.5" />
            {/* Top-right: Double material — both high */}
            <rect x={200} y={0} width={200} height={180} fill="#ccff00" opacity="0.25" />

            {/* Quadrant labels */}
            <text x={100} y={350} textAnchor="middle" fontSize={9} fill="#a8a29e" fontFamily="ui-monospace,monospace">LOW PRIORITY</text>
            <text x={300} y={350} textAnchor="middle" fontSize={9} fill="#92400e" fontFamily="ui-monospace,monospace">FINANCIAL RISK</text>
            <text x={100} y={16} textAnchor="middle" fontSize={9} fill="#166534" fontFamily="ui-monospace,monospace">IMPACT MATERIAL</text>
            <text x={300} y={16} textAnchor="middle" fontSize={9} fill="#1c1917" fontFamily="ui-monospace,monospace" fontWeight="700">DOUBLE MATERIAL</text>

            {/* Axis lines */}
            <line x1={200} y1={0} x2={200} y2={360} stroke="#e7e5e4" strokeWidth={1} strokeDasharray="4 2" />
            <line x1={0} y1={180} x2={400} y2={180} stroke="#e7e5e4" strokeWidth={1} strokeDasharray="4 2" />

            {/* Grid ticks */}
            {[1, 2, 3, 4, 5].map(tick => {
              const x = (tick / 5) * 400 - 40
              const y = 360 - ((tick / 5) * 360 - 36)
              return (
                <g key={tick}>
                  <text x={x} y={355} textAnchor="middle" fontSize={8} fill="#d6d3d1" fontFamily="ui-monospace,monospace">{tick}</text>
                  <text x={4} y={y + 3} textAnchor="start" fontSize={8} fill="#d6d3d1" fontFamily="ui-monospace,monospace">{6 - tick}</text>
                </g>
              )
            })}

            {/* Plotted topics */}
            {plottable.map(topic => {
              const cx = ((topic.financialScore! - 0.5) / 5) * 400
              const cy = 360 - ((topic.impactScore! - 0.5) / 5) * 360
              const isActive = topic.id === activeTopicId
              const colour = CATEGORY_COLOURS[topic.category]

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
                    fill={colour}
                    opacity={isActive ? 0.9 : 0.7}
                    stroke={isActive ? '#1c1917' : 'white'}
                    strokeWidth={isActive ? 2 : 1.5}
                  />
                  {isActive && (
                    <text
                      x={cx}
                      y={cy - 16}
                      textAnchor="middle"
                      fontSize={8}
                      fill="#1c1917"
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
              <p className="text-sm text-stone-400 text-center px-8">
                Mark topics as Material and score them to see them plotted here.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 mt-2 pl-10 flex-wrap">
        {(['environmental', 'social', 'governance'] as const).map(cat => (
          <div key={cat} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: CATEGORY_COLOURS[cat] }} />
            <span className="text-xs text-stone-500 capitalize">{cat}</span>
          </div>
        ))}
        {plottable.length > 0 && (
          <span className="text-xs text-stone-400">{plottable.length} topic{plottable.length !== 1 ? 's' : ''} plotted</span>
        )}
      </div>
    </div>
  )
}
