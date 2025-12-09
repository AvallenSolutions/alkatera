'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ChevronLeft, Upload, Loader2 } from 'lucide-react'
import { useKnowledgeBankCategories } from '@/hooks/data/useKnowledgeBank'
import { useOrganization } from '@/lib/organizationContext'
import { supabase } from '@/lib/supabaseClient'
import { toast } from 'sonner'

export default function NewResourcePage() {
  const router = useRouter()
  const { currentOrganization } = useOrganization()
  const { categories, loading: categoriesLoading } = useKnowledgeBankCategories()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [contentType, setContentType] = useState<'document' | 'video' | 'link' | 'embedded'>('document')
  const [externalUrl, setExternalUrl] = useState('')
  const [tags, setTags] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
    }
  }

  const handleSubmit = async (e: React.FormEvent, status: 'draft' | 'published') => {
    e.preventDefault()

    if (!title || !categoryId || !currentOrganization?.id) {
      toast.error('Please fill in all required fields')
      return
    }

    if (contentType === 'link' && !externalUrl) {
      toast.error('Please provide a URL for the external link')
      return
    }

    if ((contentType === 'document' || contentType === 'video') && !file && !externalUrl) {
      toast.error('Please upload a file or provide a URL')
      return
    }

    try {
      setIsUploading(true)

      let fileUrl = externalUrl
      let fileName = null
      let fileSize = 0
      let mimeType = null

      if (file) {
        const fileExt = file.name.split('.').pop()
        const filePath = `${currentOrganization.id}/${categoryId}/${Date.now()}.${fileExt}`

        const { error: uploadError, data } = await supabase.storage
          .from('knowledge-bank-files')
          .upload(filePath, file)

        if (uploadError) throw uploadError

        const { data: urlData } = supabase.storage
          .from('knowledge-bank-files')
          .getPublicUrl(filePath)

        fileUrl = urlData.publicUrl
        fileName = file.name
        fileSize = file.size
        mimeType = file.type
      }

      const { data: { user } } = await supabase.auth.getUser()

      const { data: item, error: insertError } = await supabase
        .from('knowledge_bank_items')
        .insert({
          organization_id: currentOrganization.id,
          category_id: categoryId,
          title,
          description: description || null,
          content_type: contentType,
          file_url: fileUrl,
          file_name: fileName,
          file_size: fileSize,
          mime_type: mimeType,
          status,
          author_id: user?.id || null,
          published_at: status === 'published' ? new Date().toISOString() : null,
        })
        .select()
        .single()

      if (insertError) throw insertError

      if (tags.trim()) {
        const tagNames = tags.split(',').map(t => t.trim()).filter(Boolean)

        for (const tagName of tagNames) {
          const { data: tagData, error: tagError } = await supabase
            .from('knowledge_bank_tags')
            .upsert(
              { organization_id: currentOrganization.id, name: tagName },
              { onConflict: 'organization_id,name' }
            )
            .select()
            .single()

          if (!tagError && tagData) {
            await supabase
              .from('knowledge_bank_item_tags')
              .insert({
                item_id: item.id,
                tag_id: tagData.id,
              })
          }
        }
      }

      toast.success(`Resource ${status === 'published' ? 'published' : 'saved as draft'} successfully`)
      router.push('/knowledge-bank')
    } catch (error) {
      console.error('Error creating resource:', error)
      toast.error('Failed to create resource')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <Button variant="ghost" asChild>
        <Link href="/knowledge-bank">
          <ChevronLeft className="mr-2 h-4 w-4" />
          Back to Knowledge Bank
        </Link>
      </Button>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">Add New Resource</h1>
        <p className="text-muted-foreground mt-1">
          Upload documents, videos, or add links to external resources
        </p>
      </div>

      <form onSubmit={(e) => handleSubmit(e, 'published')}>
        <Card>
          <CardHeader>
            <CardTitle>Resource Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title">
                Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter resource title"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter a description of this resource"
                rows={4}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">
                  Category <span className="text-destructive">*</span>
                </Label>
                <Select value={categoryId} onValueChange={setCategoryId} required>
                  <SelectTrigger id="category">
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="contentType">
                  Content Type <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={contentType}
                  onValueChange={(value: any) => setContentType(value)}
                  required
                >
                  <SelectTrigger id="contentType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="document">Document</SelectItem>
                    <SelectItem value="video">Video</SelectItem>
                    <SelectItem value="link">External Link</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {contentType === 'link' ? (
              <div className="space-y-2">
                <Label htmlFor="url">
                  URL <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="url"
                  type="url"
                  value={externalUrl}
                  onChange={(e) => setExternalUrl(e.target.value)}
                  placeholder="https://example.com/resource"
                  required
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="file">
                  Upload File {!externalUrl && <span className="text-destructive">*</span>}
                </Label>
                <div className="flex items-center gap-4">
                  <Input
                    id="file"
                    type="file"
                    onChange={handleFileChange}
                    accept={contentType === 'video' ? 'video/*' : '*'}
                    className="flex-1"
                  />
                  {file && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Upload className="h-4 w-4" />
                      <span className="truncate max-w-[200px]">{file.name}</span>
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Or provide an external URL instead
                </p>
                <Input
                  type="url"
                  value={externalUrl}
                  onChange={(e) => setExternalUrl(e.target.value)}
                  placeholder="https://example.com/file.pdf"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="tags">Tags</Label>
              <Input
                id="tags"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="Enter tags separated by commas"
              />
              <p className="text-xs text-muted-foreground">
                Separate multiple tags with commas (e.g., training, beginner, LCA)
              </p>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={(e) => handleSubmit(e as any, 'draft')}
                disabled={isUploading}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save as Draft'
                )}
              </Button>
              <Button type="submit" disabled={isUploading}>
                {isUploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Publishing...
                  </>
                ) : (
                  'Publish Resource'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  )
}
