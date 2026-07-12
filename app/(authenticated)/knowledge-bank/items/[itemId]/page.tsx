'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import {
  ChevronLeft,
  Download,
  Star,
  FileText,
  Video,
  Link as LinkIcon,
  Code2,
  ExternalLink,
} from 'lucide-react'
import { useKnowledgeBankItem } from '@/hooks/data/useKnowledgeBank'
import { PartnerAuthorBadge } from '@/components/knowledge-bank/PartnerAuthorBadge'
import { Statement } from '@/components/studio/statement'
import { Panel } from '@/components/studio/panel'
import { StateChip } from '@/components/studio/state-chip'
import { Eyebrow } from '@/components/studio/eyebrow'
import { PillButton } from '@/components/studio/pill-button'
import { PageLoader } from '@/components/ui/page-loader'
import { supabase } from '@/lib/supabaseClient'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const contentTypeIcons = {
  document: FileText,
  video: Video,
  link: LinkIcon,
  embedded: Code2,
}

export default function ItemDetailPage() {
  const params = useParams()
  const itemId = params?.itemId as string

  const { item, loading } = useKnowledgeBankItem(itemId)
  const [isFavorited, setIsFavorited] = useState(false)
  const [isTogglingFavorite, setIsTogglingFavorite] = useState(false)
  const [viewRecorded, setViewRecorded] = useState(false)
  const [signedUrl, setSignedUrl] = useState<string | null>(null)

  useEffect(() => {
    if (item) {
      setIsFavorited(item.is_favorited || false)
    }
  }, [item])

  // Generate a signed URL for private storage files
  // External links and embeds (content_type 'link' / 'embedded') use file_url
  // directly as it's a URL, not a storage path.
  // Global items (organization_id === null) use a server-side API route because
  // the files may be stored under another org's path in the storage bucket.
  useEffect(() => {
    async function generateSignedUrl() {
      if (!item?.file_url || item.content_type === 'link' || item.content_type === 'embedded') return

      // Global items: use the API route (service role) to bypass storage path restrictions
      if (item.organization_id === null) {
        try {
          const { data: session } = await supabase.auth.getSession()
          const token = session?.session?.access_token
          if (!token) return

          const response = await fetch('/api/knowledge-bank/signed-url', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
              file_url: item.file_url,
              file_name: item.file_name,
              item_id: item.id,
            }),
          })

          const result = await response.json()
          if (response.ok && result.signedUrl) {
            setSignedUrl(result.signedUrl)
          } else {
            console.error('Error generating signed URL via API:', result.error)
          }
        } catch (err) {
          console.error('Error generating signed URL via API:', err)
        }
        return
      }

      // Org-specific items: use client-side signed URL generation
      let storagePath = item.file_url
      const bucketPrefix = '/storage/v1/object/public/knowledge-bank-files/'
      if (storagePath.includes(bucketPrefix)) {
        storagePath = storagePath.split(bucketPrefix).pop() || storagePath
      }

      const { data, error } = await supabase.storage
        .from('knowledge-bank-files')
        .createSignedUrl(storagePath, 3600, {
          download: item.file_name || true, // Use original filename for downloads
        })

      if (data?.signedUrl) {
        setSignedUrl(data.signedUrl)
      } else if (error) {
        console.error('Error generating signed URL:', error)
      }
    }

    generateSignedUrl()
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

        const { error: rpcError } = await supabase.rpc('increment', {
          table_name: 'knowledge_bank_items',
          row_id: itemId,
          column_name: 'view_count',
        })

        if (rpcError) {
          await supabase
            .from('knowledge_bank_items')
            .update({ view_count: (item?.view_count || 0) + 1 })
            .eq('id', itemId)
        }

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
    if (!signedUrl && !item?.file_url) return

    try {
      const { error: rpcError } = await supabase.rpc('increment', {
        table_name: 'knowledge_bank_items',
        row_id: itemId,
        column_name: 'download_count',
      })

      if (rpcError) {
        await supabase
          .from('knowledge_bank_items')
          .update({ download_count: (item?.download_count || 0) + 1 })
          .eq('id', itemId)
      }

      window.open(signedUrl || item?.file_url || '', '_blank')
      toast.success('Download started')
    } catch (error) {
      console.error('Error downloading file:', error)
      toast.error('Failed to download file')
    }
  }

  if (loading) {
    return <PageLoader />
  }

  if (!item) {
    return (
      <div className="space-y-6">
        <PillButton variant="ghost" href="/knowledge-bank">
          <ChevronLeft className="h-4 w-4" />
          Back to the library
        </PillButton>
        <Panel>
          <p className="py-8 text-center text-sm text-studio-dim">Resource not found.</p>
        </Panel>
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
    <div className="space-y-8">
      <PillButton variant="ghost" href="/knowledge-bank">
        <ChevronLeft className="h-4 w-4" />
        Back to the library
      </PillButton>

      <Statement eyebrow="THE LIBRARY · KNOWLEDGE" headline={item.title}>
        <button
          type="button"
          onClick={handleFavoriteToggle}
          disabled={isTogglingFavorite}
          aria-label={isFavorited ? 'Remove from favourites' : 'Add to favourites'}
          className={cn(
            'inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors duration-150 ease-studio disabled:opacity-50',
            isFavorited
              ? 'text-room-accent hover:bg-room/10'
              : 'text-studio-dim hover:text-room-accent'
          )}
        >
          <Star className={cn('h-5 w-5', isFavorited && 'fill-current')} />
        </button>
      </Statement>

      {item.description && (
        <p className="max-w-2xl text-sm leading-relaxed text-studio-dim">{item.description}</p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Panel>
            <div className="mb-5 flex items-center gap-3">
              <Icon className="h-6 w-6 text-room-accent" />
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                {item.category && <StateChip>{item.category.name}</StateChip>}
                <StateChip>{item.content_type}</StateChip>
                {item.tags?.map((tag) => (
                  <StateChip key={tag}>{tag}</StateChip>
                ))}
              </div>
            </div>

            {item.content_type === 'video' && item.file_url && signedUrl && (
              <div className="aspect-video overflow-hidden rounded-[6px] border border-studio-hairline bg-studio-paper">
                <video controls className="h-full w-full">
                  <source src={signedUrl} />
                  Your browser does not support the video tag.
                </video>
              </div>
            )}

            {item.content_type === 'embedded' && item.file_url && (
              <iframe
                src={item.file_url}
                title={item.title}
                className="aspect-video w-full rounded-[6px] border border-studio-hairline bg-studio-paper"
                sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
                referrerPolicy="no-referrer"
                loading="lazy"
              />
            )}

            {item.content_type === 'link' && item.file_url && (
              <div className="rounded-[6px] border border-studio-hairline bg-studio-paper p-6">
                <div className="flex items-center gap-3">
                  <ExternalLink className="h-5 w-5 text-studio-dim" />
                  <div className="min-w-0 flex-1">
                    <Eyebrow tone="dim" className="mb-1">EXTERNAL RESOURCE</Eyebrow>
                    <a
                      href={item.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block truncate text-sm text-room-accent hover:underline"
                    >
                      {item.file_url}
                    </a>
                  </div>
                </div>
              </div>
            )}

            {item.content_type === 'document' && item.file_url && (
              <div className="flex gap-3">
                <PillButton
                  variant="room"
                  onClick={handleDownload}
                  disabled={!signedUrl}
                  className="flex-1"
                >
                  <Download className="h-4 w-4" />
                  {signedUrl ? 'Download document' : 'Preparing download...'}
                </PillButton>
                {signedUrl && (
                  <PillButton variant="outline" href={signedUrl}>
                    <ExternalLink className="h-4 w-4" />
                    Open
                  </PillButton>
                )}
              </div>
            )}
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel>
            <Eyebrow tone="dim" className="mb-4">DETAILS</Eyebrow>
            <dl className="space-y-3 text-sm">
              <DetailRow label="Views" value={String(item.view_count)} />
              {item.content_type === 'document' && (
                <DetailRow label="Downloads" value={String(item.download_count)} />
              )}
              {item.file_size > 0 && (
                <DetailRow label="Size" value={formatFileSize(item.file_size)} />
              )}

              <div className="border-t border-studio-hairline pt-3">
                {item.partner_attribution && item.external_author_name ? (
                  <PartnerAuthorBadge
                    authorName={item.external_author_name}
                    photoUrl={item.external_author_photo_url}
                    bio={item.external_author_bio}
                    partnerKey={item.partner_attribution}
                    variant="full"
                  />
                ) : (
                  <DetailRow
                    label="Author"
                    value={item.author?.full_name || (item.organization_id === null ? 'alkatera' : 'Unknown')}
                  />
                )}
              </div>

              <DetailRow
                label="Created"
                value={formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
              />
              {item.published_at && (
                <DetailRow
                  label="Published"
                  value={formatDistanceToNow(new Date(item.published_at), { addSuffix: true })}
                />
              )}
              <DetailRow label="Version" value={`v${item.version}`} />
            </dl>
          </Panel>
        </div>
      </div>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-studio-dim">
        {label}
      </dt>
      <dd className="truncate font-display text-sm font-semibold text-foreground">{value}</dd>
    </div>
  )
}
