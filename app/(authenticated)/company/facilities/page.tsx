'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, AlertCircle, Building2, MapPin } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useOrganization } from '@/lib/organizationContext';
import { PageLoader } from '@/components/ui/page-loader';
import { useFacilityTypes } from '@/hooks/data/useFacilityTypes';
import { useFacilities } from '@/hooks/data/useFacilities';

const FACILITY_TYPE_OPTIONS = ['Agriculture', 'Production', 'Packing', 'Warehousing', 'Office'];

const COUNTRY_OPTIONS = [
  'United Kingdom',
  'United States',
  'France',
  'Germany',
  'Spain',
  'Italy',
  'Netherlands',
  'Belgium',
  'Ireland',
  'China',
  'India',
  'Other',
];

const createFacilitySchema = (dataSourceType: 'internal' | 'supplier_managed') => {
  return z.object({
    name: z.string().min(1, 'Facility name is required').max(255),
    facility_type: z.string().min(1, 'Facility type is required'),
    address: z.string().optional(),
    city: z.string().optional(),
    country: z.string().min(1, 'Country is required'),
    supplier_id: dataSourceType === 'supplier_managed'
      ? z.string().min(1, 'Supplier is required when selecting supplier management')
      : z.string().optional(),
  });
};

type FacilityFormValues = {
  name: string;
  facility_type: string;
  address?: string;
  city?: string;
  country: string;
  supplier_id?: string;
};

export default function FacilitiesPage() {
  const router = useRouter();
  const { currentOrganization } = useOrganization();
  const { facilities, isLoading, refetch } = useFacilities(currentOrganization?.id);
  const { facilityTypes } = useFacilityTypes();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dataSourceType, setDataSourceType] = useState<'internal' | 'supplier_managed'>('internal');

  const form = useForm<FacilityFormValues>({
    resolver: zodResolver(createFacilitySchema(dataSourceType)),
    mode: 'onChange',
    defaultValues: {
      name: '',
      facility_type: '',
      address: '',
      city: '',
      country: '',
      supplier_id: '',
    },
  });

  useEffect(() => {
    form.clearErrors();
    const currentValues = form.getValues();
    form.reset(currentValues, { keepValues: true });
  }, [dataSourceType]);

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setDataSourceType('internal');
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
        action: 'create',
        name: data.name.trim(),
        facility_type: data.facility_type,
        country: data.country,
        data_source_type: dataSourceType,
      };

      if (data.address && data.address.trim()) {
        payload.address = data.address.trim();
      }

      if (data.city && data.city.trim()) {
        payload.city = data.city.trim();
      }

      if (dataSourceType === 'supplier_managed' && data.supplier_id) {
        payload.supplier_id = data.supplier_id;
      }

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create facility');
      }

      const result = await response.json();

      toast.success('Facility created successfully');
      handleCloseDialog();
      refetch();
    } catch (error: any) {
      console.error('Error creating facility:', error);
      toast.error(error.message || 'Failed to create facility');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRowClick = (facilityId: string) => {
    router.push(`/company/facilities/${facilityId}`);
  };

  if (isLoading) {
    return <PageLoader />;
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Facilities</h1>
          <p className="text-muted-foreground mt-1">
            Manage your company and supplier facilities
          </p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add New Facility
        </Button>
      </div>

      {facilities.length === 0 ? (
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-4">
            <div className="rounded-full bg-muted p-4 inline-block">
              <Building2 className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold text-lg">No facilities yet</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                Create your first facility to start tracking emissions and activity data.
              </p>
            </div>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add New Facility
            </Button>
          </div>
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Facility Name</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Data Source</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {facilities.map((facility) => (
                <TableRow
                  key={facility.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleRowClick(facility.id)}
                >
                  <TableCell className="font-medium">{facility.name}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      {[facility.city, facility.country].filter(Boolean).join(', ') || 'Not specified'}
                    </div>
                  </TableCell>
                  <TableCell>
                    {facility.facility_type?.name || 'Not specified'}
                  </TableCell>
                  <TableCell>
                    {facility.data_source_type === 'internal' ? (
                      <Badge variant="default" className="bg-blue-600">
                        Owned
                      </Badge>
                    ) : (
                      <Badge variant="secondary">
                        Supplier
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Facility</DialogTitle>
            <DialogDescription>
              Enter the facility details below to create a new facility
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
              <Label htmlFor="facility_type">Facility Type *</Label>
              <Select
                value={form.watch('facility_type')}
                onValueChange={(value) => {
                  form.setValue('facility_type', value, { shouldValidate: true });
                }}
              >
                <SelectTrigger id="facility_type">
                  <SelectValue placeholder="Select facility type" />
                </SelectTrigger>
                <SelectContent>
                  {FACILITY_TYPE_OPTIONS.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.facility_type && (
                <p className="text-sm text-red-600">
                  {form.formState.errors.facility_type.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Textarea
                id="address"
                placeholder="e.g., 123 Industrial Estate, Manchester"
                rows={3}
                {...form.register('address')}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  placeholder="e.g., Manchester"
                  {...form.register('city')}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="country">Country *</Label>
                <Select
                  value={form.watch('country')}
                  onValueChange={(value) => {
                    form.setValue('country', value, { shouldValidate: true });
                  }}
                >
                  <SelectTrigger id="country">
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRY_OPTIONS.map((country) => (
                      <SelectItem key={country} value={country}>
                        {country}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.country && (
                  <p className="text-sm text-red-600">
                    {form.formState.errors.country.message}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Who operates this facility?</Label>
              <ToggleGroup
                type="single"
                value={dataSourceType}
                onValueChange={(value) => {
                  if (value) {
                    setDataSourceType(value as 'internal' | 'supplier_managed');
                    if (value === 'internal') {
                      form.setValue('supplier_id', '');
                    }
                  }
                }}
                className="justify-start"
              >
                <ToggleGroupItem value="internal" className="flex-1">
                  My Company
                </ToggleGroupItem>
                <ToggleGroupItem value="supplier_managed" className="flex-1">
                  A Third-Party Supplier
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            {dataSourceType === 'internal' && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Next Steps</AlertTitle>
                <AlertDescription>
                  You will be responsible for providing the activity data (e.g., energy, water, waste) for this facility.
                </AlertDescription>
              </Alert>
            )}

            {dataSourceType === 'supplier_managed' && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="supplier_id">Select the supplier who operates this facility *</Label>
                  <Select
                    value={form.watch('supplier_id') || '__none__'}
                    onValueChange={(value) => {
                      const finalValue = value === '__none__' ? '' : value;
                      form.setValue('supplier_id', finalValue, {
                        shouldValidate: true,
                      });
                    }}
                  >
                    <SelectTrigger id="supplier_id">
                      <SelectValue placeholder="Search for a supplier..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Select a supplier</SelectItem>
                      <SelectItem value="supplier-placeholder-1">Supplier Network (Coming Soon)</SelectItem>
                    </SelectContent>
                  </Select>
                  {form.formState.errors.supplier_id && (
                    <p className="text-sm text-red-600">
                      {form.formState.errors.supplier_id.message}
                    </p>
                  )}
                </div>

                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Next Steps</AlertTitle>
                  <AlertDescription>
                    The selected supplier will be invited to provide data for this facility via the Supplier Portal.
                  </AlertDescription>
                </Alert>
              </div>
            )}

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
                    Creating...
                  </>
                ) : (
                  'Create Facility'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
