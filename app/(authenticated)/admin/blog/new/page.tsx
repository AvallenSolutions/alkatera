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
import { ArrowLeft, Save, Send, AlertTriangle, Loader2 } from "lucide-react";
import { useIsAlkateraAdmin } from "@/hooks/usePermissions";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { RichTextEditor } from "@/components/blog/RichTextEditor";
import { ImageUpload } from "@/components/blog/ImageUpload";

interface BlogPostFormData {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  featured_image_url: string;
  tags: string;
  content_type: 'article' | 'video' | 'quote' | 'tutorial';
  read_time: string;
  meta_title: string;
  meta_description: string;
  author_name: string;
}

const DRAFT_STORAGE_KEY = 'alkatera-blog-draft';

export default function NewBlogPost() {
  const router = useRouter();
  const { isAlkateraAdmin, isLoading: isLoadingAuth } = useIsAlkateraAdmin();

  const [formData, setFormData] = useState<BlogPostFormData>({
    title: '',
    slug: '',
    excerpt: '',
    content: '',
    featured_image_url: '',
    tags: '',
    content_type: 'article',
    read_time: '',
    meta_title: '',
    meta_description: '',
    author_name: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);

  // Load saved draft on mount
  useEffect(() => {
    const savedDraft = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (savedDraft) {
      try {
        const parsed = JSON.parse(savedDraft);
        setFormData(parsed);
        setHasDraft(true);
      } catch (err) {
        console.error('Error loading draft:', err);
        localStorage.removeItem(DRAFT_STORAGE_KEY);
      }
    }
  }, []);

  // Save draft to localStorage whenever form data changes
  useEffect(() => {
    if (formData.title || formData.content || formData.excerpt) {
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(formData));
    }
  }, [formData]);

  const clearDraft = () => {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
    setFormData({
      title: '',
      slug: '',
      excerpt: '',
      content: '',
      featured_image_url: '',
      tags: '',
      content_type: 'article',
      read_time: '',
      meta_title: '',
      meta_description: '',
      author_name: '',
    });
    setHasDraft(false);
  };

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  };

  const handleTitleChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      title: value,
      slug: prev.slug === '' ? generateSlug(value) : prev.slug,
      meta_title: prev.meta_title === '' ? value : prev.meta_title,
    }));
  };

  const handleExcerptChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      excerpt: value,
      meta_description: prev.meta_description === '' ? value : prev.meta_description,
    }));
  };

  const handleSubmit = async (status: 'draft' | 'published') => {
    try {
      setIsSubmitting(true);
      setError(null);
      setSuccess(false);

      // Validate required fields
      const isQuote = formData.content_type === 'quote';
      if (!formData.title) {
        setError('Title is required');
        return;
      }
      if (!isQuote && !formData.content) {
        setError('Content is required');
        return;
      }
      if (isQuote && !formData.author_name) {
        setError('Author name is required for quotes');
        return;
      }

      // Parse tags from comma-separated string
      const tagsArray = formData.tags
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0);

      const payload = {
        ...formData,
        tags: tagsArray,
        status,
      };

      const response = await fetch('/api/blog', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create post');
      }

      setSuccess(true);

      // Clear the saved draft
      localStorage.removeItem(DRAFT_STORAGE_KEY);
      setHasDraft(false);

      // Redirect to blog dashboard after a short delay
      setTimeout(() => {
        router.push('/admin/blog');
      }, 1500);

    } catch (err) {
      console.error('Error creating post:', err);
      setError(err instanceof Error ? err.message : 'Failed to create post');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingAuth) {
    return (
      <div className="p-8 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!isAlkateraAdmin) {
    return (
      <div className="p-8">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            You don't have permission to create blog posts. Only Alkatera administrators can manage blog content.
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
            <h1 className="text-3xl font-bold tracking-tight">Create New Post</h1>
            <p className="text-muted-foreground">Write and publish content for the Knowledge Hub</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => handleSubmit('draft')}
            disabled={isSubmitting || !formData.title || (formData.content_type !== 'quote' && !formData.content) || (formData.content_type === 'quote' && !formData.author_name)}
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Save Draft
          </Button>
          <Button
            onClick={() => handleSubmit('published')}
            disabled={isSubmitting || !formData.title || (formData.content_type !== 'quote' && !formData.content) || (formData.content_type === 'quote' && !formData.author_name)}
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Send className="w-4 h-4 mr-2" />
            )}
            Publish
          </Button>
        </div>
      </div>

      {/* Draft Loaded Notice */}
      {hasDraft && !success && (
        <Alert>
          <AlertDescription className="flex items-center justify-between">
            <span>Draft restored from your last session</span>
            <Button variant="ghost" size="sm" onClick={clearDraft}>
              Clear Draft
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Success/Error Messages */}
      {success && (
        <Alert className="bg-green-50 text-green-900 border-green-200">
          <AlertDescription>
            Post created successfully! Redirecting to blog dashboard...
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
                <Label htmlFor="title">{formData.content_type === 'quote' ? 'Quote Text *' : 'Title *'}</Label>
                {formData.content_type === 'quote' ? (
                  <Textarea
                    id="title"
                    placeholder="Enter the quote text..."
                    rows={4}
                    value={formData.title}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    className="font-serif text-lg italic"
                  />
                ) : (
                  <Input
                    id="title"
                    placeholder="Enter post title..."
                    value={formData.title}
                    onChange={(e) => handleTitleChange(e.target.value)}
                  />
                )}
              </div>

              {/* Author (for quotes only) */}
              {formData.content_type === 'quote' && (
                <div className="space-y-2">
                  <Label htmlFor="author_name">Author *</Label>
                  <Input
                    id="author_name"
                    placeholder="e.g., CEO, Founder, etc."
                    value={formData.author_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, author_name: e.target.value }))}
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
                  placeholder="auto-generated-from-title"
                  value={formData.slug}
                  onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">
                  URL: /blog/{formData.slug || 'slug'}
                </p>
              </div>

              {/* Excerpt */}
              {formData.content_type !== 'quote' && (
                <div className="space-y-2">
                  <Label htmlFor="excerpt">Excerpt</Label>
                  <Textarea
                    id="excerpt"
                    placeholder="Brief description of the post..."
                    rows={3}
                    value={formData.excerpt}
                    onChange={(e) => handleExcerptChange(e.target.value)}
                  />
                </div>
              )}

              {/* Content */}
              {formData.content_type !== 'quote' && (
                <div className="space-y-2">
                  <Label htmlFor="content">Content *</Label>
                  <RichTextEditor
                    content={formData.content}
                    onChange={(content) => setFormData(prev => ({ ...prev, content }))}
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
                  value={formData.content_type}
                  onValueChange={(value: any) => setFormData(prev => ({ ...prev, content_type: value }))}
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
              {formData.content_type !== 'quote' && (
                <div className="space-y-2">
                  <Label htmlFor="read_time">Read Time</Label>
                  <Input
                    id="read_time"
                    placeholder="e.g., 5 min read or 3:24"
                    value={formData.read_time}
                    onChange={(e) => setFormData(prev => ({ ...prev, read_time: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Leave empty for auto-calculation
                  </p>
                </div>
              )}

              {/* Tags */}
              <div className="space-y-2">
                <Label htmlFor="tags">Tags</Label>
                <Input
                  id="tags"
                  placeholder="Strategy, Packaging, Water..."
                  value={formData.tags}
                  onChange={(e) => setFormData(prev => ({ ...prev, tags: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">
                  Comma-separated tags
                </p>
              </div>

              {/* Featured Image */}
              {formData.content_type !== 'quote' && (
                <ImageUpload
                  label="Featured Image"
                  description="Upload a featured image for your post"
                  currentImageUrl={formData.featured_image_url}
                  onUploadComplete={(url) => setFormData(prev => ({ ...prev, featured_image_url: url }))}
                />
              )}
            </CardContent>
          </Card>

          {/* SEO Settings */}
          <Card>
            <CardHeader>
              <CardTitle>SEO Metadata</CardTitle>
              <CardDescription>Customize how this appears in search</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="meta_title">Meta Title</Label>
                <Input
                  id="meta_title"
                  placeholder="Auto-fills from title"
                  value={formData.meta_title}
                  onChange={(e) => setFormData(prev => ({ ...prev, meta_title: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="meta_description">Meta Description</Label>
                <Textarea
                  id="meta_description"
                  placeholder="Auto-fills from excerpt"
                  rows={3}
                  value={formData.meta_description}
                  onChange={(e) => setFormData(prev => ({ ...prev, meta_description: e.target.value }))}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
