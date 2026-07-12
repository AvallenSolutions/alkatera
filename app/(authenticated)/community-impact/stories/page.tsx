'use client';

import { useState, useEffect } from 'react';
import { FeatureGate } from '@/components/subscription/FeatureGate';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Trash2, Calendar } from 'lucide-react';
import { useOrganization } from '@/lib/organizationContext';
import { format } from 'date-fns';
import { toast } from 'sonner';

import { PillButton } from '@/components/studio/pill-button';
import { StateChip } from '@/components/studio/state-chip';
import { Panel } from '@/components/studio/panel';
import { TopicHeader, HubSkeleton, Section } from '@/components/social';

interface ImpactStory {
  id: string;
  story_title: string;
  story_date: string;
  story_type: string;
  story_content: string;
  impact_summary: string | null;
}

export default function ImpactStoriesPage() {
  return (
    <FeatureGate feature="community_impact_stories">
      <ImpactStoriesPageContent />
    </FeatureGate>
  );
}

function ImpactStoriesPageContent() {
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

  if (loading) {
    return <HubSkeleton />;
  }

  return (
    <div className="space-y-8 animate-fade-in-up">
      <TopicHeader
        eyebrow={<>THE WIRING &middot; COMMUNITY IMPACT</>}
        headline={<>Impact stories.</>}
        description="Document and share your community impact stories."
        backHref="/community-impact"
        backLabel="Community impact"
      >
        <PillButton size="sm" onClick={() => setOpen(true)}>
          Create story
        </PillButton>
        <Dialog open={open} onOpenChange={setOpen}>
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
                  {isSubmitting ? 'Saving…' : 'Create Story'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </TopicHeader>

      <Section label="IMPACT STORIES" blurb="Stories that show your community impact in the field.">
        {stories.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No impact stories yet. Use &quot;Create story&quot; to document your first one.
          </p>
        ) : (
          <div className="grid gap-4">
            {stories.map((story) => (
              <Panel key={story.id}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="mb-2 flex items-center gap-3">
                      <StateChip tone="quiet">{story.story_type}</StateChip>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" aria-hidden="true" />
                        {format(new Date(story.story_date), 'dd MMM yyyy')}
                      </span>
                    </div>
                    <h3 className="text-base font-semibold tracking-tight">{story.story_title}</h3>
                    {story.impact_summary && (
                      <p className="mt-1 text-sm font-medium text-studio-good">
                        {story.impact_summary}
                      </p>
                    )}
                  </div>
                  <PillButton variant="ghost" size="sm" onClick={() => handleDelete(story.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </PillButton>
                </div>
                <p className="mt-3 whitespace-pre-line text-sm text-muted-foreground">
                  {story.story_content}
                </p>
              </Panel>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}
