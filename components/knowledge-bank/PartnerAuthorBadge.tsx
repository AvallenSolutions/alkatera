'use client'

import { Badge } from '@/components/ui/badge'
import { Handshake } from 'lucide-react'

interface PartnerAuthorBadgeProps {
  authorName: string
  photoUrl?: string | null
  /** Compact mode for card footer, full mode for detail pages */
  variant?: 'compact' | 'full'
  bio?: string | null
}

const PARTNER_LABELS: Record<string, string> = {
  impact_focus: 'Impact Focus',
}

export function PartnerAuthorBadge({ authorName, photoUrl, variant = 'compact', bio }: PartnerAuthorBadgeProps) {
  if (variant === 'compact') {
    return (
      <div className="flex items-center gap-1.5">
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={authorName}
            className="h-5 w-5 rounded-full object-cover"
          />
        ) : (
          <Handshake className="h-4 w-4 text-emerald-600" />
        )}
        <span className="truncate max-w-[120px]">{authorName}</span>
        <Badge variant="outline" className="text-[10px] px-1 py-0 border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-400">
          Partner
        </Badge>
      </div>
    )
  }

  // Full variant for detail pages
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-800/30">
      <div className="shrink-0">
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={authorName}
            className="h-10 w-10 rounded-full object-cover"
          />
        ) : (
          <div className="h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
            <Handshake className="h-5 w-5 text-emerald-600" />
          </div>
        )}
      </div>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{authorName}</span>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-400">
            Impact Focus
          </Badge>
        </div>
        {bio && <p className="text-xs text-muted-foreground">{bio}</p>}
      </div>
    </div>
  )
}
