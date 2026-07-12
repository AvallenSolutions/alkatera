'use client';

import { useState, useEffect, useRef } from 'react';
import { FeatureGate } from '@/components/subscription/FeatureGate';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users, Trash2, Calendar, Clock, MapPin, Camera, X, Image as ImageIcon, Repeat } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { PlacesAutocomplete } from '@/components/ui/places-autocomplete';
import { useOrganization } from '@/lib/organizationContext';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient';

import { PillButton } from '@/components/studio/pill-button';
import { StateChip } from '@/components/studio/state-chip';
import { Panel } from '@/components/studio/panel';
import { TopicHeader, HubSkeleton, Section } from '@/components/social';

const ACTIVITY_TYPES = [
  { value: 'team_volunteering', label: 'Team Volunteering' },
  { value: 'individual', label: 'Individual' },
  { value: 'skills_based', label: 'Skills-Based' },
  { value: 'board_service', label: 'Board Service' },
] as const;

const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  team_volunteering: 'Team Volunteering',
  individual: 'Individual',
  skills_based: 'Skills-Based',
  board_service: 'Board Service',
};

interface VolunteerActivity {
  id: string;
  activity_name: string;
  activity_type: string;
  activity_date: string;
  total_volunteer_hours: number;
  participant_count: number;
  beneficiaries_reached: number | null;
  partner_organization: string | null;
  description: string | null;
  location: string | null;
  photo_urls: string[] | null;
  series_id: string | null;
}

const RECURRENCE_OPTIONS = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Every 2 weeks' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
] as const;

export default function VolunteeringPage() {
  return (
    <FeatureGate feature="community_volunteering">
      <VolunteeringPageContent />
    </FeatureGate>
  );
}

