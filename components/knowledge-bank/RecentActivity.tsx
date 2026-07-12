'use client'

import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import {
  FileText,
  Video,
  Link as LinkIcon,
  Code2,
  Clock,
  Eye,
} from 'lucide-react'
import { Panel } from '@/components/studio/panel'
import { Eyebrow } from '@/components/studio/eyebrow'
import { StateChip } from '@/components/studio/state-chip'
import { KnowledgeBankItem } from '@/hooks/data/useKnowledgeBank'

interface RecentActivityProps {
  title: string
  items: KnowledgeBankItem[]
  icon?: React.ComponentType<{ className?: string }>
  emptyMessage?: string
}

const contentTypeIcons = {
  document: FileText,
  video: Video,
  link: LinkIcon,
  embedded: Code2,
}

export function RecentActivity({
  title,
  items,
  icon: TitleIcon = Clock,
  emptyMessage = 'No items yet',
}: RecentActivityProps) {
  return (
    <Panel>
      <div className="mb-4 flex items-center gap-2">
        <TitleIcon className="h-4 w-4 text-room-accent" />
        <Eyebrow tone="dim">{title}</Eyebrow>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-studio-dim text-center py-8">
          {emptyMessage}
        </p>
      ) : (
        <div className="-mx-2">
          {items.map((item) => {
            const Icon = contentTypeIcons[item.content_type]

            return (
              <Link
                key={item.id}
                href={`/knowledge-bank/items/${item.id}`}
                className="group flex items-start gap-3 rounded-[6px] px-2 py-2.5 transition-colors hover:bg-studio-ink/[0.03]"
              >
                <div className="flex-shrink-0 mt-0.5">
                  <Icon className="h-4 w-4 text-studio-dim transition-colors group-hover:text-room-accent" />
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <h4 className="font-display text-sm font-medium line-clamp-1 transition-colors group-hover:text-room-accent">
                    {item.title}
                  </h4>
                  <div className="flex items-center gap-3 flex-wrap">
                    {item.category && <StateChip>{item.category.name}</StateChip>}
                    <div className="flex items-center gap-1 font-mono text-[11px] text-studio-dim">
                      <Eye className="h-3 w-3" />
                      <span className="tabular-nums">{item.view_count}</span>
                    </div>
                    <span className="font-mono text-[11px] text-studio-dim">
                      {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                    </span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </Panel>
  )
}
