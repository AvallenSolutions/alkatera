'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { BookOpen, PlusCircle, Trash2, Calendar } from 'lucide-react';
import { useOrganization } from '@/lib/organizationContext';
import { format } from 'date-fns';
import Link from 'next/link';
import { toast } from 'sonner';

interface ImpactStory {
  id: string;
  story_title: string;
  story_date: string;
  story_type: string;
  story_content: string;
  impact_summary: string | null;
}

export default function ImpactStoriesPage() {
  const { currentOrganization } = useOrganization();
  const [stories, setStories] = useState<ImpactStory[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    story_title: '',
    story_date: '',
    story_type: '',
    story_content: '',
    impact_summary: '',
  });

  useEffect(() => {
    if (currentOrganization?.id) {
      fetchStories();
    }
  }, [currentOrganization?.id]);

  const fetchStories = async () => {
    try {
      const response = await fetch(`/api/community-impact/stories?organization_id=${currentOrganization?.id}`);
      if (response.ok) {
        const data = await response.json();
        setStories(data.stories || []);
      }
    } catch (error) {
      console.error('Error fetching impact stories:', error);
      toast.error('Failed to load impact stories');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrganization?.id) return;
    setIsSubmitting(true);

    try {
      // Get the current session to pass to API
      const { supabase } = await import('@/lib/supabaseClient');
      const { data: { session } } = await supabase.auth.getSession();

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const response = await fetch('/api/community-impact/stories', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          ...formData,
          organization_id: currentOrganization.id,
        }),
      });

      if (!response.ok) throw new Error('Failed to add impact story');

      toast.success('Impact story created successfully');
      setOpen(false);
      setFormData({
        story_title: '',
        story_date: '',
        story_type: '',
        story_content: '',
        impact_summary: '',
      });
      fetchStories();
    } catch (error) {
      console.error('Error adding impact story:', error);
      toast.error('Failed to add impact story');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this story?')) return;

    try {
      const response = await fetch(`/api/community-impact/stories?id=${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete story');

      toast.success('Story deleted successfully');
      fetchStories();
    } catch (error) {
      console.error('Error deleting story:', error);
      toast.error('Failed to delete story');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/community-impact" className="text-muted-foreground hover:text-foreground">
              Community & Impact
            </Link>
            <span className="text-muted-foreground">/</span>
            <span className="font-medium">Impact Stories</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2 mt-2">
            <BookOpen className="h-6 w-6 text-amber-600" />
            Impact Stories
          </h1>
          <p className="text-muted-foreground mt-1">
            Document and share your community impact stories
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="h-4 w-4 mr-2" />
              Create Story
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Impact Story</DialogTitle>
              <DialogDescription>Share a story about your community impact</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
                <div className="space-y-2">
                  <Label>Story Title *</Label>
                  <Input
                    value={formData.story_title}
                    onChange={(e) => setFormData({ ...formData, story_title: e.target.value })}
                    placeholder="e.g., Partnering with Local Schools"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Date *</Label>
                    <Input
                      type="date"
                      value={formData.story_date}
                      onChange={(e) => setFormData({ ...formData, story_date: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Story Type *</Label>
                    <Input
                      value={formData.story_type}
                      onChange={(e) => setFormData({ ...formData, story_type: e.target.value })}
                      placeholder="e.g., Education"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Impact Summary</Label>
                  <Input
                    value={formData.impact_summary}
                    onChange={(e) => setFormData({ ...formData, impact_summary: e.target.value })}
                    placeholder="e.g., Reached 500 students with STEM education"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Story Content *</Label>
                  <Textarea
                    value={formData.story_content}
                    onChange={(e) => setFormData({ ...formData, story_content: e.target.value })}
                    placeholder="Share the full story of your impact..."
                    rows={8}
                    required
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Creating...' : 'Create Story'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <Card>
          <CardContent className="p-8">
            <p className="text-muted-foreground text-center">Loading stories...</p>
          </CardContent>
        </Card>
      ) : stories.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-8">
            <div className="text-center">
              <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">
                No impact stories yet. Create your first story to document your community impact.
              </p>
              <Button onClick={() => setOpen(true)}>
                <PlusCircle className="h-4 w-4 mr-2" />
                Create Your First Story
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {stories.map((story) => (
            <Card key={story.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="secondary">{story.story_type}</Badge>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(story.story_date), 'dd MMM yyyy')}
                      </div>
                    </div>
                    <CardTitle>{story.story_title}</CardTitle>
                    {story.impact_summary && (
                      <CardDescription className="mt-2 font-medium text-emerald-600">
                        {story.impact_summary}
                      </CardDescription>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(story.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-line">
                  {story.story_content}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
