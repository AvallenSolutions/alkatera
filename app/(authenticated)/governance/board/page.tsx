'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Scale,
  PlusCircle,
  RefreshCw,
  ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';

import { BoardCompositionChart } from '@/components/governance/BoardCompositionChart';
import { useBoardComposition } from '@/hooks/data/useBoardComposition';

function AddBoardMemberDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    member_name: '',
    role: '',
    member_type: '',
    gender: '',
    age_bracket: '',
    ethnicity: '',
    expertise_areas: '',
    industry_experience: '',
    appointment_date: '',
    term_end_date: '',
    is_independent: false,
    independence_assessment: '',
    committee_memberships: '',
    meeting_attendance_rate: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/governance/board', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          expertise_areas: formData.expertise_areas ? formData.expertise_areas.split(',').map(s => s.trim()) : null,
          committee_memberships: formData.committee_memberships ? formData.committee_memberships.split(',').map(s => s.trim()) : null,
          meeting_attendance_rate: formData.meeting_attendance_rate ? parseFloat(formData.meeting_attendance_rate) : null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add board member');
      }

      setOpen(false);
      setFormData({
        member_name: '',
        role: '',
        member_type: '',
        gender: '',
        age_bracket: '',
        ethnicity: '',
        expertise_areas: '',
        industry_experience: '',
        appointment_date: '',
        term_end_date: '',
        is_independent: false,
        independence_assessment: '',
        committee_memberships: '',
        meeting_attendance_rate: '',
      });
      onSuccess();
    } catch (error) {
      console.error('Error adding board member:', error);
      alert(error instanceof Error ? error.message : 'Failed to add board member');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <PlusCircle className="h-4 w-4 mr-2" />
          Add Board Member
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Board Member</DialogTitle>
          <DialogDescription>
            Add a new board member with diversity information
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="space-y-2">
              <Label htmlFor="member_name">Name *</Label>
              <Input
                id="member_name"
                value={formData.member_name}
                onChange={(e) => setFormData({ ...formData, member_name: e.target.value })}
                placeholder="e.g., John Smith"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="role">Role *</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value) => setFormData({ ...formData, role: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="chair">Chair</SelectItem>
                    <SelectItem value="vice_chair">Vice Chair</SelectItem>
                    <SelectItem value="director">Director</SelectItem>
                    <SelectItem value="secretary">Secretary</SelectItem>
                    <SelectItem value="treasurer">Treasurer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="member_type">Member Type *</Label>
                <Select
                  value={formData.member_type}
                  onValueChange={(value) => setFormData({ ...formData, member_type: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="executive">Executive</SelectItem>
                    <SelectItem value="non_executive">Non-Executive</SelectItem>
                    <SelectItem value="independent">Independent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="gender">Gender</Label>
                <Select
                  value={formData.gender}
                  onValueChange={(value) => setFormData({ ...formData, gender: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="non_binary">Non-binary</SelectItem>
                    <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="age_bracket">Age Bracket</Label>
                <Select
                  value={formData.age_bracket}
                  onValueChange={(value) => setFormData({ ...formData, age_bracket: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="under_30">Under 30</SelectItem>
                    <SelectItem value="30_50">30-50</SelectItem>
                    <SelectItem value="over_50">Over 50</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ethnicity">Ethnicity</Label>
              <Input
                id="ethnicity"
                value={formData.ethnicity}
                onChange={(e) => setFormData({ ...formData, ethnicity: e.target.value })}
                placeholder="e.g., White British"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="expertise_areas">Expertise Areas (comma-separated)</Label>
              <Input
                id="expertise_areas"
                value={formData.expertise_areas}
                onChange={(e) => setFormData({ ...formData, expertise_areas: e.target.value })}
                placeholder="e.g., Finance, Sustainability, Legal"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="committee_memberships">Committee Memberships (comma-separated)</Label>
              <Input
                id="committee_memberships"
                value={formData.committee_memberships}
                onChange={(e) => setFormData({ ...formData, committee_memberships: e.target.value })}
                placeholder="e.g., Audit, Remuneration"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="appointment_date">Appointment Date</Label>
                <Input
                  id="appointment_date"
                  type="date"
                  value={formData.appointment_date}
                  onChange={(e) => setFormData({ ...formData, appointment_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="term_end_date">Term End Date</Label>
                <Input
                  id="term_end_date"
                  type="date"
                  value={formData.term_end_date}
                  onChange={(e) => setFormData({ ...formData, term_end_date: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="meeting_attendance_rate">Meeting Attendance Rate (%)</Label>
              <Input
                id="meeting_attendance_rate"
                type="number"
                min="0"
                max="100"
                value={formData.meeting_attendance_rate}
                onChange={(e) => setFormData({ ...formData, meeting_attendance_rate: e.target.value })}
                placeholder="e.g., 95"
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="is_independent"
                checked={formData.is_independent}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, is_independent: checked as boolean })
                }
              />
              <Label htmlFor="is_independent" className="text-sm font-normal">
                Independent Director
              </Label>
            </div>

            {formData.is_independent && (
              <div className="space-y-2">
                <Label htmlFor="independence_assessment">Independence Assessment</Label>
                <Textarea
                  id="independence_assessment"
                  value={formData.independence_assessment}
                  onChange={(e) => setFormData({ ...formData, independence_assessment: e.target.value })}
                  placeholder="Basis for independence determination..."
                  rows={2}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Adding...' : 'Add Member'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function BoardPage() {
  const { members, metrics, loading, refetch } = useBoardComposition();

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
              <Scale className="h-6 w-6 text-emerald-600" />
              Board Composition
            </h1>
            <p className="text-muted-foreground mt-1">
              Track board diversity, independence, and governance
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <AddBoardMemberDialog onSuccess={refetch} />
        </div>
      </div>

      {/* Info Card */}
      <Card className="bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800">
        <CardContent className="p-4">
          <p className="text-sm text-emerald-800 dark:text-emerald-200">
            <strong>About Board Composition:</strong> Track board member diversity, independence,
            and expertise. Best practice targets include &gt;50% independent directors and balanced
            gender representation (40-60% any gender).
          </p>
        </CardContent>
      </Card>

      {/* Dashboard */}
      <BoardCompositionChart members={members} metrics={metrics} isLoading={loading} />
    </div>
  );
}
