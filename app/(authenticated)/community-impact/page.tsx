'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Heart,
  Gift,
  Users,
  MapPin,
  BookOpen,
  RefreshCw,
  PlusCircle,
  ChevronRight,
  AlertCircle,
  TrendingUp,
  Building2,
} from 'lucide-react';
import Link from 'next/link';
import { useOrganization } from '@/lib/organizationContext';
import { useCommunityImpactScore } from '@/hooks/data/useCommunityImpactScore';

function PageSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in-up">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-48 w-full" />
      <div className="grid grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
    </div>
  );
}

function ScoreRing({
  score,
  size = 'large',
  color = 'pink',
}: {
  score: number | null;
  size?: 'large' | 'small';
  color?: string;
}) {
  const radius = size === 'large' ? 70 : 30;
  const strokeWidth = size === 'large' ? 10 : 6;
  const circumference = 2 * Math.PI * radius;
  const progress = score !== null ? (score / 100) * circumference : 0;
  const viewBoxSize = (radius + strokeWidth) * 2;

  const colorClasses: Record<string, string> = {
    pink: 'stroke-pink-500',
    emerald: 'stroke-emerald-500',
    blue: 'stroke-blue-500',
    amber: 'stroke-amber-500',
    purple: 'stroke-purple-500',
  };

  return (
    <div className="relative flex flex-col items-center">
      <svg
        width={viewBoxSize}
        height={viewBoxSize}
        viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
        className="transform -rotate-90"
      >
        <circle
          cx={radius + strokeWidth}
          cy={radius + strokeWidth}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-slate-200 dark:text-slate-700"
        />
        <circle
          cx={radius + strokeWidth}
          cy={radius + strokeWidth}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          className={colorClasses[color] || colorClasses.pink}
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          style={{ transition: 'stroke-dashoffset 0.5s ease-out' }}
        />
      </svg>
      <div
        className={`absolute inset-0 flex flex-col items-center justify-center`}
      >
        <span className={`font-bold text-pink-600 ${size === 'large' ? 'text-4xl' : 'text-lg'}`}>
          {score !== null ? Math.round(score) : '—'}
        </span>
        {size === 'large' && (
          <span className="text-sm text-muted-foreground">/ 100</span>
        )}
      </div>
    </div>
  );
}

