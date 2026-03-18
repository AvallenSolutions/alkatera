'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
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
import { useBoardComposition, type BoardMember } from '@/hooks/data/useBoardComposition';

const emptyFormData = {
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
};

type FormData = typeof emptyFormData;

/** Convert empty strings to null for optional fields */
function cleanFormData(formData: FormData) {
  return {
    member_name: formData.member_name,
    role: formData.role,
    member_type: formData.member_type,
    gender: formData.gender || null,
    age_bracket: formData.age_bracket || null,
    ethnicity: formData.ethnicity || null,
    expertise_areas: formData.expertise_areas ? formData.expertise_areas.split(',').map(s => s.trim()) : null,
    industry_experience: formData.industry_experience || null,
    appointment_date: formData.appointment_date || null,
    term_end_date: formData.term_end_date || null,
    is_independent: formData.is_independent,
    independence_assessment: formData.independence_assessment || null,
    committee_memberships: formData.committee_memberships ? formData.committee_memberships.split(',').map(s => s.trim()) : null,
    meeting_attendance_rate: formData.meeting_attendance_rate ? parseFloat(formData.meeting_attendance_rate) : null,
  };
}

function memberToFormData(member: BoardMember): FormData {
  return {
    member_name: member.member_name,
    role: member.role,
    member_type: member.member_type,
    gender: member.gender || '',
    age_bracket: member.age_bracket || '',
    ethnicity: member.ethnicity || '',
    expertise_areas: member.expertise_areas?.join(', ') || '',
    industry_experience: member.industry_experience || '',
    appointment_date: member.appointment_date || '',
    term_end_date: member.term_end_date || '',
    is_independent: member.is_independent || false,
    independence_assessment: member.independence_assessment || '',
    committee_memberships: member.committee_memberships?.join(', ') || '',
    meeting_attendance_rate: member.meeting_attendance_rate?.toString() || '',
  };
}

function BoardMemberFormFields({
  formData,
  setFormData,
}: {
  formData: FormData;
  setFormData: (data: FormData) => void;
}) {
  return (
    <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
      <div className="space-y-2">
        <Label htmlFor="member_name">Name *</Label>
        <Input
          id="member_name"
          value={formData.member_name}
          onChange={(e) => setFormData({ ...formData, member_name: e.target.value })}
          placeholder="e.g., Jane Smith"
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
          <Label htmlFor="term_end_date">Term End Date (optional)</Label>
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
  );
}

function AddBoardMemberDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<FormData>({ ...emptyFormData });

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

      const response = await fetch('/api/governance/board', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify(cleanFormData(formData)),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add board member');
      }

      setOpen(false);
      setFormData({ ...emptyFormData });
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
          <BoardMemberFormFields formData={formData} setFormData={setFormData} />
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

function EditBoardMemberDialog({
  member,
  open,
  onOpenChange,
  onSuccess,
}: {
  member: BoardMember;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<FormData>(memberToFormData(member));

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

      const response = await fetch('/api/governance/board', {
        method: 'PUT',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          id: member.id,
          ...cleanFormData(formData),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update board member');
      }

      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error('Error updating board member:', error);
      alert(error instanceof Error ? error.message : 'Failed to update board member');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Board Member</DialogTitle>
          <DialogDescription>
            Update board member details
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <BoardMemberFormFields formData={formData} setFormData={setFormData} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteBoardMemberDialog({
  member,
  open,
  onOpenChange,
  onConfirm,
}: {
  member: BoardMember;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove Board Member</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to remove {member.member_name} from the board? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            Remove
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default function BoardPage() {
  const { members, metrics, loading, refetch, deleteMember } = useBoardComposition();
  const [editingMember, setEditingMember] = useState<BoardMember | null>(null);
  const [deletingMember, setDeletingMember] = useState<BoardMember | null>(null);

  const handleDelete = async () => {
    if (!deletingMember) return;
    try {
      await deleteMember(deletingMember.id);
      setDeletingMember(null);
    } catch (error) {
      console.error('Error deleting board member:', error);
      alert(error instanceof Error ? error.message : 'Failed to delete board member');
    }
  };

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
      <BoardCompositionChart
        members={members}
        metrics={metrics}
        isLoading={loading}
        onEditMember={(member) => setEditingMember(member)}
        onDeleteMember={(member) => setDeletingMember(member)}
      />

      {/* Edit Dialog */}
      {editingMember && (
        <EditBoardMemberDialog
          member={editingMember}
          open={!!editingMember}
          onOpenChange={(open) => { if (!open) setEditingMember(null); }}
          onSuccess={refetch}
        />
      )}

      {/* Delete Confirmation */}
      {deletingMember && (
        <DeleteBoardMemberDialog
          member={deletingMember}
          open={!!deletingMember}
          onOpenChange={(open) => { if (!open) setDeletingMember(null); }}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}
