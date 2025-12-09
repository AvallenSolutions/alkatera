'use client'

import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  FileText,
  Video,
  Link as LinkIcon,
  Clock,
  Eye,
} from 'lucide-react'
import { cn } from '@/lib/utils'
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
  embedded: FileText,
}

export function RecentActivity({
  title,
  items,
  icon: TitleIcon = Clock,
  emptyMessage = 'No items yet',
}: RecentActivityProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <TitleIcon className="h-5 w-5 text-neon-lime" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            {emptyMessage}
          </p>
        ) : (
          <div className="space-y-3">
            {items.map((item) => {
              const Icon = contentTypeIcons[item.content_type]

              return (
                <Link
                  key={item.id}
                  href={`/knowledge-bank/items/${item.id}`}
                  className="flex items-start gap-3 p-3 rounded-lg hover:bg-secondary/50 transition-colors group"
                >
                  <div className="flex-shrink-0 mt-0.5">
                    <Icon className="h-4 w-4 text-muted-foreground group-hover:text-neon-lime transition-colors" />
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <h4 className="text-sm font-medium line-clamp-1 group-hover:text-neon-lime transition-colors">
                      {item.title}
                    </h4>
                    <div className="flex items-center gap-2 flex-wrap">
                      {item.category && (
                        <Badge variant="secondary" className="text-xs">
                          {item.category.name}
                        </Badge>
                      )}
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Eye className="h-3 w-3" />
                        <span>{item.view_count}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