function AddDonationDialog({ onSuccess }: { onSuccess: () => void }) {
  const { currentOrganization } = useOrganization();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    donation_name: '',
    donation_type: '',
    recipient_name: '',
    recipient_type: '',
    recipient_cause: '',
    donation_amount: '',
    estimated_value: '',
    hours_donated: '',
    donation_date: '',
    description: '',
    beneficiaries_count: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrganization?.id) return;
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/community-impact/donations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          organization_id: currentOrganization.id,
          donation_amount: formData.donation_amount ? parseFloat(formData.donation_amount) : null,
          estimated_value: formData.estimated_value ? parseFloat(formData.estimated_value) : null,
          hours_donated: formData.hours_donated ? parseFloat(formData.hours_donated) : null,
          beneficiaries_count: formData.beneficiaries_count ? parseInt(formData.beneficiaries_count) : null,
        }),
      });

      if (!response.ok) throw new Error('Failed to add donation');

      setOpen(false);
      setFormData({
        donation_name: '',
        donation_type: '',
        recipient_name: '',
        recipient_type: '',
        recipient_cause: '',
        donation_amount: '',
        estimated_value: '',
        hours_donated: '',
        donation_date: '',
        description: '',
        beneficiaries_count: '',
      });
      onSuccess();
    } catch (error) {
      console.error('Error adding donation:', error);
      alert('Failed to add donation');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Gift className="h-4 w-4 mr-2" />
          Log Donation
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Log Donation</DialogTitle>
          <DialogDescription>Record a charitable donation or contribution</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="space-y-2">
              <Label>Donation Name *</Label>
              <Input
                value={formData.donation_name}
                onChange={(e) => setFormData({ ...formData, donation_name: e.target.value })}
                placeholder="e.g., Annual Charity Gala Sponsorship"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type *</Label>
                <Select
                  value={formData.donation_type}
                  onValueChange={(value) => setFormData({ ...formData, donation_type: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="in_kind">In-Kind</SelectItem>
                    <SelectItem value="time">Time</SelectItem>
                    <SelectItem value="pro_bono">Pro Bono</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={formData.donation_date}
                  onChange={(e) => setFormData({ ...formData, donation_date: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Recipient Name *</Label>
              <Input
                value={formData.recipient_name}
                onChange={(e) => setFormData({ ...formData, recipient_name: e.target.value })}
                placeholder="e.g., Local Food Bank"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Recipient Type</Label>
                <Select
                  value={formData.recipient_type}
                  onValueChange={(value) => setFormData({ ...formData, recipient_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="charity">Charity</SelectItem>
                    <SelectItem value="nonprofit">Nonprofit</SelectItem>
                    <SelectItem value="community_group">Community Group</SelectItem>
                    <SelectItem value="school">School</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Cause</Label>
                <Select
                  value={formData.recipient_cause}
                  onValueChange={(value) => setFormData({ ...formData, recipient_cause: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select cause" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="education">Education</SelectItem>
                    <SelectItem value="health">Health</SelectItem>
                    <SelectItem value="environment">Environment</SelectItem>
                    <SelectItem value="poverty">Poverty</SelectItem>
                    <SelectItem value="arts">Arts</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {formData.donation_type === 'cash' && (
              <div className="space-y-2">
                <Label>Donation Amount (£)</Label>
                <Input
                  type="number"
                  value={formData.donation_amount}
                  onChange={(e) => setFormData({ ...formData, donation_amount: e.target.value })}
                  placeholder="e.g., 5000"
                />
              </div>
            )}

            {formData.donation_type === 'in_kind' && (
              <div className="space-y-2">
                <Label>Estimated Value (£)</Label>
                <Input
                  type="number"
                  value={formData.estimated_value}
                  onChange={(e) => setFormData({ ...formData, estimated_value: e.target.value })}
                  placeholder="e.g., 2000"
                />
              </div>
            )}

            {['time', 'pro_bono'].includes(formData.donation_type) && (
              <div className="space-y-2">
                <Label>Hours Donated</Label>
                <Input
                  type="number"
                  value={formData.hours_donated}
                  onChange={(e) => setFormData({ ...formData, hours_donated: e.target.value })}
                  placeholder="e.g., 40"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Beneficiaries Reached</Label>
              <Input
                type="number"
                value={formData.beneficiaries_count}
                onChange={(e) => setFormData({ ...formData, beneficiaries_count: e.target.value })}
                placeholder="e.g., 500"
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
              {isSubmitting ? 'Saving...' : 'Log Donation'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function QuickActionCard({
  title,
  description,
  href,
  icon,
}: {
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
}) {
  return (
    <Link href={href}>
      <Card className="h-full hover:shadow-md transition-shadow cursor-pointer group">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center group-hover:bg-slate-200 dark:group-hover:bg-slate-700 transition-colors">
              {icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className="font-medium text-sm">{title}</p>
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              </div>
              <p className="text-xs text-muted-foreground mt-1">{description}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function CommunityImpactPage() {
  const { currentOrganization } = useOrganization();
  const [activeTab, setActiveTab] = useState('overview');
  const [isRecalculating, setIsRecalculating] = useState(false);

  const { score, loading: scoreLoading, recalculate } = useCommunityImpactScore();

  // Fetch donations summary
  const [donationsSummary, setDonationsSummary] = useState<any>(null);
  const [volunteeringSummary, setVolunteeringSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!currentOrganization?.id) {
      setLoading(false);
      return;
    }

    try {
      const [donationsRes, volunteeringRes] = await Promise.all([
        fetch(`/api/community-impact/donations?organization_id=${currentOrganization.id}`),
        fetch(`/api/community-impact/volunteering?organization_id=${currentOrganization.id}`),
      ]);

      if (donationsRes.ok) {
        const data = await donationsRes.json();
        setDonationsSummary(data.summary);
      }

      if (volunteeringRes.ok) {
        const data = await volunteeringRes.json();
        setVolunteeringSummary(data.summary);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, [currentOrganization?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRecalculate = async () => {
    setIsRecalculating(true);
    try {
      await recalculate();
    } catch (error) {
      console.error('Failed to recalculate score:', error);
    } finally {
      setIsRecalculating(false);
    }
  };

  const handleRefresh = async () => {
    await fetchData();
  };

  if (loading || scoreLoading) {
    return <PageSkeleton />;
  }

  const hasData = (donationsSummary?.total_donations || 0) > 0 ||
    (volunteeringSummary?.total_activities || 0) > 0;

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Heart className="h-6 w-6 text-pink-600" />
            Community & Impact
          </h1>
          <p className="text-muted-foreground mt-1">
            Charitable giving, local impact, volunteering, and community engagement
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRecalculate} disabled={isRecalculating}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isRecalculating ? 'animate-spin' : ''}`} />
            {isRecalculating ? 'Calculating...' : 'Refresh Data'}
          </Button>
          <AddDonationDialog onSuccess={handleRefresh} />
        </div>
      </div>

      {/* Score Hero */}
      <Card className="bg-gradient-to-br from-pink-50 to-pink-100 dark:from-pink-950/20 dark:to-pink-900/20 border-pink-200 dark:border-pink-800">
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row items-center gap-8">
            <div className="relative w-[160px] h-[160px] flex items-center justify-center">
              <ScoreRing score={score?.overall_score ?? null} size="large" color="pink" />
            </div>
            <div className="flex-1 text-center lg:text-left">
              <h2 className="text-2xl font-bold">Community Impact Score</h2>
              <p className="text-muted-foreground mt-1">
                {score?.overall_score != null && score.overall_score >= 60
                  ? 'Strong community presence - keep up the great work!'
                  : 'Track your charitable activities and community engagement'}
              </p>
              <div className="flex flex-wrap gap-4 mt-4 justify-center lg:justify-start">
                <div className="text-center">
                  <p className="text-2xl font-bold text-pink-600">{score?.giving_score ?? '—'}</p>
                  <p className="text-xs text-muted-foreground">Giving</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-emerald-600">{score?.local_impact_score ?? '—'}</p>
                  <p className="text-xs text-muted-foreground">Local Impact</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-600">{score?.volunteering_score ?? '—'}</p>
                  <p className="text-xs text-muted-foreground">Volunteering</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-amber-600">{score?.engagement_score ?? '—'}</p>
                  <p className="text-xs text-muted-foreground">Engagement</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <QuickActionCard
          title="Charitable Giving"
          description="Donations and contributions"
          href="/community-impact/charitable-giving"
          icon={<Gift className="h-5 w-5 text-pink-600" />}
        />
        <QuickActionCard
          title="Local Impact"
          description="Employment and sourcing"
          href="/community-impact/local-impact"
          icon={<MapPin className="h-5 w-5 text-emerald-600" />}
        />
        <QuickActionCard
          title="Volunteering"
          description="Employee volunteer activities"
          href="/community-impact/volunteering"
          icon={<Users className="h-5 w-5 text-blue-600" />}
        />
        <QuickActionCard
          title="Impact Stories"
          description="Document and share impact"
          href="/community-impact/stories"
          icon={<BookOpen className="h-5 w-5 text-amber-600" />}
        />
      </div>

      {/* Tabbed Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="giving">Giving</TabsTrigger>
          <TabsTrigger value="volunteering">Volunteering</TabsTrigger>
          <TabsTrigger value="local">Local Impact</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Summary Cards */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center">
                    <Gift className="h-5 w-5 text-pink-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Donations</p>
                    <p className="text-2xl font-bold">{donationsSummary?.total_donations || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                    <TrendingUp className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Cash Donated</p>
                    <p className="text-2xl font-bold">
                      £{(donationsSummary?.total_cash || 0).toLocaleString()}
                    </p>
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
                    <p className="text-sm text-muted-foreground">Volunteer Hours</p>
                    <p className="text-2xl font-bold">
                      {(volunteeringSummary?.total_volunteer_hours || 0).toLocaleString()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                    <Heart className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Beneficiaries</p>
                    <p className="text-2xl font-bold">
                      {(donationsSummary?.total_beneficiaries || 0).toLocaleString()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Getting Started Guide */}
          {!hasData && (
            <Card className="border-dashed">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-amber-500" />
                  <CardTitle className="text-base">Get Started with Community Impact</CardTitle>
                </div>
                <CardDescription>
                  Track your community contributions and local economic impact
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Button variant="outline" className="w-full justify-start" asChild>
                    <Link href="/community-impact/charitable-giving">
                      <PlusCircle className="h-4 w-4 mr-2" />
                      Log Donation
                    </Link>
                  </Button>
                  <Button variant="outline" className="w-full justify-start" asChild>
                    <Link href="/community-impact/volunteering">
                      <PlusCircle className="h-4 w-4 mr-2" />
                      Log Volunteering
                    </Link>
                  </Button>
                  <Button variant="outline" className="w-full justify-start" asChild>
                    <Link href="/community-impact/local-impact">
                      <PlusCircle className="h-4 w-4 mr-2" />
                      Add Local Impact Data
                    </Link>
                  </Button>
                  <Button variant="outline" className="w-full justify-start" asChild>
                    <Link href="/community-impact/stories">
                      <PlusCircle className="h-4 w-4 mr-2" />
                      Create Impact Story
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="giving" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Charitable Giving Summary</CardTitle>
              <CardDescription>Breakdown of donations by type and cause</CardDescription>
            </CardHeader>
            <CardContent>
              {donationsSummary && Object.keys(donationsSummary.by_type || {}).some(k => donationsSummary.by_type[k] > 0) ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Object.entries(donationsSummary.by_type).map(([type, count]) => (
                    <div key={type} className="text-center p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                      <p className="text-2xl font-bold">{count as number}</p>
                      <p className="text-sm text-muted-foreground capitalize">{type.replace('_', ' ')}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  No donations logged yet. Click "Log Donation" to get started.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="volunteering" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Volunteering Summary</CardTitle>
              <CardDescription>Employee volunteer activities and impact</CardDescription>
            </CardHeader>
            <CardContent>
              {volunteeringSummary && volunteeringSummary.total_activities > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                    <p className="text-2xl font-bold">{volunteeringSummary.total_activities}</p>
                    <p className="text-sm text-muted-foreground">Activities</p>
                  </div>
                  <div className="text-center p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                    <p className="text-2xl font-bold">{volunteeringSummary.total_volunteer_hours}</p>
                    <p className="text-sm text-muted-foreground">Total Hours</p>
                  </div>
                  <div className="text-center p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                    <p className="text-2xl font-bold">{volunteeringSummary.total_participants}</p>
                    <p className="text-sm text-muted-foreground">Participants</p>
                  </div>
                  <div className="text-center p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                    <p className="text-2xl font-bold">{volunteeringSummary.total_beneficiaries}</p>
                    <p className="text-sm text-muted-foreground">Beneficiaries</p>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  No volunteer activities logged yet.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="local" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Local Economic Impact</CardTitle>
              <CardDescription>Employment, sourcing, and community investment</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-center py-8">
                Track your local employment rate, local sourcing spend, and community investment.
                <br />
                <Link href="/community-impact/local-impact" className="text-pink-600 hover:underline">
                  Add local impact data →
                </Link>
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Compliance Note */}
      <Card className="bg-slate-50 dark:bg-slate-900/50">
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">
            <strong>Compliance:</strong> Community Impact metrics support B Corp 2.1 Community
            requirements and CSRD ESRS S3 (Affected Communities) reporting. Track charitable
            giving, volunteering, and local economic contribution for certification readiness.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
