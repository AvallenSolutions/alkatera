'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { MaterialityTopic } from '@/lib/materiality/topic-library'
import { CATEGORY_COLOURS, getTopicMaterialityScore } from '@/lib/materiality/topic-library'
import { ChevronUp, ChevronDown, Star } from 'lucide-react'

interface PriorityConfirmationProps {
  /** All material topics (status === 'material') with scores set */
  materialTopics: MaterialityTopic[]
  /** Current ordered priority list (topic IDs) */
  priorityOrder: string[]
  onChange: (newOrder: string[]) => void
}

/**
 * Step 3 of the materiality setup: review and reorder the priority topic list.
 *
 * The system suggests the top 5-8 topics by combined materiality score
 * (impactScore × financialScore). The user can move items up/down to
 * reflect qualitative judgement.
 */
export function PriorityConfirmation({ materialTopics, priorityOrder, onChange }: PriorityConfirmationProps) {
  const [expanded, setExpanded] = useState<string | null>(null)

  // Build ordered list from priorityOrder, falling back to score-sorted order
  const topicMap = Object.fromEntries(materialTopics.map(t => [t.id, t]))
  const orderedTopics = priorityOrder
    .map(id => topicMap[id])
    .filter(Boolean)

  // Non-priority material topics (scored but not in priority list)
  const remainingTopics = materialTopics.filter(t => !priorityOrder.includes(t.id))

  function moveUp(index: number) {
    if (index === 0) return
    const next = [...priorityOrder]
    ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
    onChange(next)
  }

  function moveDown(index: number) {
    if (index === priorityOrder.length - 1) return
    const next = [...priorityOrder]
    ;[next[index], next[index + 1]] = [next[index + 1], next[index]]
    onChange(next)
  }

  function addToPriority(topicId: string) {
    onChange([...priorityOrder, topicId])
  }

  function removeFromPriority(topicId: string) {
    onChange(priorityOrder.filter(id => id !== topicId))
  }

  return (
    <div>
      <p className="text-sm text-muted-foreground mb-4">
        The topics below are ranked by combined materiality score. Drag or use the arrows to reflect your organisation's
        strategic priorities. The order here determines how your sustainability report is structured.
      </p>

      {orderedTopics.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No material topics scored yet. Go back to Step 2 and score your material topics.
        </div>
      ) : (
        <div className="space-y-2">
          {orderedTopics.map((topic, index) => {
            const score = getTopicMaterialityScore(topic)
            const colour = CATEGORY_COLOURS[topic.category]
            const isExpanded = expanded === topic.id

            return (
              <div
                key={topic.id}
                className={cn(
                  'rounded-xl border bg-card transition-all',
                  index < 5 ? 'border-lime-300 dark:border-lime-700' : 'border-border',
                )}
              >
                <div className="flex items-center gap-3 p-3">
                  {/* Rank badge */}
                  <div className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0',
                    index < 3 ? 'bg-[#ccff00] text-stone-900' : 'bg-muted text-muted-foreground',
                  )}>
                    {index + 1}
                  </div>

                  {/* Topic info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: colour }} />
                      <span className="text-sm font-medium truncate">{topic.name}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Impact: {topic.impactScore}/5 · Financial: {topic.financialScore}/5 · Combined: {score}
                    </div>
                  </div>

                  {/* Controls */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => setExpanded(isExpanded ? null : topic.id)}
                      className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded"
                    >
                      {isExpanded ? 'Less' : 'Rationale'}
                    </button>
                    <button
                      onClick={() => moveUp(index)}
                      disabled={index === 0}
                      className="p-1 rounded hover:bg-muted disabled:opacity-30"
                      title="Move up"
                    >
                      <ChevronUp className="w-4 h-4 text-muted-foreground" />
                    </button>
                    <button
                      onClick={() => moveDown(index)}
                      disabled={index === orderedTopics.length - 1}
                      className="p-1 rounded hover:bg-muted disabled:opacity-30"
                      title="Move down"
                    >
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    </button>
                    <button
                      onClick={() => removeFromPriority(topic.id)}
                      className="p-1 rounded hover:bg-red-950/20 text-muted-foreground hover:text-red-400"
                      title="Remove from priority list"
                    >
                      ×
                    </button>
                  </div>
                </div>

                {/* Expanded rationale */}
                {isExpanded && topic.rationale && (
                  <div className="px-3 pb-3 pt-0">
                    <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3 border border-border">
                      <span className="font-medium text-foreground">Rationale: </span>
                      {topic.rationale}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Non-priority material topics */}
      {remainingTopics.length > 0 && (
        <div className="mt-6">
          <h4 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-2">
            Other Material Topics (not in priority list)
          </h4>
          <div className="space-y-1.5">
            {remainingTopics.map(topic => (
              <div key={topic.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-border bg-muted/30">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: CATEGORY_COLOURS[topic.category] }} />
                <span className="text-sm text-muted-foreground flex-1">{topic.name}</span>
                <button
                  onClick={() => addToPriority(topic.id)}
                  className="text-xs text-muted-foreground hover:text-lime-500 flex items-center gap-1"
                >
                  <Star className="w-3 h-3" />
                  Add to priority
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
