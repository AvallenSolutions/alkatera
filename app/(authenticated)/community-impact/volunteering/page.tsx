'use client';

import { useState, useEffect } from 'react';
import { FeatureGate } from '@/components/subscription/FeatureGate';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users, PlusCircle, Trash2, Calendar, Clock } from 'lucide-react';
import { useOrganization } from '@/lib/organizationContext';
import { format } from 'date-fns';
import Link from 'next/link';
import { toast } from 'sonner';

interface VolunteerActivity {
  id: string;
  activity_name: string;
  activity_type: string;
  activity_date: string;
  total_volunteer_hours: number;
  participants_count: number;
  beneficiaries_count: number | null;
  partner_organization: string | null;
  description: string | null;
}

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
  const [formData, setFormData] = useState({
    activity_name: '',
    activity_type: '',
    activity_date: '',
    total_volunteer_hours: '',
    participants_count: '',
    beneficiaries_count: '',
    partner_organization: '',
    description: '',
  });

  useEffect(() => {
    if (currentOrganization?.id) {
      fetchActivities();
    }
  }, [currentOrganization?.id]);

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

      const response = await fetch('/api/community-impact/volunteering', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          ...formData,
          organization_id: currentOrganization.id,
          total_volunteer_hours: parseFloat(formData.total_volunteer_hours),
          participants_count: parseInt(formData.participants_count),
          beneficiaries_count: formData.beneficiaries_count ? parseInt(formData.beneficiaries_count) : null,
        }),
      });

      if (!response.ok) throw new Error('Failed to add volunteer activity');

      toast.success('Volunteer activity logged successfully');
      setOpen(false);
      setFormData({
        activity_name: '',
        activity_type: '',
        activity_date: '',
        total_volunteer_hours: '',
        participants_count: '',
        beneficiaries_count: '',
        partner_organization: '',
        description: '',
      });
      fetchActivities();
    } catch (error) {
      console.error('Error adding volunteer activity:', error);
      toast.error('Failed to add volunteer activity');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this activity?')) return;

    try {
      const response = await fetch(`/api/community-impact/volunteering?id=${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete activity');

      toast.success('Activity deleted successfully');
      fetchActivities();
    } catch (error) {
      console.error('Error deleting activity:', error);
      toast.error('Failed to delete activity');
    }
  };

  const totalHours = activities.reduce((sum, a) => sum + a.total_volunteer_hours, 0);
  const totalParticipants = activities.reduce((sum, a) => sum + a.participants_count, 0);
  const totalBeneficiaries = activities.reduce((sum, a) => sum + (a.beneficiaries_count || 0), 0);

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
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="h-4 w-4 mr-2" />
              Log Activity
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
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
                    <Input
                      value={formData.activity_type}
                      onChange={(e) => setFormData({ ...formData, activity_type: e.target.value })}
                      placeholder="e.g., Environmental"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Date *</Label>
                    <Input
                      type="date"
                      value={formData.activity_date}
                      onChange={(e) => setFormData({ ...formData, activity_date: e.target.value })}
                      required
                    />
                  </div>
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
                      value={formData.participants_count}
                      onChange={(e) => setFormData({ ...formData, participants_count: e.target.value })}
                      placeholder="e.g., 10"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Beneficiaries Reached</Label>
                  <Input
                    type="number"
                    value={formData.beneficiaries_count}
                    onChange={(e) => setFormData({ ...formData, beneficiaries_count: e.target.value })}
                    placeholder="e.g., 200"
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
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : 'Log Activity'}
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
                        <p className="font-medium">{activity.activity_name}</p>
                        {activity.partner_organization && (
                          <p className="text-sm text-muted-foreground">
                            with {activity.partner_organization}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{activity.activity_type}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(activity.activity_date), 'dd MMM yyyy')}
                      </div>
                    </TableCell>
                    <TableCell>{activity.total_volunteer_hours} hrs</TableCell>
                    <TableCell>{activity.participants_count}</TableCell>
                    <TableCell>{activity.beneficiaries_count?.toLocaleString() || '—'}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(activity.id)}
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
