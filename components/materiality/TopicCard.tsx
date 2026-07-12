'use client'

import { cn } from '@/lib/utils'
import type { MaterialityTopic, TopicStatus } from '@/lib/materiality/topic-library'

interface TopicCardProps {
  topic: MaterialityTopic
  onStatusChange: (id: string, status: TopicStatus) => void
}

const STATUS_OPTIONS: { value: TopicStatus; label: string; description: string }[] = [
  { value: 'material', label: 'Material', description: 'This topic is important for your reporting' },
  { value: 'monitoring', label: 'Monitoring', description: 'Worth watching but not yet material' },
  { value: 'not_material', label: 'Not Material', description: 'Not relevant to your business' },
]

// Short mono tag per ESG category — replaces the old inline CATEGORY_COLOURS dot.
const CATEGORY_TAG: Record<MaterialityTopic['category'], string> = {
  environmental: 'ENV',
  social: 'SOC',
  governance: 'GOV',
}

// Selected toggle: a single working-tone fill, cream text (never colour on colour).
const STATUS_ACTIVE: Record<TopicStatus, string> = {
  material:     'bg-studio-good text-studio-cream border-studio-good',
  monitoring:   'bg-studio-attention text-studio-cream border-studio-attention',
  not_material: 'bg-studio-dim text-studio-cream border-studio-dim',
}

export function TopicCard({ topic, onStatusChange }: TopicCardProps) {
  const currentStatus = topic.status || 'not_material'

  return (
    <div className="rounded-[6px] border border-studio-hairline bg-studio-cream p-4 transition-colors hover:border-foreground/40">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="font-mono text-[9.5px] font-bold uppercase tracking-[0.2em] text-studio-dim">
          {CATEGORY_TAG[topic.category]} · {topic.category}
        </span>
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
              'flex-1 text-xs font-semibold py-1.5 px-2 rounded-[6px] border transition-colors',
              currentStatus === opt.value
                ? STATUS_ACTIVE[opt.value]
                : 'bg-transparent text-muted-foreground border-studio-hairline hover:border-muted-foreground hover:text-foreground',
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}
