'use client'

import { cn } from '@/lib/utils'
import type { MaterialityTopic, TopicStatus } from '@/lib/materiality/topic-library'
import { CATEGORY_COLOURS, STATUS_LABELS } from '@/lib/materiality/topic-library'

interface TopicCardProps {
  topic: MaterialityTopic
  onStatusChange: (id: string, status: TopicStatus) => void
}

const STATUS_OPTIONS: { value: TopicStatus; label: string; description: string }[] = [
  { value: 'material', label: 'Material', description: 'This topic is important for your reporting' },
  { value: 'monitoring', label: 'Monitoring', description: 'Worth watching but not yet material' },
  { value: 'not_material', label: 'Not Material', description: 'Not relevant to your business' },
]

const STATUS_STYLES: Record<TopicStatus, string> = {
  material: 'bg-lime-100 text-lime-800 border-lime-300 dark:bg-lime-900/40 dark:text-lime-400 dark:border-lime-700',
  monitoring: 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-900/40 dark:text-amber-400 dark:border-amber-700',
  not_material: 'bg-muted text-muted-foreground border-border',
}

export function TopicCard({ topic, onStatusChange }: TopicCardProps) {
  const categoryColour = CATEGORY_COLOURS[topic.category]
  const currentStatus = topic.status || 'not_material'

  return (
    <div
      className={cn(
        'rounded-xl border bg-card p-4 transition-all',
        currentStatus === 'material' ? 'border-lime-300 dark:border-lime-700 shadow-sm' : 'border-border',
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <span
            className="inline-block w-2 h-2 rounded-full flex-shrink-0 mt-1"
            style={{ background: categoryColour }}
          />
          <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
            {topic.category}
          </span>
        </div>
        {(topic.esrsReference || topic.griReference) && (
          <span className="text-xs font-mono text-muted-foreground shrink-0">
            {topic.esrsReference || topic.griReference}
          </span>
        )}
      </div>

      {/* Title + description */}
      <h3 className="font-semibold text-sm mb-1">{topic.name}</h3>
      <p className="text-xs text-muted-foreground leading-relaxed mb-3">{topic.description}</p>

      {/* Status toggle */}
      <div className="flex gap-1">
        {STATUS_OPTIONS.map(opt => (
          <button
            key={opt.value}
            title={opt.description}
            onClick={() => onStatusChange(topic.id, opt.value)}
            className={cn(
              'flex-1 text-xs font-medium py-1 px-2 rounded-md border transition-colors',
              currentStatus === opt.value
                ? STATUS_STYLES[opt.value]
                : 'bg-transparent text-muted-foreground border-border hover:border-muted-foreground hover:text-foreground',
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}
