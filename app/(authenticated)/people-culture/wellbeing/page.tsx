'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Heart,
  PlusCircle,
  RefreshCw,
  ArrowLeft,
  Gift,
  MessageSquare,
} from 'lucide-react';
import Link from 'next/link';

import { WellbeingDashboard } from '@/components/people-culture/WellbeingDashboard';
import { useWellbeingMetrics } from '@/hooks/data/useWellbeingMetrics';

function AddBenefitDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    benefit_name: '',
    benefit_type: '',
    description: '',
    eligibility_criteria: '',
    eligible_employee_count: '',
    uptake_count: '',
    employer_contribution: '',
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

      const response = await fetch('/api/people-culture/benefits', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          ...formData,
          eligible_employee_count: formData.eligible_employee_count ? parseInt(formData.eligible_employee_count) : null,
          uptake_count: formData.uptake_count ? parseInt(formData.uptake_count) : 0,
          employer_contribution: formData.employer_contribution ? parseFloat(formData.employer_contribution) : null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add benefit');
      }

      setOpen(false);
      setFormData({
        benefit_name: '',
        benefit_type: '',
        description: '',
        eligibility_criteria: '',
        eligible_employee_count: '',
        uptake_count: '',
        employer_contribution: '',
      });
      onSuccess();
    } catch (error) {
      console.error('Error adding benefit:', error);
      alert(error instanceof Error ? error.message : 'Failed to add benefit');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Gift className="h-4 w-4 mr-2" />
          Add Benefit
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Employee Benefit</DialogTitle>
          <DialogDescription>
            Track benefits offered to employees
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="benefit_name">Benefit Name *</Label>
              <Input
                id="benefit_name"
                value={formData.benefit_name}
                onChange={(e) => setFormData({ ...formData, benefit_name: e.target.value })}
                placeholder="e.g., Private Health Insurance"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="benefit_type">Benefit Type *</Label>
              <Select
                value={formData.benefit_type}
                onValueChange={(value) => setFormData({ ...formData, benefit_type: value })}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="health">Health & Medical</SelectItem>
                  <SelectItem value="pension">Pension & Retirement</SelectItem>
                  <SelectItem value="leave">Leave & Time Off</SelectItem>
                  <SelectItem value="flexible_working">Flexible Working</SelectItem>
                  <SelectItem value="wellness">Wellness Programs</SelectItem>
                  <SelectItem value="financial">Financial Benefits</SelectItem>
                  <SelectItem value="family">Family Support</SelectItem>
                  <SelectItem value="development">Learning & Development</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description of the benefit..."
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="eligibility_criteria">Eligibility Criteria</Label>
              <Input
                id="eligibility_criteria"
                value={formData.eligibility_criteria}
                onChange={(e) => setFormData({ ...formData, eligibility_criteria: e.target.value })}
                placeholder="e.g., All full-time employees"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="eligible_employee_count">Eligible</Label>
                <Input
                  id="eligible_employee_count"
                  type="number"
                  value={formData.eligible_employee_count}
                  onChange={(e) => setFormData({ ...formData, eligible_employee_count: e.target.value })}
                  placeholder="e.g., 50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="uptake_count">Uptake</Label>
                <Input
                  id="uptake_count"
                  type="number"
                  value={formData.uptake_count}
                  onChange={(e) => setFormData({ ...formData, uptake_count: e.target.value })}
                  placeholder="e.g., 45"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="employer_contribution">Cost (£)</Label>
                <Input
                  id="employer_contribution"
                  type="number"
                  value={formData.employer_contribution}
                  onChange={(e) => setFormData({ ...formData, employer_contribution: e.target.value })}
                  placeholder="Annual"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Adding...' : 'Add Benefit'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CreateSurveyDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    survey_name: '',
    survey_type: '',
    description: '',
    total_invited: '',
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

      const response = await fetch('/api/people-culture/surveys', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          ...formData,
          total_invited: formData.total_invited ? parseInt(formData.total_invited) : 0,
          status: 'draft',
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create survey');
      }

      setOpen(false);
      setFormData({
        survey_name: '',
        survey_type: '',
        description: '',
        total_invited: '',
      });
      onSuccess();
    } catch (error) {
      console.error('Error creating survey:', error);
      alert(error instanceof Error ? error.message : 'Failed to create survey');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <MessageSquare className="h-4 w-4 mr-2" />
          Create Survey
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Employee Survey</DialogTitle>
          <DialogDescription>
            Set up a new employee feedback survey
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="survey_name">Survey Name *</Label>
              <Input
                id="survey_name"
                value={formData.survey_name}
                onChange={(e) => setFormData({ ...formData, survey_name: e.target.value })}
                placeholder="e.g., Q1 2026 Engagement Survey"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="survey_type">Survey Type *</Label>
              <Select
                value={formData.survey_type}
                onValueChange={(value) => setFormData({ ...formData, survey_type: value })}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="engagement">Engagement</SelectItem>
                  <SelectItem value="wellbeing">Wellbeing</SelectItem>
                  <SelectItem value="pulse">Pulse Check</SelectItem>
                  <SelectItem value="exit">Exit Interview</SelectItem>
                  <SelectItem value="onboarding">Onboarding</SelectItem>
                  <SelectItem value="dei">DEI Feedback</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Purpose and scope of the survey..."
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="total_invited">Employees Invited</Label>
              <Input
                id="total_invited"
                type="number"
                value={formData.total_invited}
                onChange={(e) => setFormData({ ...formData, total_invited: e.target.value })}
                placeholder="e.g., 100"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Survey'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function WellbeingPage() {
  const { metrics, loading, refetch } = useWellbeingMetrics();

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
              <Heart className="h-6 w-6 text-pink-600" />
              Employee Wellbeing
            </h1>
            <p className="text-muted-foreground mt-1">
              Benefits, surveys, and employee engagement
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <CreateSurveyDialog onSuccess={refetch} />
          <AddBenefitDialog onSuccess={refetch} />
        </div>
      </div>

      {/* Info Card */}
      <Card className="bg-pink-50 dark:bg-pink-950/20 border-pink-200 dark:border-pink-800">
        <CardContent className="p-4">
          <p className="text-sm text-pink-800 dark:text-pink-200">
            <strong>About Wellbeing:</strong> Track employee benefits and conduct feedback surveys to
            measure engagement and satisfaction. High employee wellbeing correlates with retention
            and productivity.
          </p>
        </CardContent>
      </Card>

      {/* Dashboard */}
      <WellbeingDashboard metrics={metrics} isLoading={loading} />
    </div>
  );
}
