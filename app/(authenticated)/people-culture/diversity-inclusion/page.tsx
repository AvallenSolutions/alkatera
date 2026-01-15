'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Users,
  PlusCircle,
  RefreshCw,
  ArrowLeft,
  Target,
  UserPlus,
} from 'lucide-react';
import Link from 'next/link';

import { DiversityDashboard } from '@/components/people-culture/DiversityDashboard';
import { useDiversityMetrics } from '@/hooks/data/useDiversityMetrics';

function AddDemographicsDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    reporting_period: new Date().toISOString().split('T')[0],
    total_employees: '',
    male: '',
    female: '',
    non_binary: '',
    not_disclosed: '',
    new_hires: '',
    departures: '',
    voluntary_departures: '',
    response_rate: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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

      const genderData = {
        male: parseInt(formData.male) || 0,
        female: parseInt(formData.female) || 0,
        non_binary: parseInt(formData.non_binary) || 0,
        not_disclosed: parseInt(formData.not_disclosed) || 0,
      };

      const response = await fetch('/api/people-culture/demographics', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          reporting_period: formData.reporting_period,
          total_employees: parseInt(formData.total_employees) || 0,
          gender_data: genderData,
          new_hires: parseInt(formData.new_hires) || 0,
          departures: parseInt(formData.departures) || 0,
          voluntary_departures: parseInt(formData.voluntary_departures) || 0,
          response_rate: formData.response_rate ? parseFloat(formData.response_rate) : null,
          data_collection_method: 'manual',
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add demographics');
      }

      setOpen(false);
      onSuccess();
    } catch (error) {
      console.error('Error adding demographics:', error);
      alert(error instanceof Error ? error.message : 'Failed to add data');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="h-4 w-4 mr-2" />
          Add Demographics
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Workforce Demographics</DialogTitle>
          <DialogDescription>
            Record workforce composition for diversity tracking
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="reporting_period">Reporting Period *</Label>
                <Input
                  id="reporting_period"
                  type="date"
                  value={formData.reporting_period}
                  onChange={(e) => setFormData({ ...formData, reporting_period: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="total_employees">Total Employees *</Label>
                <Input
                  id="total_employees"
                  type="number"
                  value={formData.total_employees}
                  onChange={(e) => setFormData({ ...formData, total_employees: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Gender Breakdown</Label>
              <div className="grid grid-cols-4 gap-2">
                <div>
                  <Label htmlFor="male" className="text-xs">Male</Label>
                  <Input
                    id="male"
                    type="number"
                    value={formData.male}
                    onChange={(e) => setFormData({ ...formData, male: e.target.value })}
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label htmlFor="female" className="text-xs">Female</Label>
                  <Input
                    id="female"
                    type="number"
                    value={formData.female}
                    onChange={(e) => setFormData({ ...formData, female: e.target.value })}
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label htmlFor="non_binary" className="text-xs">Non-binary</Label>
                  <Input
                    id="non_binary"
                    type="number"
                    value={formData.non_binary}
                    onChange={(e) => setFormData({ ...formData, non_binary: e.target.value })}
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label htmlFor="not_disclosed" className="text-xs">Not Disclosed</Label>
                  <Input
                    id="not_disclosed"
                    type="number"
                    value={formData.not_disclosed}
                    onChange={(e) => setFormData({ ...formData, not_disclosed: e.target.value })}
                    placeholder="0"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="new_hires">New Hires</Label>
                <Input
                  id="new_hires"
                  type="number"
                  value={formData.new_hires}
                  onChange={(e) => setFormData({ ...formData, new_hires: e.target.value })}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="departures">Departures</Label>
                <Input
                  id="departures"
                  type="number"
                  value={formData.departures}
                  onChange={(e) => setFormData({ ...formData, departures: e.target.value })}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="voluntary_departures">Voluntary</Label>
                <Input
                  id="voluntary_departures"
                  type="number"
                  value={formData.voluntary_departures}
                  onChange={(e) => setFormData({ ...formData, voluntary_departures: e.target.value })}
                  placeholder="0"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="response_rate">Data Response Rate (%)</Label>
              <Input
                id="response_rate"
                type="number"
                step="0.1"
                value={formData.response_rate}
                onChange={(e) => setFormData({ ...formData, response_rate: e.target.value })}
                placeholder="e.g., 85"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Demographics'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AddDEIActionDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    action_name: '',
    action_category: '',
    description: '',
    target_group: '',
    status: 'planned',
    priority: 'medium',
    start_date: '',
    target_date: '',
    owner_name: '',
    owner_department: '',
    success_metrics: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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

      const response = await fetch('/api/people-culture/dei-actions', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create DEI action');
      }

      setOpen(false);
      setFormData({
        action_name: '',
        action_category: '',
        description: '',
        target_group: '',
        status: 'planned',
        priority: 'medium',
        start_date: '',
        target_date: '',
        owner_name: '',
        owner_department: '',
        success_metrics: '',
      });
      onSuccess();
    } catch (error) {
      console.error('Error creating DEI action:', error);
      alert(error instanceof Error ? error.message : 'Failed to create action');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Target className="h-4 w-4 mr-2" />
          Add DEI Action
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create DEI Action</DialogTitle>
          <DialogDescription>
            Track diversity, equity, and inclusion initiatives
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="space-y-2">
              <Label htmlFor="action_name">Action Name *</Label>
              <Input
                id="action_name"
                value={formData.action_name}
                onChange={(e) => setFormData({ ...formData, action_name: e.target.value })}
                placeholder="e.g., Inclusive hiring training"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="action_category">Category *</Label>
                <Select
                  value={formData.action_category}
                  onValueChange={(value) => setFormData({ ...formData, action_category: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recruitment">Recruitment</SelectItem>
                    <SelectItem value="retention">Retention</SelectItem>
                    <SelectItem value="development">Development</SelectItem>
                    <SelectItem value="culture">Culture</SelectItem>
                    <SelectItem value="accessibility">Accessibility</SelectItem>
                    <SelectItem value="policy">Policy</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="target_group">Target Group</Label>
                <Select
                  value={formData.target_group}
                  onValueChange={(value) => setFormData({ ...formData, target_group: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select group" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Employees</SelectItem>
                    <SelectItem value="gender">Gender</SelectItem>
                    <SelectItem value="ethnicity">Ethnicity</SelectItem>
                    <SelectItem value="disability">Disability</SelectItem>
                    <SelectItem value="age">Age</SelectItem>
                    <SelectItem value="lgbtq">LGBTQ+</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe the action and its objectives..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="planned">Planned</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="on_hold">On Hold</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Select
                  value={formData.priority}
                  onValueChange={(value) => setFormData({ ...formData, priority: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_date">Start Date</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="target_date">Target Date</Label>
                <Input
                  id="target_date"
                  type="date"
                  value={formData.target_date}
                  onChange={(e) => setFormData({ ...formData, target_date: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="owner_name">Owner Name</Label>
                <Input
                  id="owner_name"
                  value={formData.owner_name}
                  onChange={(e) => setFormData({ ...formData, owner_name: e.target.value })}
                  placeholder="e.g., Jane Smith"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="owner_department">Department</Label>
                <Input
                  id="owner_department"
                  value={formData.owner_department}
                  onChange={(e) => setFormData({ ...formData, owner_department: e.target.value })}
                  placeholder="e.g., HR"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="success_metrics">Success Metrics</Label>
              <Textarea
                id="success_metrics"
                value={formData.success_metrics}
                onChange={(e) => setFormData({ ...formData, success_metrics: e.target.value })}
                placeholder="How will success be measured?"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Action'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function DiversityInclusionPage() {
  const { metrics, loading, refetch } = useDiversityMetrics();

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/people-culture">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Users className="h-6 w-6 text-purple-600" />
              Diversity & Inclusion
            </h1>
            <p className="text-muted-foreground mt-1">
              Workforce demographics, representation, and DEI initiatives
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <AddDEIActionDialog onSuccess={refetch} />
          <AddDemographicsDialog onSuccess={refetch} />
        </div>
      </div>

      {/* Info Card */}
      <Card className="bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800">
        <CardContent className="p-4">
          <p className="text-sm text-purple-800 dark:text-purple-200">
            <strong>About Diversity & Inclusion:</strong> Track workforce composition and DEI initiatives
            to support B Corp JEDI (Justice, Equity, Diversity, Inclusion) requirements and CSRD ESRS S1
            workforce disclosures.
          </p>
        </CardContent>
      </Card>

      {/* Dashboard */}
      <DiversityDashboard metrics={metrics} isLoading={loading} />
    </div>
  );
}
