'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

import { FeatureGate } from '@/components/subscription/FeatureGate';
import { PillButton } from '@/components/studio/pill-button';
import { StateChip } from '@/components/studio/state-chip';
import { Panel } from '@/components/studio/panel';
import { TopicHeader, Section, SummaryRow, HubSkeleton, ComplianceNote } from '@/components/social';
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
    <>
      <PillButton size="sm" onClick={() => setOpen(true)}>
        Add stakeholder
      </PillButton>
      <Dialog open={open} onOpenChange={setOpen}>
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
                {isSubmitting ? 'Adding…' : 'Add Stakeholder'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function EditStakeholderDialog({
  stakeholder,
  open,
  onOpenChange,
  onSuccess,
}: {
  stakeholder: Stakeholder;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    stakeholder_name: stakeholder.stakeholder_name || '',
    stakeholder_type: stakeholder.stakeholder_type || '',
    contact_name: stakeholder.contact_name || '',
    contact_email: stakeholder.contact_email || '',
    contact_role: stakeholder.contact_role || '',
    engagement_frequency: stakeholder.engagement_frequency || '',
    engagement_method: stakeholder.engagement_method || '',
    relationship_quality: stakeholder.relationship_quality || '',
    key_interests: stakeholder.key_interests || '',
    influence_level: stakeholder.influence_level || '',
    impact_level: stakeholder.impact_level || '',
  });

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

      const response = await fetch('/api/governance/stakeholders', {
        method: 'PUT',
        headers,
        credentials: 'include',
        body: JSON.stringify({ id: stakeholder.id, ...formData }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update stakeholder');
      }

      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error('Error updating stakeholder:', error);
      alert(error instanceof Error ? error.message : 'Failed to update stakeholder');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Stakeholder</DialogTitle>
          <DialogDescription>
            Update stakeholder details and engagement
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="space-y-2">
              <Label htmlFor="edit_stakeholder_name">Stakeholder Name *</Label>
              <Input
                id="edit_stakeholder_name"
                value={formData.stakeholder_name}
                onChange={(e) => setFormData({ ...formData, stakeholder_name: e.target.value })}
                placeholder="e.g., Local Community Group"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_stakeholder_type">Stakeholder Type *</Label>
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
                <Label htmlFor="edit_contact_name">Contact Name</Label>
                <Input
                  id="edit_contact_name"
                  value={formData.contact_name}
                  onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                  placeholder="Primary contact"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_contact_email">Contact Email</Label>
                <Input
                  id="edit_contact_email"
                  type="email"
                  value={formData.contact_email}
                  onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                  placeholder="email@example.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_contact_role">Contact Role</Label>
              <Input
                id="edit_contact_role"
                value={formData.contact_role}
                onChange={(e) => setFormData({ ...formData, contact_role: e.target.value })}
                placeholder="e.g., Sustainability Manager"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit_engagement_frequency">Engagement Frequency</Label>
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
                <Label htmlFor="edit_engagement_method">Engagement Method</Label>
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
              <Label htmlFor="edit_key_interests">Key Interests</Label>
              <Textarea
                id="edit_key_interests"
                value={formData.key_interests}
                onChange={(e) => setFormData({ ...formData, key_interests: e.target.value })}
                placeholder="What matters most to this stakeholder..."
                rows={2}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit_relationship_quality">Relationship</Label>
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
                <Label htmlFor="edit_influence_level">Influence</Label>
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
                <Label htmlFor="edit_impact_level">Impact</Label>
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
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function StakeholderCard({ stakeholder, onEdit }: { stakeholder: Stakeholder; onEdit?: (stakeholder: Stakeholder) => void }) {
  const qualityTones: Record<string, 'good' | 'attention' | 'stale' | 'quiet'> = {
    excellent: 'good',
    good: 'good',
    developing: 'attention',
    challenging: 'stale',
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
    <Panel>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h3 className="font-medium">{stakeholder.stakeholder_name}</h3>

          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <StateChip tone="quiet">
              {typeLabels[stakeholder.stakeholder_type] || stakeholder.stakeholder_type}
            </StateChip>
            {stakeholder.relationship_quality && (
              <StateChip tone={qualityTones[stakeholder.relationship_quality] ?? 'quiet'}>
                {stakeholder.relationship_quality}
              </StateChip>
            )}
            {stakeholder.influence_level === 'high' && (
              <StateChip tone="stale">High Influence</StateChip>
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
            <StateChip tone="stale">Overdue</StateChip>
          ) : stakeholder.last_engagement_date ? (
            <StateChip tone="good">Active</StateChip>
          ) : (
            <StateChip tone="quiet">New</StateChip>
          )}
          {onEdit && (
            <PillButton variant="ghost" size="sm" onClick={() => onEdit(stakeholder)}>
              Edit
            </PillButton>
          )}
        </div>
      </div>
    </Panel>
  );
}

export default function StakeholdersPage() {
  return (
    <FeatureGate feature="governance_ethics">
      <StakeholdersPageContent />
    </FeatureGate>
  );
}

function StakeholdersPageContent() {
  const { stakeholders, metrics, loading, refetch } = useStakeholders();
  const [editingStakeholder, setEditingStakeholder] = useState<Stakeholder | null>(null);

  if (loading) {
    return <HubSkeleton />;
  }

  return (
    <div className="space-y-8 animate-fade-in-up">
      <TopicHeader
        eyebrow={<>OUR PEOPLE &middot; GOVERNANCE</>}
        headline={<>Stakeholders.</>}
        description="Track and manage stakeholder relationships."
        backHref="/governance"
        backLabel="Governance"
      >
        <div className="flex items-center gap-2">
          <PillButton variant="outline" size="sm" onClick={() => refetch()}>
            Refresh
          </PillButton>
          <AddStakeholderDialog onSuccess={refetch} />
        </div>
      </TopicHeader>

      <ComplianceNote label="ABOUT STAKEHOLDERS">
        Identify and engage with key stakeholder groups including employees, customers, suppliers,
        investors, and community. Regular engagement supports B Corp and CSRD requirements for
        stakeholder consideration.
      </ComplianceNote>

      <SummaryRow
        figures={[
          { value: metrics.total_stakeholders, label: 'Total stakeholders' },
          { value: metrics.recent_engagements, label: 'Recent engagements' },
          {
            value: metrics.engagement_overdue,
            label: 'Overdue',
            tone: metrics.engagement_overdue > 0 ? 'attention' : 'ink',
          },
          { value: metrics.high_priority, label: 'High priority' },
        ]}
      />

      {Object.keys(metrics.by_type).length > 0 && (
        <Section label="STAKEHOLDER COVERAGE" blurb="Breakdown by stakeholder type.">
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {Object.entries(metrics.by_type).map(([type, count]) => (
              <StateChip key={type} tone="quiet">
                {type}: {count}
              </StateChip>
            ))}
          </div>
        </Section>
      )}

      {stakeholders.length > 0 ? (
        <Section label="ALL STAKEHOLDERS">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {stakeholders.map((stakeholder) => (
              <StakeholderCard key={stakeholder.id} stakeholder={stakeholder} onEdit={setEditingStakeholder} />
            ))}
          </div>
        </Section>
      ) : (
        <div className="border-t border-studio-hairline pt-6 text-sm text-muted-foreground">
          No stakeholders yet. Add stakeholders to track engagement and relationships.
        </div>
      )}

      {editingStakeholder && (
        <EditStakeholderDialog
          key={editingStakeholder.id}
          stakeholder={editingStakeholder}
          open={!!editingStakeholder}
          onOpenChange={(open) => { if (!open) setEditingStakeholder(null); }}
          onSuccess={() => {
            setEditingStakeholder(null);
            refetch();
          }}
        />
      )}
    </div>
  );
}
