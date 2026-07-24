'use client';

/**
 * Community impact hub (/community-impact/), OUR PEOPLE, in the studio
 * grammar: statement with eyebrow, the score said once through the shared
 * ScoreHero (the hand-rolled pink ScoreRing is gone), quiet doors, URL-synced
 * mono tabs, dim compliance footnote. The donation POST and the score
 * recalc POST are unchanged.
 */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent } from '@/components/ui/tabs';

import { PillButton } from '@/components/studio/pill-button';
import {
  HubHeader,
  QuickActionRow,
  SummaryRow,
  HubSkeleton,
  ComplianceNote,
  GetStartedGuide,
  ScoreHero,
  HubTabList,
  useUrlTab,
} from '@/components/social';

import { useOrganization } from '@/lib/organizationContext';
import { FeatureGate } from '@/components/subscription/FeatureGate';
import { useCommunityImpactScore } from '@/hooks/data/useCommunityImpactScore';

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
    <>
      <PillButton size="sm" onClick={() => setOpen(true)}>
        Log donation
      </PillButton>
      <Dialog open={open} onOpenChange={setOpen}>
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
                {isSubmitting ? 'Saving…' : 'Log Donation'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function CommunityImpactPage() {
  return (
    <FeatureGate feature="community_charitable_giving">
      <CommunityImpactPageContent />
    </FeatureGate>
  );
}

function CommunityImpactPageContent() {
  const { currentOrganization } = useOrganization();
  const [activeTab, setActiveTab] = useUrlTab('overview');
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
    return <HubSkeleton />;
  }

  const hasData = (donationsSummary?.total_donations || 0) > 0 ||
    (volunteeringSummary?.total_activities || 0) > 0;

  return (
    <div className="space-y-8 animate-fade-in-up">
      <HubHeader
        eyebrow={<>OUR PEOPLE &middot; COMMUNITY IMPACT</>}
        headline={<>Community &amp; impact.</>}
        description="Charitable giving, local impact, volunteering, and community engagement."
      >
        <div className="flex items-center gap-2">
          <PillButton variant="outline" size="sm" onClick={handleRecalculate} disabled={isRecalculating}>
            {isRecalculating ? 'Recalculating…' : 'Refresh data'}
          </PillButton>
          <AddDonationDialog onSuccess={handleRefresh} />
        </div>
      </HubHeader>

      <ScoreHero
        heading="COMMUNITY IMPACT SCORE"
        overallScore={score?.overall_score ?? null}
        pillars={[
          { label: 'Giving', score: score?.giving_score ?? null },
          { label: 'Local impact', score: score?.local_impact_score ?? null },
          { label: 'Volunteering', score: score?.volunteering_score ?? null },
          { label: 'Engagement', score: score?.engagement_score ?? null },
        ]}
        blurb={
          score?.overall_score != null && score.overall_score >= 60
            ? 'Strong community presence. Keep up the great work.'
            : 'Track your charitable activities and community engagement.'
        }
      />

      <QuickActionRow
        items={[
          {
            title: 'Charitable giving',
            description: 'Donations and contributions',
            href: '/community-impact/charitable-giving',
          },
          {
            title: 'Local impact',
            description: 'Employment and sourcing',
            href: '/community-impact/local-impact',
          },
          {
            title: 'Volunteering',
            description: 'Employee volunteer activities',
            href: '/community-impact/volunteering',
          },
          {
            title: 'Impact stories',
            description: 'Document and share impact',
            href: '/community-impact/stories',
          },
        ]}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <HubTabList
          tabs={[
            { value: 'overview', label: 'Overview' },
            { value: 'giving', label: 'Giving' },
            { value: 'volunteering', label: 'Volunteering' },
            { value: 'local', label: 'Local impact' },
          ]}
        />

        <TabsContent value="overview" className="space-y-6">
          <SummaryRow
            figures={[
              { value: donationsSummary?.total_donations || 0, label: 'Total donations' },
              { value: `£${(donationsSummary?.total_cash || 0).toLocaleString()}`, label: 'Cash donated' },
              {
                value: (volunteeringSummary?.total_volunteer_hours || 0).toLocaleString(),
                label: 'Volunteer hours',
              },
              {
                value: (donationsSummary?.total_beneficiaries || 0).toLocaleString(),
                label: 'Beneficiaries',
              },
            ]}
          />

          {!hasData && (
            <GetStartedGuide
              description="Track your community contributions and local economic impact."
              actions={[
                { label: 'Log donation', href: '/community-impact/charitable-giving' },
                { label: 'Log volunteering', href: '/community-impact/volunteering' },
                { label: 'Add local impact data', href: '/community-impact/local-impact' },
                { label: 'Create impact story', href: '/community-impact/stories' },
              ]}
            />
          )}
        </TabsContent>

        <TabsContent value="giving" className="space-y-4">
          {donationsSummary && Object.keys(donationsSummary.by_type || {}).some(k => donationsSummary.by_type[k] > 0) ? (
            <SummaryRow
              figures={Object.entries(donationsSummary.by_type).map(([type, count]) => ({
                value: count as number,
                label: type.replace('_', ' '),
              }))}
            />
          ) : (
            <p className="border-t border-studio-hairline pt-6 text-sm text-muted-foreground">
              No donations logged yet. Use &quot;Log donation&quot; to get started.
            </p>
          )}
        </TabsContent>

        <TabsContent value="volunteering" className="space-y-4">
          {volunteeringSummary && volunteeringSummary.total_activities > 0 ? (
            <SummaryRow
              figures={[
                { value: volunteeringSummary.total_activities, label: 'Activities' },
                { value: volunteeringSummary.total_volunteer_hours, label: 'Total hours' },
                { value: volunteeringSummary.total_participants, label: 'Participants' },
                { value: volunteeringSummary.total_beneficiaries, label: 'Beneficiaries' },
              ]}
            />
          ) : (
            <p className="border-t border-studio-hairline pt-6 text-sm text-muted-foreground">
              No volunteer activities logged yet.
            </p>
          )}
        </TabsContent>

        <TabsContent value="local" className="space-y-4">
          <p className="border-t border-studio-hairline pt-6 text-sm text-muted-foreground">
            Track your local employment rate, local sourcing spend, and community investment.{' '}
            <Link
              href="/community-impact/local-impact"
              className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-room-accent hover:opacity-80"
            >
              Add local impact data &rarr;
            </Link>
          </p>
        </TabsContent>
      </Tabs>

      <ComplianceNote>
        Community Impact metrics support B Corp 2.1 Community requirements and CSRD ESRS S3
        (Affected Communities) reporting. Track charitable giving, volunteering, and local economic
        contribution for certification readiness.
      </ComplianceNote>
    </div>
  );
}
