'use client'

import { Handshake } from 'lucide-react'
import { StateChip } from '@/components/studio/state-chip'

interface PartnerAuthorBadgeProps {
  authorName: string
  photoUrl?: string | null
  /** Compact mode for card footer, full mode for detail pages */
  variant?: 'compact' | 'full'
  bio?: string | null
  /** The partner_attribution key; resolves to a data-driven credit label. */
  partnerKey?: string | null
}

const PARTNER_LABELS: Record<string, string> = {
  impact_focus: 'Impact Focus',
}

function creditLabel(partnerKey?: string | null): string {
  return (partnerKey && PARTNER_LABELS[partnerKey]) || 'Partner'
}

export function PartnerAuthorBadge({
  authorName,
  photoUrl,
  variant = 'compact',
  bio,
  partnerKey,
}: PartnerAuthorBadgeProps) {
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
          <Handshake className="h-4 w-4 text-room-accent" />
        )}
        <span className="truncate max-w-[120px]">{authorName}</span>
        <StateChip>PARTNER</StateChip>
      </div>
    )
  }

  // Full variant for detail pages
  return (
    <div className="flex items-start gap-3 rounded-[6px] border border-studio-hairline bg-studio-cream p-3">
      <div className="shrink-0">
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={authorName}
            className="h-10 w-10 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-room/10">
            <Handshake className="h-5 w-5 text-room-accent" />
          </div>
        )}
      </div>
      <div className="min-w-0 space-y-1">
        <div className="font-mono text-[9.5px] font-bold uppercase tracking-[0.2em] text-room-accent">
          {creditLabel(partnerKey)}
        </div>
        <div className="flex items-center gap-2">
          <span className="font-display text-sm font-semibold text-foreground">{authorName}</span>
          <StateChip>PARTNER</StateChip>
        </div>
        {bio && <p className="text-xs text-studio-dim">{bio}</p>}
      </div>
    </div>
  )
}
