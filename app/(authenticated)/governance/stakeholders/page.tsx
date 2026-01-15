'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Users,
  PlusCircle,
  RefreshCw,
  ArrowLeft,
  AlertTriangle,
  CheckCircle,
  Clock,
} from 'lucide-react';
import Link from 'next/link';

import { useStakeholders, Stakeholder } from '@/hooks/data/useStakeholders';

function AddStakeholderDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    stakeholder_name: '',
    stakeholder_type: '',
    contact_name: '',
    contact_email: '',
    contact_role: '',
    engagement_frequency: '',
    engagement_method: '',
    relationship_quality: '',
    key_interests: '',
    influence_level: '',
    impact_level: '',
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

      const response = await fetch('/api/governance/stakeholders', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add stakeholder');
      }

      setOpen(false);
      setFormData({
        stakeholder_name: '',
        stakeholder_type: '',
        contact_name: '',
        contact_email: '',
        contact_role: '',
        engagement_frequency: '',
        engagement_method: '',
        relationship_quality: '',
        key_interests: '',
        influence_level: '',
        impact_level: '',
      });
      onSuccess();
    } catch (error) {
      console.error('Error adding stakeholder:', error);
      alert(error instanceof Error ? error.message : 'Failed to add stakeholder');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <PlusCircle className="h-4 w-4 mr-2" />
          Add Stakeholder
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Stakeholder</DialogTitle>
          <DialogDescription>
            Track stakeholder engagement and relationships
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="space-y-2">
              <Label htmlFor="stakeholder_name">Stakeholder Name *</Label>
              <Input
                id="stakeholder_name"
                value={formData.stakeholder_name}
                onChange={(e) => setFormData({ ...formData, stakeholder_name: e.target.value })}
                placeholder="e.g., Local Community Group"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="stakeholder_type">Stakeholder Type *</Label>
              <Select
                value={formData.stakeholder_type}
                onValueChange={(value) => setFormData({ ...formData, stakeholder_type: value })}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="employees">Employees</SelectItem>
                  <SelectItem value="customers">Customers</SelectItem>
                  <SelectItem value="suppliers">Suppliers</SelectItem>
                  <SelectItem value="investors">Investors</SelectItem>
                  <SelectItem value="community">Community</SelectItem>
                  <SelectItem value="regulators">Regulators</SelectItem>
                  <SelectItem value="ngos">NGOs</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contact_name">Contact Name</Label>
                <Input
                  id="contact_name"
                  value={formData.contact_name}
                  onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                  placeholder="Primary contact"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact_email">Contact Email</Label>
                <Input
                  id="contact_email"
                  type="email"
                  value={formData.contact_email}
                  onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                  placeholder="email@example.com"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="engagement_frequency">Engagement Frequency</Label>
                <Select
                  value={formData.engagement_frequency}
                  onValueChange={(value) => setFormData({ ...formData, engagement_frequency: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="annual">Annual</SelectItem>
                    <SelectItem value="ad_hoc">Ad Hoc</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="engagement_method">Engagement Method</Label>
                <Select
                  value={formData.engagement_method}
                  onValueChange={(value) => setFormData({ ...formData, engagement_method: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="survey">Survey</SelectItem>
                    <SelectItem value="meeting">Meeting</SelectItem>
                    <SelectItem value="report">Report</SelectItem>
                    <SelectItem value="newsletter">Newsletter</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="key_interests">Key Interests</Label>
              <Textarea
                id="key_interests"
                value={formData.key_interests}
                onChange={(e) => setFormData({ ...formData, key_interests: e.target.value })}
                placeholder="What matters most to this stakeholder..."
                rows={2}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="relationship_quality">Relationship</Label>
                <Select
                  value={formData.relationship_quality}
                  onValueChange={(value) => setFormData({ ...formData, relationship_quality: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="excellent">Excellent</SelectItem>
                    <SelectItem value="good">Good</SelectItem>
                    <SelectItem value="developing">Developing</SelectItem>
                    <SelectItem value="challenging">Challenging</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="influence_level">Influence</Label>
                <Select
                  value={formData.influence_level}
                  onValueChange={(value) => setFormData({ ...formData, influence_level: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="impact_level">Impact</Label>
                <Select
                  value={formData.impact_level}
                  onValueChange={(value) => setFormData({ ...formData, impact_level: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Adding...' : 'Add Stakeholder'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function StakeholderCard({ stakeholder }: { stakeholder: Stakeholder }) {
  const qualityColors: Record<string, string> = {
    excellent: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    good: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    developing: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    challenging: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  };

  const typeLabels: Record<string, string> = {
    employees: 'Employees',
    customers: 'Customers',
    suppliers: 'Suppliers',
    investors: 'Investors',
    community: 'Community',
    regulators: 'Regulators',
    ngos: 'NGOs',
  };

  const isEngagementOverdue = stakeholder.next_scheduled_engagement &&
    new Date(stakeholder.next_scheduled_engagement) < new Date();

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="font-medium">{stakeholder.stakeholder_name}</h3>

            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <Badge variant="outline">
                {typeLabels[stakeholder.stakeholder_type] || stakeholder.stakeholder_type}
              </Badge>
              {stakeholder.relationship_quality && (
                <Badge variant="outline" className={qualityColors[stakeholder.relationship_quality]}>
                  {stakeholder.relationship_quality}
                </Badge>
              )}
              {stakeholder.influence_level === 'high' && (
                <Badge variant="outline" className="bg-purple-100 text-purple-700">
                  High Influence
                </Badge>
              )}
            </div>

            {stakeholder.key_interests && (
              <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                {stakeholder.key_interests}
              </p>
            )}

            <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
              {stakeholder.contact_name && (
                <span>Contact: {stakeholder.contact_name}</span>
              )}
              {stakeholder.engagement_frequency && (
                <span className="capitalize">{stakeholder.engagement_frequency} engagement</span>
              )}
              {stakeholder.last_engagement_date && (
                <span>Last engaged: {new Date(stakeholder.last_engagement_date).toLocaleDateString()}</span>
              )}
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            {isEngagementOverdue ? (
              <Badge variant="outline" className="bg-amber-100 text-amber-700">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Overdue
              </Badge>
            ) : stakeholder.last_engagement_date ? (
              <Badge variant="outline" className="bg-emerald-100 text-emerald-700">
                <CheckCircle className="h-3 w-3 mr-1" />
                Active
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-slate-100 text-slate-600">
                <Clock className="h-3 w-3 mr-1" />
                New
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function StakeholdersPage() {
  const { stakeholders, metrics, loading, refetch } = useStakeholders();

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
          <Link href="/governance">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Users className="h-6 w-6 text-purple-600" />
              Stakeholder Engagement
            </h1>
            <p className="text-muted-foreground mt-1">
              Track and manage stakeholder relationships
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <AddStakeholderDialog onSuccess={refetch} />
        </div>
      </div>

      {/* Info Card */}
      <Card className="bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800">
        <CardContent className="p-4">
          <p className="text-sm text-purple-800 dark:text-purple-200">
            <strong>About Stakeholders:</strong> Identify and engage with key stakeholder groups
            including employees, customers, suppliers, investors, and community. Regular engagement
            supports B Corp and CSRD requirements for stakeholder consideration.
          </p>
        </CardContent>
      </Card>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <Users className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Stakeholders</p>
                <p className="text-2xl font-bold">{metrics.total_stakeholders}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Recent Engagements</p>
                <p className="text-2xl font-bold">{metrics.recent_engagements}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Overdue</p>
                <p className="text-2xl font-bold">{metrics.engagement_overdue}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">High Priority</p>
                <p className="text-2xl font-bold">{metrics.high_priority}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stakeholder Type Breakdown */}
      {Object.keys(metrics.by_type).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Stakeholder Coverage</CardTitle>
            <CardDescription>Breakdown by stakeholder type</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Object.entries(metrics.by_type).map(([type, count]) => (
                <Badge key={type} variant="secondary" className="text-sm capitalize">
                  {type}: {count}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stakeholder List */}
      {stakeholders.length > 0 ? (
        <div className="space-y-4">
          <h3 className="font-semibold text-lg">All Stakeholders</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {stakeholders.map((stakeholder) => (
              <StakeholderCard key={stakeholder.id} stakeholder={stakeholder} />
            ))}
          </div>
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-medium text-lg">No stakeholders yet</h3>
            <p className="text-muted-foreground mt-1">
              Add stakeholders to track engagement and relationships
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
