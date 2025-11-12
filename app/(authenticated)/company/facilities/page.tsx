'use client';

import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Building2, Pencil, Trash2, Plus, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useOrganization } from '@/lib/organizationContext';
import { PageLoader } from '@/components/ui/page-loader';
import { useFacilityTypes } from '@/hooks/data/useFacilityTypes';

const facilitySchema = z.object({
  name: z.string().min(1, 'Facility name is required').max(255),
  location: z.string().optional(),
  facility_type_id: z.string().optional(),
});

type FacilityFormValues = z.infer<typeof facilitySchema>;

interface Facility {
  id: string;
  name: string;
  location: string | null;
  facility_type_id: string | null;
  facility_type?: { name: string } | null;
  created_at: string;
  updated_at: string;
}

export default function FacilitiesPage() {
  const { currentOrganization } = useOrganization();
  const { facilityTypes, isLoading: isLoadingTypes } = useFacilityTypes();
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingFacility, setEditingFacility] = useState<Facility | null>(null);
  const [facilityToDelete, setFacilityToDelete] = useState<Facility | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const form = useForm<FacilityFormValues>({
    resolver: zodResolver(facilitySchema),
    mode: 'onChange',
    defaultValues: {
      name: '',
      location: '',
      facility_type_id: '',
    },
  });

  const fetchFacilities = useCallback(async () => {
    if (!currentOrganization?.id) {
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('facilities')
        .select(`
          *,
          facility_type:facility_types(name)
        `)
        .eq('organization_id', currentOrganization.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching facilities:', error);
        toast.error('Failed to load facilities');
      } else {
        setFacilities(data || []);
      }
    } catch (error) {
      console.error('Error fetching facilities:', error);
      toast.error('Failed to load facilities');
    } finally {
      setIsLoading(false);
    }
  }, [currentOrganization?.id]);

  useEffect(() => {
    fetchFacilities();
  }, [fetchFacilities]);

  const handleOpenDialog = (facility?: Facility) => {
    if (facility) {
      setEditingFacility(facility);
      form.reset({
        name: facility.name,
        location: facility.location || '',
        facility_type_id: facility.facility_type_id || '',
      });
    } else {
      setEditingFacility(null);
      form.reset({
        name: '',
        location: '',
        facility_type_id: '',
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingFacility(null);
    form.reset();
  };

  const onSubmit = async (data: FacilityFormValues) => {
    if (!currentOrganization?.id) {
      toast.error('No organisation selected');
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: session } = await supabase.auth.getSession();

      if (!session.session) {
        toast.error('You must be logged in');
        return;
      }

      const apiUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/manage-facility`;

      const payload: any = {
        action: editingFacility ? 'update' : 'create',
        name: data.name.trim(),
      };

      if (editingFacility) {
        payload.facility_id = editingFacility.id;
      }

      if (data.location && data.location.trim()) {
        payload.location = data.location.trim();
      }

      if (data.facility_type_id) {
        payload.facility_type_id = data.facility_type_id;
      }

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to save facility');
      }

      toast.success(
        editingFacility
          ? 'Facility updated successfully'
          : 'Facility created successfully'
      );

      handleCloseDialog();
      await fetchFacilities();
    } catch (error) {
      console.error('Error saving facility:', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to save facility'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteFacility = async () => {
    if (!facilityToDelete || !currentOrganization?.id) {
      return;
    }

    setIsDeleting(true);

    try {
      const { data: session } = await supabase.auth.getSession();

      if (!session.session) {
        toast.error('You must be logged in');
        return;
      }

      const apiUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/manage-facility`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'delete',
          facility_id: facilityToDelete.id,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete facility');
      }

      toast.success('Facility deleted successfully');
      setFacilityToDelete(null);
      await fetchFacilities();
    } catch (error) {
      console.error('Error deleting facility:', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to delete facility'
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  if (isLoading) {
    return <PageLoader message="Loading facilities..." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Manage Facilities</h1>
          <p className="text-muted-foreground mt-2">
            Add and manage your organisation's operational facilities
          </p>
        </div>
        <Button onClick={() => handleOpenDialog()} size="lg" className="gap-2">
          <Plus className="h-5 w-5" />
          Add New Facility
        </Button>
      </div>

      {facilities.length === 0 ? (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No facilities found. Create your first facility to get started.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Location/Address</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {facilities.map((facility) => (
                <TableRow key={facility.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      {facility.name}
                    </div>
                  </TableCell>
                  <TableCell>
                    {facility.location || (
                      <span className="text-muted-foreground italic">Not specified</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {facility.facility_type?.name || (
                      <span className="text-muted-foreground italic">Not specified</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(facility.created_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenDialog(facility)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setFacilityToDelete(facility)}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingFacility ? 'Edit Facility' : 'Add New Facility'}
            </DialogTitle>
            <DialogDescription>
              {editingFacility
                ? 'Update the facility details below'
                : 'Enter the facility details below'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Facility Name *</Label>
              <Input
                id="name"
                placeholder="e.g., Main Manufacturing Plant"
                {...form.register('name')}
              />
              {form.formState.errors.name && (
                <p className="text-sm text-red-600">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Location/Address</Label>
              <Input
                id="location"
                placeholder="e.g., 123 Industrial Estate, Manchester"
                {...form.register('location')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="facility_type_id">Facility Type</Label>
              <Select
                value={form.watch('facility_type_id') || ''}
                onValueChange={(value) =>
                  form.setValue('facility_type_id', value, {
                    shouldValidate: true,
                  })
                }
                disabled={isLoadingTypes}
              >
                <SelectTrigger id="facility_type_id">
                  <SelectValue placeholder="Select facility type (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No type</SelectItem>
                  {facilityTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleCloseDialog}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!form.formState.isValid || isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : editingFacility ? (
                  'Update Facility'
                ) : (
                  'Create Facility'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!facilityToDelete}
        onOpenChange={(open) => !open && setFacilityToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Facility</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{facilityToDelete?.name}"? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteFacility}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
