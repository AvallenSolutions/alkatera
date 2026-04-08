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

// Active state: solid coloured pill
const STATUS_ACTIVE: Record<TopicStatus, string> = {
  material:     'bg-lime-500 text-white border-lime-500 dark:bg-lime-500 dark:text-white dark:border-lime-500',
  monitoring:   'bg-amber-500 text-white border-amber-500 dark:bg-amber-500 dark:text-white dark:border-amber-500',
  not_material: 'bg-slate-500 text-white border-slate-500 dark:bg-slate-600 dark:text-white dark:border-slate-600',
}

export function TopicCard({ topic, onStatusChange }: TopicCardProps) {
  const categoryColour = CATEGORY_COLOURS[topic.category]
  const currentStatus = topic.status || 'not_material'

  return (
    <div
      className="rounded-xl border-l-4 border border-border bg-card p-4 transition-all hover:shadow-sm"
      style={{ borderLeftColor: categoryColour }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <span
            className="text-xs font-semibold uppercase tracking-widest"
            style={{ color: categoryColour }}
          >
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
      <div className="flex gap-1.5">
        {STATUS_OPTIONS.map(opt => (
          <button
            key={opt.value}
            title={opt.description}
            onClick={() => onStatusChange(topic.id, opt.value)}
            className={cn(
              'flex-1 text-xs font-semibold py-1.5 px-2 rounded-lg border transition-all',
              currentStatus === opt.value
                ? STATUS_ACTIVE[opt.value]
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
