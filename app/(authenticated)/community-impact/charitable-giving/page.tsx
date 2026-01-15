'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Gift, PlusCircle, Trash2, Calendar } from 'lucide-react';
import { useOrganization } from '@/lib/organizationContext';
import { format } from 'date-fns';
import Link from 'next/link';
import { toast } from 'sonner';

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
  const { currentOrganization } = useOrganization();
  const [donations, setDonations] = useState<Donation[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [open, setOpen] = useState(false);
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
    return '—';
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/community-impact" className="text-muted-foreground hover:text-foreground">
              Community & Impact
            </Link>
            <span className="text-muted-foreground">/</span>
            <span className="font-medium">Charitable Giving</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2 mt-2">
            <Gift className="h-6 w-6 text-pink-600" />
            Charitable Giving
          </h1>
          <p className="text-muted-foreground mt-1">
            Track donations, contributions, and charitable activities
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="h-4 w-4 mr-2" />
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
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Donations History</CardTitle>
          <CardDescription>All charitable donations and contributions</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-center py-8">Loading donations...</p>
          ) : donations.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No donations logged yet. Click "Log Donation" to get started.
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
                          <Badge variant="secondary" className="text-xs capitalize mt-1">
                            {donation.recipient_cause}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {donation.donation_type.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>{getDonationValue(donation)}</TableCell>
                    <TableCell>
                      {donation.donation_date ? (
                        <div className="flex items-center gap-1 text-sm">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(donation.donation_date), 'dd MMM yyyy')}
                        </div>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell>{donation.beneficiaries_count?.toLocaleString() || '—'}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(donation.id)}
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
