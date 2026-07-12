'use client'

import { useState } from 'react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import {
  FileText,
  Video,
  Link as LinkIcon,
  Code2,
  Eye,
  Download,
  Star,
  Clock,
  User,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { KnowledgeBankItem } from '@/hooks/data/useKnowledgeBank'
import { PartnerAuthorBadge } from '@/components/knowledge-bank/PartnerAuthorBadge'
import { Panel } from '@/components/studio/panel'
import { StateChip } from '@/components/studio/state-chip'
import { supabase } from '@/lib/supabaseClient'
import { toast } from 'sonner'

interface KnowledgeBankCardProps {
  item: KnowledgeBankItem
  onFavoriteToggle?: () => void
}

const contentTypeIcons = {
  document: FileText,
  video: Video,
  link: LinkIcon,
  embedded: Code2,
}

export function KnowledgeBankCard({ item, onFavoriteToggle }: KnowledgeBankCardProps) {
  const [isFavorited, setIsFavorited] = useState(item.is_favorited || false)
  const [isTogglingFavorite, setIsTogglingFavorite] = useState(false)

  const Icon = contentTypeIcons[item.content_type]

  const handleFavoriteToggle = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    try {
      setIsTogglingFavorite(true)
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        toast.error('You must be logged in to favorite items')
        return
      }

      if (isFavorited) {
        const { error } = await supabase
          .from('knowledge_bank_favorites')
          .delete()
          .eq('item_id', item.id)
          .eq('user_id', user.id)

        if (error) throw error
        setIsFavorited(false)
        toast.success('Removed from favorites')
      } else {
        const { error } = await supabase
          .from('knowledge_bank_favorites')
          .insert({
            item_id: item.id,
            user_id: user.id,
          })

        if (error) throw error
        setIsFavorited(true)
        toast.success('Added to favorites')
      }

      onFavoriteToggle?.()
    } catch (error) {
      console.error('Error toggling favorite:', error)
      toast.error('Failed to update favorite')
    } finally {
      setIsTogglingFavorite(false)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  return (
    <Link href={`/knowledge-bank/items/${item.id}`} className="group block h-full">
      <Panel className="flex h-full flex-col gap-3 transition-colors duration-150 ease-studio group-hover:border-room-accent">
        <div className="flex items-start justify-between gap-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-[6px] bg-room/10 text-room-accent">
            <Icon className="h-6 w-6" />
          </div>
          <button
            type="button"
            aria-label={isFavorited ? 'Remove from favourites' : 'Add to favourites'}
            className={cn(
              'inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors disabled:opacity-50',
              isFavorited ? 'text-room-accent' : 'text-studio-dim hover:text-room-accent'
            )}
            onClick={handleFavoriteToggle}
            disabled={isTogglingFavorite}
          >
            <Star className={cn('h-4 w-4', isFavorited && 'fill-current')} />
          </button>
        </div>

        <div>
          <h3 className="font-display font-semibold text-base line-clamp-2 transition-colors group-hover:text-room-accent">
            {item.title}
          </h3>
          {item.description && (
            <p className="text-sm text-studio-dim line-clamp-2 mt-1">
              {item.description}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          {item.organization_id === null && <StateChip>PLATFORM</StateChip>}
          {item.category && <StateChip>{item.category.name}</StateChip>}
          {item.tags?.slice(0, 2).map((tag) => (
            <StateChip key={tag}>{tag}</StateChip>
          ))}
          {item.tags && item.tags.length > 2 && (
            <StateChip>+{item.tags.length - 2}</StateChip>
          )}
        </div>

        <div className="flex items-center gap-4 font-mono text-[11px] text-studio-dim">
          <div className="flex items-center gap-1">
            <Eye className="h-3.5 w-3.5" />
            <span className="tabular-nums">{item.view_count}</span>
          </div>
          {item.content_type === 'document' && (
            <div className="flex items-center gap-1">
              <Download className="h-3.5 w-3.5" />
              <span className="tabular-nums">{item.download_count}</span>
            </div>
          )}
          {item.file_size > 0 && (
            <div className="tabular-nums">{formatFileSize(item.file_size)}</div>
          )}
        </div>

        <div className="mt-auto flex items-center justify-between gap-2 border-t border-studio-hairline pt-3 text-xs text-studio-dim">
          {item.partner_attribution && item.external_author_name ? (
            <PartnerAuthorBadge
              authorName={item.external_author_name}
              photoUrl={item.external_author_photo_url}
              partnerKey={item.partner_attribution}
              variant="compact"
            />
          ) : (
            <div className="flex items-center gap-1.5">
              {item.author?.avatar_url ? (
                <img
                  src={item.author.avatar_url}
                  alt={item.author.full_name || 'Author'}
                  className="h-5 w-5 rounded-full"
                />
              ) : (
                <User className="h-4 w-4" />
              )}
              <span className="truncate max-w-[120px]">
                {item.author?.full_name || (item.organization_id === null ? 'alkatera' : 'Unknown')}
              </span>
            </div>
          )}
          <div className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            <span>
              {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
            </span>
          </div>
        </div>
      </Panel>
    </Link>
  )
}
