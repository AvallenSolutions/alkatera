'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, AlertCircle } from 'lucide-react';
import { useFacilities, type CreateFacilityData } from '@/hooks/data/useFacilities';

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

const facilitySchema = z.object({
  name: z.string().min(1, 'Facility name is required').max(255),
  facility_type: z.string().min(1, 'Facility type is required'),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().min(1, 'Country is required'),
  data_source_type: z.enum(['internal', 'supplier_managed'], {
    required_error: 'Please select who operates this facility',
  }),
  supplier_id: z.string().optional(),
});

type FacilityFormValues = z.infer<typeof facilitySchema>;

interface AddFacilityModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddFacilityModal({ open, onOpenChange }: AddFacilityModalProps) {
  const { createFacility } = useFacilities();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FacilityFormValues>({
    resolver: zodResolver(facilitySchema),
    mode: 'onChange',
    defaultValues: {
      name: '',
      facility_type: '',
      address: '',
      city: '',
      country: '',
      data_source_type: 'internal',
      supplier_id: '',
    },
  });

  const dataSourceType = form.watch('data_source_type');

  const handleClose = () => {
    form.reset();
    onOpenChange(false);
  };

  const onSubmit = async (data: FacilityFormValues) => {
    setIsSubmitting(true);

    try {
      const facilityData: CreateFacilityData = {
        name: data.name,
        facility_type: data.facility_type,
        address: data.address,
        city: data.city,
        country: data.country,
        data_source_type: data.data_source_type,
        supplier_id: data.supplier_id,
      };

      await createFacility(facilityData);

      toast.success('Facility created successfully');
      handleClose();
    } catch (error: any) {
      console.error('Error creating facility:', error);
      toast.error(error.message || 'Failed to create facility');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Facility</DialogTitle>
          <DialogDescription>
            Enter the facility details below to create a new facility
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>Who operates this facility? *</Label>
            <RadioGroup
              value={form.watch('data_source_type')}
              onValueChange={(value) => {
                form.setValue('data_source_type', value as 'internal' | 'supplier_managed', {
                  shouldValidate: true,
                });
                if (value === 'internal') {
                  form.setValue('supplier_id', '');
                }
              }}
              className="flex flex-col space-y-2"
            >
              <div className="flex items-center space-x-2 border rounded-lg p-4 cursor-pointer hover:bg-muted/50">
                <RadioGroupItem value="internal" id="internal" />
                <Label htmlFor="internal" className="flex-1 cursor-pointer">
                  <div className="font-medium">Owned by my company</div>
                  <div className="text-sm text-muted-foreground">
                    You will provide the activity data for this facility
                  </div>
                </Label>
              </div>
              <div className="flex items-center space-x-2 border rounded-lg p-4 cursor-pointer hover:bg-muted/50">
                <RadioGroupItem value="supplier_managed" id="supplier_managed" />
                <Label htmlFor="supplier_managed" className="flex-1 cursor-pointer">
                  <div className="font-medium">Operated by a supplier</div>
                  <div className="text-sm text-muted-foreground">
                    The supplier will provide the activity data via the Supplier Portal
                  </div>
                </Label>
              </div>
            </RadioGroup>
            {form.formState.errors.data_source_type && (
              <p className="text-sm text-red-600">
                {form.formState.errors.data_source_type.message}
              </p>
            )}
          </div>

          {dataSourceType === 'supplier_managed' && (
            <div className="space-y-2">
              <Label htmlFor="supplier_id">Select Supplier</Label>
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
                  <SelectItem value="supplier-placeholder-1">
                    Supplier Network (Coming Soon)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="name">Facility Name *</Label>
            <Input
              id="name"
              placeholder="e.g., Main Manufacturing Plant"
              {...form.register('name')}
            />
            {form.formState.errors.name && (
              <p className="text-sm text-red-600">{form.formState.errors.name.message}</p>
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
              <Input id="city" placeholder="e.g., Manchester" {...form.register('city')} />
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
                <p className="text-sm text-red-600">{form.formState.errors.country.message}</p>
              )}
            </div>
          </div>

          {dataSourceType === 'internal' && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Next Steps</AlertTitle>
              <AlertDescription>
                You will be responsible for providing the activity data (e.g., energy, water, waste)
                for this facility.
              </AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={!form.formState.isValid || isSubmitting}>
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
  );
}