function VolunteeringPageContent() {
  const { currentOrganization } = useOrganization();
  const [activities, setActivities] = useState<VolunteerActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [open, setOpen] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState<File[]>([]);
  const [photoPreviewUrls, setPhotoPreviewUrls] = useState<string[]>([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    activity_name: '',
    activity_type: '',
    activity_date: '',
    total_volunteer_hours: '',
    participant_count: '',
    beneficiaries_reached: '',
    partner_organization: '',
    description: '',
    location: '',
  });
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrence, setRecurrence] = useState<{ frequency: string; end_date: string }>({
    frequency: 'monthly',
    end_date: '',
  });

  useEffect(() => {
    if (currentOrganization?.id) {
      fetchActivities();
    }
  }, [currentOrganization?.id]);

  // Clean up preview URLs on unmount
  useEffect(() => {
    return () => {
      photoPreviewUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [photoPreviewUrls]);

  const fetchActivities = async () => {
    try {
      const response = await fetch(`/api/community-impact/volunteering?organization_id=${currentOrganization?.id}`);
      if (response.ok) {
        const data = await response.json();
        setActivities(data.activities || []);
      }
    } catch (error) {
      console.error('Error fetching volunteer activities:', error);
      toast.error('Failed to load volunteer activities');
    } finally {
      setLoading(false);
    }
  };

  const handlePhotosSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Limit to 5 photos total
    const remaining = 5 - selectedPhotos.length;
    const newFiles = files.slice(0, remaining);

    if (files.length > remaining) {
      toast.error(`Maximum 5 photos allowed. Only the first ${remaining} were added.`);
    }

    setSelectedPhotos((prev) => [...prev, ...newFiles]);
    const newUrls = newFiles.map((f) => URL.createObjectURL(f));
    setPhotoPreviewUrls((prev) => [...prev, ...newUrls]);

    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removePhoto = (index: number) => {
    URL.revokeObjectURL(photoPreviewUrls[index]);
    setSelectedPhotos((prev) => prev.filter((_, i) => i !== index));
    setPhotoPreviewUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadPhotos = async (orgId: string): Promise<string[]> => {
    if (selectedPhotos.length === 0) return [];

    setUploadingPhotos(true);
    const urls: string[] = [];

    try {
      for (const file of selectedPhotos) {
        const timestamp = Date.now();
        const sanitised = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `${orgId}/${timestamp}-${sanitised}`;

        const { error: uploadError } = await supabase.storage
          .from('volunteer-photos')
          .upload(path, file);

        if (uploadError) {
          console.error('Photo upload error:', uploadError);
          continue;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('volunteer-photos')
          .getPublicUrl(path);

        urls.push(publicUrl);
      }
    } finally {
      setUploadingPhotos(false);
    }

    return urls;
  };

  const resetForm = () => {
    setFormData({
      activity_name: '',
      activity_type: '',
      activity_date: '',
      total_volunteer_hours: '',
      participant_count: '',
      beneficiaries_reached: '',
      partner_organization: '',
      description: '',
      location: '',
    });
    photoPreviewUrls.forEach((url) => URL.revokeObjectURL(url));
    setSelectedPhotos([]);
    setPhotoPreviewUrls([]);
    setIsRecurring(false);
    setRecurrence({ frequency: 'monthly', end_date: '' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrganization?.id) return;
    setIsSubmitting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      if (isRecurring && !recurrence.end_date) {
        toast.error('Please choose a repeat-until date');
        setIsSubmitting(false);
        return;
      }

      // Upload photos first
      const photoUrls = await uploadPhotos(currentOrganization.id);

      const response = await fetch('/api/community-impact/volunteering', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          organization_id: currentOrganization.id,
          activity_name: formData.activity_name,
          activity_type: formData.activity_type,
          activity_date: formData.activity_date,
          total_volunteer_hours: parseFloat(formData.total_volunteer_hours),
          participant_count: parseInt(formData.participant_count),
          beneficiaries_reached: formData.beneficiaries_reached ? parseInt(formData.beneficiaries_reached) : null,
          partner_organization: formData.partner_organization || null,
          description: formData.description || null,
          location: formData.location || null,
          photo_urls: photoUrls.length > 0 ? photoUrls : [],
          recurrence: isRecurring
            ? { frequency: recurrence.frequency, end_date: recurrence.end_date }
            : null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || 'Failed to add volunteer activity');
      }

      const result = await response.json().catch(() => null);
      const created = result?.created ?? 1;
      toast.success(
        created > 1
          ? `Logged ${created} recurring activities`
          : 'Volunteer activity logged successfully'
      );
      setOpen(false);
      resetForm();
      fetchActivities();
    } catch (error) {
      console.error('Error adding volunteer activity:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to add volunteer activity');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (activity: VolunteerActivity) => {
    let url = `/api/community-impact/volunteering?id=${activity.id}`;
    let message = 'Activity deleted successfully';

    if (activity.series_id) {
      const deleteAll = confirm(
        'This activity is part of a recurring series. Click OK to delete the entire series, or Cancel to delete only this occurrence.'
      );
      if (deleteAll) {
        url = `/api/community-impact/volunteering?series_id=${activity.series_id}`;
        message = 'Recurring series deleted';
      } else {
        if (!confirm('Delete just this occurrence?')) return;
      }
    } else {
      if (!confirm('Are you sure you want to delete this activity?')) return;
    }

    try {
      const response = await fetch(url, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete activity');
      toast.success(message);
      fetchActivities();
    } catch (error) {
      console.error('Error deleting activity:', error);
      toast.error('Failed to delete activity');
    }
  };

  const totalHours = activities.reduce((sum, a) => sum + (a.total_volunteer_hours || 0), 0);
  const totalParticipants = activities.reduce((sum, a) => sum + (a.participant_count || 0), 0);
  const totalBeneficiaries = activities.reduce((sum, a) => sum + (a.beneficiaries_reached || 0), 0);

  if (loading) {
    return <HubSkeleton />;
  }

  return (
    <div className="space-y-8 animate-fade-in-up">
      <TopicHeader
        eyebrow={<>THE WIRING &middot; COMMUNITY IMPACT</>}
        headline={<>Volunteering.</>}
        description="Track employee volunteer activities and community service."
        backHref="/community-impact"
        backLabel="Community impact"
      >
        <PillButton size="sm" onClick={() => setOpen(true)}>
          Log activity
        </PillButton>
        <Dialog open={open} onOpenChange={(isOpen) => { setOpen(isOpen); if (!isOpen) resetForm(); }}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Log Volunteer Activity</DialogTitle>
              <DialogDescription>Record an employee volunteer activity</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label>Activity Name *</Label>
                  <Input
                    value={formData.activity_name}
                    onChange={(e) => setFormData({ ...formData, activity_name: e.target.value })}
                    placeholder="e.g., Beach Cleanup Day"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Activity Type *</Label>
                    <Select
                      value={formData.activity_type}
                      onValueChange={(value) => setFormData({ ...formData, activity_type: value })}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {ACTIVITY_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{isRecurring ? 'Start Date *' : 'Date *'}</Label>
                    <Input
                      type="date"
                      value={formData.activity_date}
                      onChange={(e) => setFormData({ ...formData, activity_date: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="rounded-lg border border-border p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-1.5 cursor-pointer" htmlFor="recurring-toggle">
                      <Repeat className="h-3.5 w-3.5" />
                      Repeats regularly
                    </Label>
                    <Switch
                      id="recurring-toggle"
                      checked={isRecurring}
                      onCheckedChange={setIsRecurring}
                    />
                  </div>
                  {isRecurring && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Frequency</Label>
                        <Select
                          value={recurrence.frequency}
                          onValueChange={(value) => setRecurrence({ ...recurrence, frequency: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {RECURRENCE_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Repeat until *</Label>
                        <Input
                          type="date"
                          value={recurrence.end_date}
                          min={formData.activity_date || undefined}
                          onChange={(e) => setRecurrence({ ...recurrence, end_date: e.target.value })}
                          required={isRecurring}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground col-span-2">
                        One entry will be created per occurrence, using the same hours,
                        participants and details. You can edit or delete individual
                        occurrences later.
                      </p>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Total Hours *</Label>
                    <Input
                      type="number"
                      step="0.5"
                      value={formData.total_volunteer_hours}
                      onChange={(e) => setFormData({ ...formData, total_volunteer_hours: e.target.value })}
                      placeholder="e.g., 40"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Participants *</Label>
                    <Input
                      type="number"
                      value={formData.participant_count}
                      onChange={(e) => setFormData({ ...formData, participant_count: e.target.value })}
                      placeholder="e.g., 10"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Beneficiaries Reached</Label>
                  <Input
                    type="number"
                    value={formData.beneficiaries_reached}
                    onChange={(e) => setFormData({ ...formData, beneficiaries_reached: e.target.value })}
                    placeholder="e.g., 200"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" />
                    Location
                  </Label>
                  <PlacesAutocomplete
                    value={formData.location}
                    onChange={(value) => setFormData({ ...formData, location: value })}
                    placeholder="e.g., Porthmeor Beach, St Ives"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Partner Organisation</Label>
                  <Input
                    value={formData.partner_organization}
                    onChange={(e) => setFormData({ ...formData, partner_organization: e.target.value })}
                    placeholder="e.g., Local Conservation Group"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Brief description..."
                    rows={2}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    <Camera className="h-3.5 w-3.5" />
                    Photos
                  </Label>
                  <div className="space-y-3">
                    {photoPreviewUrls.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {photoPreviewUrls.map((url, i) => (
                          <div key={i} className="relative group">
                            <img
                              src={url}
                              alt={`Photo ${i + 1}`}
                              className="h-20 w-20 object-cover rounded-lg border border-border"
                            />
                            <button
                              type="button"
                              onClick={() => removePhoto(i)}
                              className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    {selectedPhotos.length < 5 && (
                      <div>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={handlePhotosSelected}
                          className="hidden"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <ImageIcon className="h-4 w-4 mr-2" />
                          {selectedPhotos.length > 0 ? 'Add More Photos' : 'Upload Photos'}
                        </Button>
                        <p className="text-xs text-muted-foreground mt-1">
                          Up to 5 photos. JPG, PNG or WebP.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting || uploadingPhotos}>
                  {uploadingPhotos ? 'Uploading photos…' : isSubmitting ? 'Saving…' : 'Log Activity'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </TopicHeader>

      <div className="grid gap-4 md:grid-cols-3">
        <Panel>
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-studio-dim" aria-hidden="true" />
            <div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-studio-dim">
                Total hours
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{totalHours.toLocaleString()}</p>
            </div>
          </div>
        </Panel>

        <Panel>
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-studio-dim" aria-hidden="true" />
            <div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-studio-dim">
                Participants
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{totalParticipants}</p>
            </div>
          </div>
        </Panel>

        <Panel>
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-studio-dim" aria-hidden="true" />
            <div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-studio-dim">
                Beneficiaries
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{totalBeneficiaries}</p>
            </div>
          </div>
        </Panel>
      </div>

      <Section label="VOLUNTEER ACTIVITIES" blurb="All logged volunteer activities.">
        {activities.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No volunteer activities logged yet. Use &quot;Log activity&quot; to get started.
          </p>
        ) : (
          <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Activity</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Hours</TableHead>
                  <TableHead>Participants</TableHead>
                  <TableHead>Beneficiaries</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activities.map((activity) => (
                  <TableRow key={activity.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium flex items-center gap-2">
                          {activity.activity_name}
                          {activity.series_id && (
                            <StateChip tone="quiet" className="inline-flex items-center gap-1">
                              <Repeat className="h-3 w-3" />
                              Recurring
                            </StateChip>
                          )}
                        </p>
                        {activity.partner_organization && (
                          <p className="text-sm text-muted-foreground">
                            with {activity.partner_organization}
                          </p>
                        )}
                        {activity.location && (
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {activity.location}
                          </p>
                        )}
                        {activity.photo_urls && activity.photo_urls.length > 0 && (
                          <div className="flex items-center gap-1 mt-1">
                            <Camera className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">
                              {activity.photo_urls.length} photo{activity.photo_urls.length !== 1 ? 's' : ''}
                            </span>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <StateChip tone="quiet">
                        {ACTIVITY_TYPE_LABELS[activity.activity_type] || activity.activity_type}
                      </StateChip>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(activity.activity_date), 'dd MMM yyyy')}
                      </div>
                    </TableCell>
                    <TableCell className="tabular-nums">{activity.total_volunteer_hours} hrs</TableCell>
                    <TableCell className="tabular-nums">{activity.participant_count}</TableCell>
                    <TableCell className="tabular-nums">{activity.beneficiaries_reached?.toLocaleString() || '·'}</TableCell>
                    <TableCell>
                      <PillButton
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(activity)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </PillButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
        )}
      </Section>
    </div>
  );
}
