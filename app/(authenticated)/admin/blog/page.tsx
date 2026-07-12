"use client";

import { useState, useEffect } from "react";
import { Panel } from '@/components/studio/panel';
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  FileText,
  Plus,
  Edit2,
  Trash2,
  Eye,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  GripVertical,
} from "lucide-react";
import { Eyebrow } from "@/components/studio/eyebrow";
import { BigNumber } from "@/components/studio/big-number";
import { StateChip } from "@/components/studio/state-chip";
import { useIsAlkateraAdmin } from "@/hooks/usePermissions";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt?: string;
  status: 'draft' | 'published' | 'archived';
  published_at?: string;
  created_at: string;
  updated_at: string;
  author_name?: string;
  tags: string[];
  view_count: number;
  content_type: string;
  display_order: number;
}

interface BlogStats {
  total: number;
  published: number;
  drafts: number;
  total_views: number;
}

export default function BlogDashboard() {
  const router = useRouter();
  const { isAlkateraAdmin, isLoading: isLoadingAuth } = useIsAlkateraAdmin();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [stats, setStats] = useState<BlogStats>({ total: 0, published: 0, drafts: 0, total_views: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const fetchPosts = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch all posts (including drafts) for admin view
      const response = await fetch('/api/blog?status=&limit=100');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch posts');
      }

      setPosts(data.posts || []);

      // Calculate stats
      const published = data.posts.filter((p: BlogPost) => p.status === 'published').length;
      const drafts = data.posts.filter((p: BlogPost) => p.status === 'draft').length;
      const totalViews = data.posts.reduce((sum: number, p: BlogPost) => sum + (p.view_count || 0), 0);

      setStats({
        total: data.total || 0,
        published,
        drafts,
        total_views: totalViews,
      });
    } catch (err) {
      console.error('Error fetching posts:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch posts');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isLoadingAuth && isAlkateraAdmin) {
      fetchPosts();
    }
  }, [isAlkateraAdmin, isLoadingAuth]);

  const handleDelete = async (id: string) => {
    console.log('[Frontend] Delete clicked for post:', id);

    if (deleteConfirm !== id) {
      console.log('[Frontend] First click - setting confirmation');
      setDeleteConfirm(id);
      setTimeout(() => setDeleteConfirm(null), 3000);
      return;
    }

    console.log('[Frontend] Confirmed delete - making API call to:', `/api/blog/${id}`);

    try {
      const response = await fetch(`/api/blog/${id}`, {
        method: 'DELETE',
      });

      console.log('[Frontend] Delete response status:', response.status);

      if (!response.ok) {
        const data = await response.json();
        console.error('[Frontend] Delete failed:', data);
        throw new Error(data.error || 'Failed to delete post');
      }

      console.log('[Frontend] Delete successful, refreshing posts');

      // Refresh posts list
      fetchPosts();
      setDeleteConfirm(null);
    } catch (err) {
      console.error('[Frontend] Error deleting post:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete post');
    }
  };

  const handleMoveUp = async (index: number) => {
    if (index === 0) return; // Already at top

    const currentPost = posts[index];
    const previousPost = posts[index - 1];

    // Swap display_order values
    const updates = [
      { id: currentPost.id, display_order: previousPost.display_order },
      { id: previousPost.id, display_order: currentPost.display_order },
    ];

    try {
      const response = await fetch('/api/blog/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      });

      if (!response.ok) {
        throw new Error('Failed to reorder posts');
      }

      // Refresh posts list
      fetchPosts();
    } catch (err) {
      console.error('Error reordering posts:', err);
      setError(err instanceof Error ? err.message : 'Failed to reorder posts');
    }
  };

  const handleMoveDown = async (index: number) => {
    if (index === posts.length - 1) return; // Already at bottom

    const currentPost = posts[index];
    const nextPost = posts[index + 1];

    // Swap display_order values
    const updates = [
      { id: currentPost.id, display_order: nextPost.display_order },
      { id: nextPost.id, display_order: currentPost.display_order },
    ];

    try {
      const response = await fetch('/api/blog/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      });

      if (!response.ok) {
        throw new Error('Failed to reorder posts');
      }

      // Refresh posts list
      fetchPosts();
    } catch (err) {
      console.error('Error reordering posts:', err);
      setError(err instanceof Error ? err.message : 'Failed to reorder posts');
    }
  };

  if (isLoadingAuth) {
    return (
      <div className="p-8">
        <Skeleton className="h-10 w-64 mb-6" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!isAlkateraAdmin) {
    return (
      <div className="p-8">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            You don&apos;t have permission to access the blog dashboard. Only alkatera administrators can manage blog posts.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const getStatusChip = (status: string) => {
    switch (status) {
      case 'published':
        return <StateChip tone="good">Published</StateChip>;
      case 'draft':
        return <StateChip tone="attention">Draft</StateChip>;
      case 'archived':
        return <StateChip>Archived</StateChip>;
      default:
        return <StateChip>{status}</StateChip>;
    }
  };

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Eyebrow className="mb-3">THE WIRING · ADMIN</Eyebrow>
          <h1 className="font-display text-4xl font-bold leading-[0.95] tracking-[-0.035em] text-foreground">
            The blog.
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">Manage blog posts for the alkatera Knowledge Hub</p>
        </div>
        <Button asChild>
          <Link href="/admin/blog/new">
            <Plus className="w-4 h-4 mr-2" />
            New Post
          </Link>
        </Button>
      </header>

      {/* Stats */}
      <div className="rounded-[6px] border border-border bg-card p-6">
        <div className="flex flex-wrap gap-x-12 gap-y-6">
          <BigNumber value={stats.total} label="TOTAL POSTS" />
          <BigNumber value={stats.published} label="PUBLISHED" tone="good" />
          <BigNumber value={stats.drafts} label="DRAFTS" />
          <BigNumber value={stats.total_views.toLocaleString()} label="TOTAL VIEWS" />
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Posts Table */}
      <Panel className="rounded-[6px]">
        <div className="mb-4 space-y-1">
          <h2 className="font-display text-base font-semibold text-foreground">All Posts</h2>
          <p className="text-sm text-studio-dim">Manage and edit your blog posts</p>
        </div>
        <div>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No blog posts yet</h3>
              <p className="text-muted-foreground mb-4">Get started by creating your first blog post</p>
              <Button asChild>
                <Link href="/admin/blog/new">
                  <Plus className="w-4 h-4 mr-2" />
                  Create First Post
                </Link>
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Order</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Tags</TableHead>
                  <TableHead>Views</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {posts.map((post, index) => (
                  <TableRow key={post.id}>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <GripVertical className="w-4 h-4 text-muted-foreground" />
                        <div className="flex flex-col gap-0.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleMoveUp(index)}
                            disabled={index === 0}
                            className="h-5 w-5 p-0"
                          >
                            <ArrowUp className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleMoveDown(index)}
                            disabled={index === posts.length - 1}
                            className="h-5 w-5 p-0"
                          >
                            <ArrowDown className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{post.title}</div>
                        {post.excerpt && (
                          <div className="text-sm text-muted-foreground line-clamp-1">
                            {post.excerpt}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusChip(post.status)}</TableCell>
                    <TableCell className="capitalize">{post.content_type}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-x-2 gap-y-1">
                        {post.tags.slice(0, 2).map((tag, i) => (
                          <span key={i} className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                            {tag}
                          </span>
                        ))}
                        {post.tags.length > 2 && (
                          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                            +{post.tags.length - 2}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Eye className="w-3 h-3 text-muted-foreground" />
                        {post.view_count}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(post.updated_at), { addSuffix: true })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          asChild
                        >
                          <Link href={`/admin/blog/${post.id}`}>
                            <Edit2 className="w-4 h-4" />
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(post.id)}
                          className={deleteConfirm === post.id ? "text-destructive" : ""}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </Panel>
    </div>
  );
}
