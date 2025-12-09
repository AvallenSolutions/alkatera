'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ChevronLeft,
  Download,
  Eye,
  Star,
  User,
  Calendar,
  FileText,
  Video,
  Link as LinkIcon,
  ExternalLink,
} from 'lucide-react'
import { useKnowledgeBankItem, KnowledgeBankItem } from '@/hooks/data/useKnowledgeBank'
import { supabase } from '@/lib/supabaseClient'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const contentTypeIcons = {
  document: FileText,
  video: Video,
  link: LinkIcon,
  embedded: FileText,
}

export default function ItemDetailPage() {
  const params = useParams()
  const itemId = params?.itemId as string

  const { item, loading } = useKnowledgeBankItem(itemId)
  const [isFavorited, setIsFavorited] = useState(false)
  const [isTogglingFavorite, setIsTogglingFavorite] = useState(false)
  const [viewRecorded, setViewRecorded] = useState(false)

  useEffect(() => {
    if (item) {
      setIsFavorited(item.is_favorited || false)
    }
  }, [item])

  useEffect(() => {
    async function recordView() {
      if (!itemId || viewRecorded) return

      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        await supabase.from('knowledge_bank_views').insert({
          item_id: itemId,
          user_id: user.id,
        })

        await supabase.rpc('increment', {
          table_name: 'knowledge_bank_items',
          row_id: itemId,
          column_name: 'view_count',
        }).catch(() => {
          supabase
            .from('knowledge_bank_items')
            .update({ view_count: (item?.view_count || 0) + 1 })
            .eq('id', itemId)
        })

        setViewRecorded(true)
      } catch (error) {
        console.error('Error recording view:', error)
      }
    }

    recordView()
  }, [itemId, item, viewRecorded])

  const handleFavoriteToggle = async () => {
    try {
      setIsTogglingFavorite(true)
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        toast.error('You must be logged in to favourite items')
        return
      }

      if (isFavorited) {
        const { error } = await supabase
          .from('knowledge_bank_favorites')
          .delete()
          .eq('item_id', itemId)
          .eq('user_id', user.id)

        if (error) throw error
        setIsFavorited(false)
        toast.success('Removed from favourites')
      } else {
        const { error } = await supabase
          .from('knowledge_bank_favorites')
          .insert({
            item_id: itemId,
            user_id: user.id,
          })

        if (error) throw error
        setIsFavorited(true)
        toast.success('Added to favourites')
      }
    } catch (error) {
      console.error('Error toggling favourite:', error)
      toast.error('Failed to update favourite')
    } finally {
      setIsTogglingFavorite(false)
    }
  }

  const handleDownload = async () => {
    if (!item?.file_url) return

    try {
      await supabase.rpc('increment', {
        table_name: 'knowledge_bank_items',
        row_id: itemId,
        column_name: 'download_count',
      }).catch(() => {
        supabase
          .from('knowledge_bank_items')
          .update({ download_count: (item?.download_count || 0) + 1 })
          .eq('id', itemId)
      })

      window.open(item.file_url, '_blank')
      toast.success('Download started')
    } catch (error) {
      console.error('Error downloading file:', error)
      toast.error('Failed to download file')
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Card>
          <CardContent className="p-8 space-y-6">
            <Skeleton className="h-12 w-12 rounded-lg" />
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!item) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" asChild>
          <Link href="/knowledge-bank">
            <ChevronLeft className="mr-2 h-4 w-4" />
            Back to Knowledge Bank
          </Link>
        </Button>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Resource not found</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const Icon = contentTypeIcons[item.content_type]

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" asChild>
        <Link href="/knowledge-bank">
          <ChevronLeft className="mr-2 h-4 w-4" />
          Back to Knowledge Bank
        </Link>
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4 flex-1 min-w-0">
                  <div className="flex-shrink-0">
                    <Icon className="h-8 w-8 text-neon-lime" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-2xl mb-2">{item.title}</CardTitle>
                    {item.description && (
                      <p className="text-muted-foreground">{item.description}</p>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    'flex-shrink-0',
                    isFavorited ? 'text-yellow-500 hover:text-yellow-600' : 'hover:text-yellow-500'
                  )}
                  onClick={handleFavoriteToggle}
                  disabled={isTogglingFavorite}
                >
                  <Star className={cn('h-5 w-5', isFavorited && 'fill-current')} />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-wrap gap-2">
                {item.category && (
                  <Badge variant="secondary">{item.category.name}</Badge>
                )}
                <Badge variant="outline" className="capitalize">
                  {item.content_type}
                </Badge>
                {item.tags?.map((tag) => (
                  <Badge key={tag} variant="outline">
                    {tag}
                  </Badge>
                ))}
              </div>

              <Separator />

              {item.content_type === 'video' && item.file_url && (
                <div className="aspect-video bg-muted rounded-lg overflow-hidden">
                  <video controls className="w-full h-full">
                    <source src={item.file_url} />
                    Your browser does not support the video tag.
                  </video>
                </div>
              )}

              {item.content_type === 'link' && item.file_url && (
                <div className="p-6 bg-muted rounded-lg">
                  <div className="flex items-center gap-3">
                    <ExternalLink className="h-5 w-5 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">External Resource</p>
                      <a
                        href={item.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-neon-lime hover:underline truncate block"
                      >
                        {item.file_url}
                      </a>
                    </div>
                  </div>
                </div>
              )}

              {item.content_type === 'document' && item.file_url && (
                <div className="flex gap-3">
                  <Button onClick={handleDownload} className="flex-1">
                    <Download className="mr-2 h-4 w-4" />
                    Download Document
                  </Button>
                  <Button variant="outline" asChild>
                    <a href={item.file_url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Open
                    </a>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Eye className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Views:</span>
                  <span className="font-medium ml-auto">{item.view_count}</span>
                </div>

                {item.content_type === 'document' && (
                  <div className="flex items-center gap-2 text-sm">
                    <Download className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Downloads:</span>
                    <span className="font-medium ml-auto">{item.download_count}</span>
                  </div>
                )}

                {item.file_size > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Size:</span>
                    <span className="font-medium ml-auto">{formatFileSize(item.file_size)}</span>
                  </div>
                )}

                <Separator />

                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Author:</span>
                  <span className="font-medium ml-auto truncate">
                    {item.author?.full_name || 'Unknown'}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Created:</span>
                  <span className="font-medium ml-auto">
                    {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                  </span>
                </div>

                {item.published_at && (
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Published:</span>
                    <span className="font-medium ml-auto">
                      {formatDistanceToNow(new Date(item.published_at), { addSuffix: true })}
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-2 text-sm">
                  <Badge variant="outline" className="ml-auto">
                    v{item.version}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
