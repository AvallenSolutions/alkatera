"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, Save, Send, AlertTriangle, Loader2, Archive } from "lucide-react";
import { useIsAlkateraAdmin } from "@/hooks/usePermissions";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { RichTextEditor } from "@/components/blog/RichTextEditor";
import { ImageUpload } from "@/components/blog/ImageUpload";

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt?: string;
  content: string;
  featured_image_url?: string;
  tags: string[];
  content_type: 'article' | 'video' | 'quote' | 'tutorial';
  status: 'draft' | 'published' | 'archived';
  read_time?: string;
  meta_title?: string;
  meta_description?: string;
  author_name?: string;
}

export default function EditBlogPost({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { isAlkateraAdmin, isLoading: isLoadingAuth } = useIsAlkateraAdmin();

  const [post, setPost] = useState<BlogPost | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!isLoadingAuth && isAlkateraAdmin) {
      fetchPost();
    }
  }, [isAlkateraAdmin, isLoadingAuth, params.id]);

  const fetchPost = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/blog/${params.id}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch post');
      }

      setPost(data.post);
    } catch (err) {
      console.error('Error fetching post:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch post');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdate = async (status?: 'draft' | 'published' | 'archived') => {
    if (!post) return;

    try {
      setIsSubmitting(true);
      setError(null);
      setSuccess(false);

      const payload: any = {
        title: post.title,
        slug: post.slug,
        excerpt: post.excerpt,
        content: post.content,
        featured_image_url: post.featured_image_url,
        tags: post.tags,
        content_type: post.content_type,
        read_time: post.read_time,
        meta_title: post.meta_title,
        meta_description: post.meta_description,
        author_name: post.author_name,
      };

      if (status) {
        payload.status = status;
      }

      const response = await fetch(`/api/blog/${params.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update post');
      }

      setSuccess(true);
      setPost(data.post);

      // If published, redirect to blog dashboard after a short delay
      if (status === 'published') {
        setTimeout(() => {
          router.push('/admin/blog');
        }, 1500);
      }

    } catch (err) {
      console.error('Error updating post:', err);
      setError(err instanceof Error ? err.message : 'Failed to update post');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingAuth || isLoading) {
    return (
      <div className="p-8 max-w-5xl mx-auto">
        <Skeleton className="h-10 w-64 mb-6" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!isAlkateraAdmin) {
    return (
      <div className="p-8">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            You don't have permission to edit blog posts.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="p-8">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {error || 'Post not found'}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/admin/blog">
              <ArrowLeft className="w-4 h-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Edit Post</h1>
            <p className="text-muted-foreground">Update your blog post content</p>
          </div>
        </div>
        <div className="flex gap-2">
          {post.status !== 'draft' && (
            <Button
              variant="outline"
              onClick={() => handleUpdate('draft')}
              disabled={isSubmitting}
            >
              <Save className="w-4 h-4 mr-2" />
              Save as Draft
            </Button>
          )}
          {post.status !== 'archived' && (
            <Button
              variant="outline"
              onClick={() => handleUpdate('archived')}
              disabled={isSubmitting}
            >
              <Archive className="w-4 h-4 mr-2" />
              Archive
            </Button>
          )}
          <Button
            onClick={() => handleUpdate(post.status === 'published' ? undefined : 'published')}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              post.status === 'published' ? (
                <Save className="w-4 h-4 mr-2" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )
            )}
            {post.status === 'published' ? 'Update' : 'Publish'}
          </Button>
        </div>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <Alert className="bg-green-50 text-green-900 border-green-200">
          <AlertDescription>
            Post updated successfully!
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        {/* Main Content */}
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Post Content</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="title">{post.content_type === 'quote' ? 'Quote Text *' : 'Title *'}</Label>
                {post.content_type === 'quote' ? (
                  <Textarea
                    id="title"
                    placeholder="Enter the quote text..."
                    rows={4}
                    value={post.title}
                    onChange={(e) => setPost(prev => prev ? { ...prev, title: e.target.value } : null)}
                    className="font-serif text-lg italic"
                  />
                ) : (
                  <Input
                    id="title"
                    value={post.title}
                    onChange={(e) => setPost(prev => prev ? { ...prev, title: e.target.value } : null)}
                  />
                )}
              </div>

              {/* Author (for quotes only) */}
              {post.content_type === 'quote' && (
                <div className="space-y-2">
                  <Label htmlFor="author_name">Author *</Label>
                  <Input
                    id="author_name"
                    placeholder="e.g., CEO, Founder, etc."
                    value={post.author_name || ''}
                    onChange={(e) => setPost(prev => prev ? { ...prev, author_name: e.target.value } : null)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Who said this quote? (e.g., "CEO", "Founder")
                  </p>
                </div>
              )}

              {/* Slug */}
              <div className="space-y-2">
                <Label htmlFor="slug">URL Slug</Label>
                <Input
                  id="slug"
                  value={post.slug}
                  onChange={(e) => setPost(prev => prev ? { ...prev, slug: e.target.value } : null)}
                />
                <p className="text-xs text-muted-foreground">
                  URL: /blog/{post.slug}
                </p>
              </div>

              {/* Excerpt */}
              {post.content_type !== 'quote' && (
                <div className="space-y-2">
                  <Label htmlFor="excerpt">Excerpt</Label>
                  <Textarea
                    id="excerpt"
                    rows={3}
                    value={post.excerpt || ''}
                    onChange={(e) => setPost(prev => prev ? { ...prev, excerpt: e.target.value } : null)}
                  />
                </div>
              )}

              {/* Content */}
              {post.content_type !== 'quote' && (
                <div className="space-y-2">
                  <Label htmlFor="content">Content *</Label>
                  <RichTextEditor
                    content={post.content}
                    onChange={(content) => setPost(prev => prev ? { ...prev, content } : null)}
                    placeholder="Write your post content here..."
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Post Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Post Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Content Type */}
              <div className="space-y-2">
                <Label htmlFor="content_type">Content Type</Label>
                <Select
                  value={post.content_type}
                  onValueChange={(value: any) => setPost(prev => prev ? { ...prev, content_type: value } : null)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="article">Article</SelectItem>
                    <SelectItem value="video">Video</SelectItem>
                    <SelectItem value="quote">Quote</SelectItem>
                    <SelectItem value="tutorial">Tutorial</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Read Time */}
              {post.content_type !== 'quote' && (
                <div className="space-y-2">
                  <Label htmlFor="read_time">Read Time</Label>
                  <Input
                    id="read_time"
                    placeholder="e.g., 5 min read or 3:24"
                    value={post.read_time || ''}
                    onChange={(e) => setPost(prev => prev ? { ...prev, read_time: e.target.value } : null)}
                  />
                </div>
              )}

              {/* Tags */}
              <div className="space-y-2">
                <Label htmlFor="tags">Tags</Label>
                <Input
                  id="tags"
                  placeholder="Strategy, Packaging, Water..."
                  value={post.tags.join(', ')}
                  onChange={(e) => setPost(prev => prev ? {
                    ...prev,
                    tags: e.target.value.split(',').map(t => t.trim()).filter(t => t)
                  } : null)}
                />
              </div>

              {/* Featured Image */}
              {post.content_type !== 'quote' && (
                <ImageUpload
                  label="Featured Image"
                  description="Upload a featured image for your post"
                  currentImageUrl={post.featured_image_url}
                  onUploadComplete={(url) => setPost(prev => prev ? { ...prev, featured_image_url: url } : null)}
                />
              )}
            </CardContent>
          </Card>

          {/* SEO Settings */}
          <Card>
            <CardHeader>
              <CardTitle>SEO Metadata</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="meta_title">Meta Title</Label>
                <Input
                  id="meta_title"
                  value={post.meta_title || ''}
                  onChange={(e) => setPost(prev => prev ? { ...prev, meta_title: e.target.value } : null)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="meta_description">Meta Description</Label>
                <Textarea
                  id="meta_description"
                  rows={3}
                  value={post.meta_description || ''}
                  onChange={(e) => setPost(prev => prev ? { ...prev, meta_description: e.target.value } : null)}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
