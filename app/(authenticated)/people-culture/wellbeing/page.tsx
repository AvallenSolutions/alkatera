'use client';

import { useState } from 'react';
import { FeatureGate } from '@/components/subscription/FeatureGate';
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
  X,
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
    survey_provider: '',
    close_date: '',
    total_invited: '',
    total_responses: '',
  });
  const [categoryScores, setCategoryScores] = useState<
    { category: string; avg_score: string; response_count: string }[]
  >([]);

  const calculatedResponseRate =
    formData.total_invited && formData.total_responses
      ? Math.min(100, (parseInt(formData.total_responses) / parseInt(formData.total_invited)) * 100)
      : null;

  const hasResults = formData.total_responses && parseInt(formData.total_responses) > 0;

  const addCategoryScore = () => {
    setCategoryScores([...categoryScores, { category: '', avg_score: '', response_count: '' }]);
  };

  const removeCategoryScore = (index: number) => {
    setCategoryScores(categoryScores.filter((_, i) => i !== index));
  };

  const updateCategoryScore = (index: number, field: string, value: string) => {
    const updated = [...categoryScores];
    updated[index] = { ...updated[index], [field]: value };
    setCategoryScores(updated);
  };

  const resetForm = () => {
    setFormData({
      survey_name: '',
      survey_type: '',
      description: '',
      survey_provider: '',
      close_date: '',
      total_invited: '',
      total_responses: '',
    });
    setCategoryScores([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const { supabase } = await import('@/lib/supabaseClient');
      const { data: { session } } = await supabase.auth.getSession();

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const validScores = categoryScores
        .filter(cs => cs.category && cs.avg_score)
        .map(cs => ({
          question_category: cs.category,
          avg_score: parseFloat(cs.avg_score),
          response_count: cs.response_count ? parseInt(cs.response_count) : null,
        }));

      const response = await fetch('/api/people-culture/surveys', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          survey_name: formData.survey_name,
          survey_type: formData.survey_type,
          description: formData.description || null,
          survey_provider: formData.survey_provider || null,
          close_date: formData.close_date || null,
          total_invited: formData.total_invited ? parseInt(formData.total_invited) : 0,
          total_responses: formData.total_responses ? parseInt(formData.total_responses) : 0,
          response_rate: calculatedResponseRate,
          status: hasResults ? 'closed' : 'draft',
          category_scores: validScores.length > 0 ? validScores : undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create survey');
      }

      setOpen(false);
      resetForm();
      onSuccess();
    } catch (error) {
      console.error('Error creating survey:', error);
      alert(error instanceof Error ? error.message : 'Failed to create survey');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(newOpen) => { setOpen(newOpen); if (!newOpen) resetForm(); }}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <MessageSquare className="h-4 w-4 mr-2" />
          Record Survey
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Record Survey Results</DialogTitle>
          <DialogDescription>
            Record results from an employee survey run via an external tool
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            {/* Survey Details */}
            <div className="grid grid-cols-2 gap-4">
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
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="survey_provider">Survey Provider</Label>
                <Select
                  value={formData.survey_provider}
                  onValueChange={(value) => setFormData({ ...formData, survey_provider: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select provider (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="google_forms">Google Forms</SelectItem>
                    <SelectItem value="surveymonkey">SurveyMonkey</SelectItem>
                    <SelectItem value="culture_amp">Culture Amp</SelectItem>
                    <SelectItem value="officevibe">Officevibe</SelectItem>
                    <SelectItem value="typeform">Typeform</SelectItem>
                    <SelectItem value="microsoft_forms">Microsoft Forms</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="close_date">Survey Close Date</Label>
                <Input
                  id="close_date"
                  type="date"
                  value={formData.close_date}
                  onChange={(e) => setFormData({ ...formData, close_date: e.target.value })}
                />
              </div>
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

            {/* Results Section */}
            <div className="border-t pt-4 mt-2">
              <p className="text-sm font-medium mb-1">Survey Results</p>
              <p className="text-xs text-muted-foreground mb-4">
                If you have results from the survey, enter them below. The survey will be marked as completed.
              </p>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="total_invited">Employees Invited</Label>
                  <Input
                    id="total_invited"
                    type="number"
                    min="0"
                    value={formData.total_invited}
                    onChange={(e) => setFormData({ ...formData, total_invited: e.target.value })}
                    placeholder="e.g., 100"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="total_responses">Total Responses</Label>
                  <Input
                    id="total_responses"
                    type="number"
                    min="0"
                    value={formData.total_responses}
                    onChange={(e) => setFormData({ ...formData, total_responses: e.target.value })}
                    placeholder="e.g., 85"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Response Rate</Label>
                  <div className="h-10 flex items-center px-3 rounded-md border bg-muted text-sm text-muted-foreground">
                    {calculatedResponseRate !== null
                      ? `${calculatedResponseRate.toFixed(1)}%`
                      : '\u2014'}
                  </div>
                </div>
              </div>
            </div>

            {/* Category Scores */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Category Scores</Label>
                  <p className="text-xs text-muted-foreground">Average scores by category (1-5 scale)</p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addCategoryScore}>
                  <PlusCircle className="h-3 w-3 mr-1" />
                  Add Category
                </Button>
              </div>
              {categoryScores.map((cs, index) => (
                <div key={index} className="grid grid-cols-[1fr_80px_80px_32px] gap-2 items-end">
                  <div className="space-y-1">
                    {index === 0 && <Label className="text-xs">Category</Label>}
                    <Select
                      value={cs.category}
                      onValueChange={(value) => updateCategoryScore(index, 'category', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="engagement">Engagement</SelectItem>
                        <SelectItem value="wellbeing">Wellbeing</SelectItem>
                        <SelectItem value="leadership">Leadership</SelectItem>
                        <SelectItem value="communication">Communication</SelectItem>
                        <SelectItem value="work_life_balance">Work-Life Balance</SelectItem>
                        <SelectItem value="growth">Growth & Development</SelectItem>
                        <SelectItem value="inclusion">Inclusion & Belonging</SelectItem>
                        <SelectItem value="satisfaction">Overall Satisfaction</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    {index === 0 && <Label className="text-xs">Score</Label>}
                    <Input
                      type="number"
                      min="1"
                      max="5"
                      step="0.1"
                      value={cs.avg_score}
                      onChange={(e) => updateCategoryScore(index, 'avg_score', e.target.value)}
                      placeholder="3.5"
                    />
                  </div>
                  <div className="space-y-1">
                    {index === 0 && <Label className="text-xs">Responses</Label>}
                    <Input
                      type="number"
                      min="0"
                      value={cs.response_count}
                      onChange={(e) => updateCategoryScore(index, 'response_count', e.target.value)}
                      placeholder="85"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-10 w-8"
                    onClick={() => removeCategoryScore(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : hasResults ? 'Save Survey Results' : 'Create Survey'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function WellbeingPage() {
  return (
    <FeatureGate feature="people_wellbeing">
      <WellbeingPageContent />
    </FeatureGate>
  );
}

function WellbeingPageContent() {
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
