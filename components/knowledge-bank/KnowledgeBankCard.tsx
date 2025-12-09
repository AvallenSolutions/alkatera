'use client'

import { useState } from 'react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  FileText,
  Video,
  Link as LinkIcon,
  Eye,
  Download,
  Star,
  Clock,
  User,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { KnowledgeBankItem } from '@/hooks/data/useKnowledgeBank'
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
  embedded: FileText,
}

const contentTypeColors = {
  document: 'bg-blue-500/10 text-blue-500',
  video: 'bg-purple-500/10 text-purple-500',
  link: 'bg-green-500/10 text-green-500',
  embedded: 'bg-orange-500/10 text-orange-500',
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
    <Link href={`/knowledge-bank/items/${item.id}`}>
      <Card className="group h-full transition-all hover:shadow-lg hover:border-neon-lime/50">
        <CardHeader className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className={cn(
              'flex h-12 w-12 items-center justify-center rounded-lg transition-colors',
              contentTypeColors[item.content_type]
            )}>
              <Icon className="h-6 w-6" />
            </div>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                'h-8 w-8 p-0 transition-colors',
                isFavorited ? 'text-yellow-500 hover:text-yellow-600' : 'text-muted-foreground hover:text-yellow-500'
              )}
              onClick={handleFavoriteToggle}
              disabled={isTogglingFavorite}
            >
              <Star className={cn('h-4 w-4', isFavorited && 'fill-current')} />
            </Button>
          </div>

          <div>
            <h3 className="font-semibold text-base line-clamp-2 group-hover:text-neon-lime transition-colors">
              {item.title}
            </h3>
            {item.description && (
              <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                {item.description}
              </p>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {item.category && (
              <Badge variant="secondary" className="text-xs">
                {item.category.name}
              </Badge>
            )}
            {item.tags?.slice(0, 2).map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
            {item.tags && item.tags.length > 2 && (
              <Badge variant="outline" className="text-xs">
                +{item.tags.length - 2}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Eye className="h-3.5 w-3.5" />
              <span>{item.view_count}</span>
            </div>
            {item.content_type === 'document' && (
              <div className="flex items-center gap-1">
                <Download className="h-3.5 w-3.5" />
                <span>{item.download_count}</span>
              </div>
            )}
            {item.file_size > 0 && (
              <div className="text-xs">
                {formatFileSize(item.file_size)}
              </div>
            )}
          </div>
        </CardContent>

        <CardFooter className="flex items-center justify-between text-xs text-muted-foreground border-t pt-3">
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
              {item.author?.full_name || 'Unknown'}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            <span>
              {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
            </span>
          </div>
        </CardFooter>
      </Card>
    </Link>
  )
}
