'use client';

import { useState, useEffect, useRef } from 'react';
import { FeatureGate } from '@/components/subscription/FeatureGate';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users, PlusCircle, Trash2, Calendar, Clock, MapPin, Camera, X, Image as ImageIcon, Repeat } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { PlacesAutocomplete } from '@/components/ui/places-autocomplete';
import { useOrganization } from '@/lib/organizationContext';
import { format } from 'date-fns';
import Link from 'next/link';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient';

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

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/community-impact" className="text-muted-foreground hover:text-foreground">
              Community & Impact
            </Link>
            <span className="text-muted-foreground">/</span>
            <span className="font-medium">Volunteering</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2 mt-2">
            <Users className="h-6 w-6 text-blue-600" />
            Volunteering
          </h1>
          <p className="text-muted-foreground mt-1">
            Track employee volunteer activities and community service
          </p>
        </div>
        <Dialog open={open} onOpenChange={(isOpen) => { setOpen(isOpen); if (!isOpen) resetForm(); }}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="h-4 w-4 mr-2" />
              Log Activity
            </Button>
          </DialogTrigger>
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
                  {uploadingPhotos ? 'Uploading photos...' : isSubmitting ? 'Saving...' : 'Log Activity'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Clock className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Hours</p>
                <p className="text-2xl font-bold">{totalHours.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <Users className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Participants</p>
                <p className="text-2xl font-bold">{totalParticipants}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <Users className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Beneficiaries</p>
                <p className="text-2xl font-bold">{totalBeneficiaries}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Volunteer Activities</CardTitle>
          <CardDescription>All logged volunteer activities</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-center py-8">Loading activities...</p>
          ) : activities.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No volunteer activities logged yet. Click &quot;Log Activity&quot; to get started.
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
                        <p className="font-medium flex items-center gap-1.5">
                          {activity.activity_name}
                          {activity.series_id && (
                            <Badge variant="secondary" className="text-xs font-normal">
                              <Repeat className="h-3 w-3 mr-1" />
                              Recurring
                            </Badge>
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
                      <Badge variant="outline">
                        {ACTIVITY_TYPE_LABELS[activity.activity_type] || activity.activity_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(activity.activity_date), 'dd MMM yyyy')}
                      </div>
                    </TableCell>
                    <TableCell>{activity.total_volunteer_hours} hrs</TableCell>
                    <TableCell>{activity.participant_count}</TableCell>
                    <TableCell>{activity.beneficiaries_reached?.toLocaleString() || '—'}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(activity)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
