'use client';

import { useState, useEffect } from 'react';
import { FeatureGate } from '@/components/subscription/FeatureGate';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trash2 } from 'lucide-react';
import { useOrganization } from '@/lib/organizationContext';
import { format } from 'date-fns';
import { toast } from 'sonner';

import { PillButton } from '@/components/studio/pill-button';
import { StateChip } from '@/components/studio/state-chip';
import { TopicHeader, HubSkeleton, Section } from '@/components/social';
import { QuickAddRow } from '@/components/studio/quick-add-row';
import { donationQuickAddConfig } from '@/lib/studio/quick-add-configs';
import { CsvPasteImport } from '@/components/studio/csv-paste-import';
import { donationCsvAdapter } from '@/lib/studio/csv-import-adapters';

interface Donation {
  id: string;
  donation_name: string;
  donation_type: string;
  recipient_name: string;
  recipient_cause: string | null;
  donation_amount: number | null;
  estimated_value: number | null;
  hours_donated: number | null;
  donation_date: string | null;
  description: string | null;
  beneficiaries_count: number | null;
}

export default function CharitableGivingPage() {
  return (
    <FeatureGate feature="community_charitable_giving">
      <CharitableGivingPageContent />
    </FeatureGate>
  );
}

function CharitableGivingPageContent() {
  const { currentOrganization } = useOrganization();
  const [donations, setDonations] = useState<Donation[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [open, setOpen] = useState(false);
  const [showCsvImport, setShowCsvImport] = useState(false);
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

  useEffect(() => {
    if (currentOrganization?.id) {
      fetchDonations();
    }
  }, [currentOrganization?.id]);

  const fetchDonations = async () => {
    try {
      const response = await fetch(`/api/community-impact/donations?organization_id=${currentOrganization?.id}`);
      if (response.ok) {
        const data = await response.json();
        setDonations(data.donations || []);
      }
    } catch (error) {
      console.error('Error fetching donations:', error);
      toast.error('Failed to load donations');
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

      const response = await fetch('/api/community-impact/donations', {
        method: 'POST',
        headers,
        credentials: 'include',
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

      toast.success('Donation logged successfully');
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
      fetchDonations();
    } catch (error) {
      console.error('Error adding donation:', error);
      toast.error('Failed to add donation');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this donation?')) return;

    try {
      const response = await fetch(`/api/community-impact/donations?id=${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete donation');

      toast.success('Donation deleted successfully');
      fetchDonations();
    } catch (error) {
      console.error('Error deleting donation:', error);
      toast.error('Failed to delete donation');
    }
  };

  const getDonationValue = (donation: Donation) => {
    if (donation.donation_amount) return `£${donation.donation_amount.toLocaleString()}`;
    if (donation.estimated_value) return `£${donation.estimated_value.toLocaleString()} (est.)`;
    if (donation.hours_donated) return `${donation.hours_donated} hours`;
    return '·';
  };

  if (loading) {
    return <HubSkeleton />;
  }

  return (
    <div className="space-y-8 animate-fade-in-up">
      <TopicHeader
        eyebrow={<>THE WIRING &middot; COMMUNITY IMPACT</>}
        headline={<>Charitable giving.</>}
        description="Track donations, contributions, and charitable activities."
        backHref="/community-impact"
        backLabel="Community impact"
      >
        <PillButton variant="outline" size="sm" onClick={() => setShowCsvImport(true)}>
          Paste a spreadsheet.
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
      </TopicHeader>

      <QuickAddRow
        config={donationQuickAddConfig}
        onAdded={fetchDonations}
        onOpenFullRecord={() => setOpen(true)}
      />

      <CsvPasteImport
        open={showCsvImport}
        onOpenChange={setShowCsvImport}
        adapter={donationCsvAdapter}
        onImported={fetchDonations}
      />

      <Section label="DONATIONS" blurb="All charitable donations and contributions.">
        {donations.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No donations logged yet. Use &quot;Log donation&quot; to get started.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Donation</TableHead>
                <TableHead>Recipient</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Beneficiaries</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {donations.map((donation) => (
                <TableRow key={donation.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{donation.donation_name}</p>
                      {donation.description && (
                        <p className="text-sm text-muted-foreground">{donation.description}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p>{donation.recipient_name}</p>
                      {donation.recipient_cause && (
                        <div className="mt-1">
                          <StateChip tone="quiet">{donation.recipient_cause}</StateChip>
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <StateChip tone="quiet">{donation.donation_type.replace('_', ' ')}</StateChip>
                  </TableCell>
                  <TableCell>{getDonationValue(donation)}</TableCell>
                  <TableCell>
                    {donation.donation_date
                      ? format(new Date(donation.donation_date), 'dd MMM yyyy')
                      : '·'}
                  </TableCell>
                  <TableCell>{donation.beneficiaries_count?.toLocaleString() || '·'}</TableCell>
                  <TableCell>
                    <PillButton
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(donation.id)}
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
