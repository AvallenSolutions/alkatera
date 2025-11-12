'use client';

import { useState, useEffect } from 'react';
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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle, Droplets, Calculator, Building2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useOrganization } from '@/lib/organizationContext';
import { PageLoader } from '@/components/ui/page-loader';
import { EmptyState } from '@/components/ui/empty-state';

const waterSchema = z.object({
  facility_id: z.string().optional(),
  water_source: z.string().min(1, 'Water source is required'),
  water_type: z.enum(['blue', 'green', 'grey'], {
    required_error: 'Water type is required',
  }),
  quantity: z.string().min(1, 'Quantity is required').refine(
    (val) => !isNaN(Number(val)) && Number(val) > 0,
    'Quantity must be a positive number'
  ),
  unit: z.enum(['litres', 'cubic meters', 'm3', 'gallons', 'ML', 'kL'], {
    required_error: 'Unit is required',
  }),
  activity_date: z.string().min(1, 'Activity date is required'),
  notes: z.string().optional(),
});

type WaterFormValues = z.infer<typeof waterSchema>;

interface Facility {
  id: string;
  name: string;
  location: string | null;
}

interface WaterActivityRecord {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  activity_date: string;
  created_at: string;
}

export default function WaterFootprintPage() {
  const { currentOrganization } = useOrganization();
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [recentData, setRecentData] = useState<WaterActivityRecord[]>([]);
  const [isLoadingFacilities, setIsLoadingFacilities] = useState(true);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);

  const form = useForm<WaterFormValues>({
    resolver: zodResolver(waterSchema),
    mode: 'onChange',
    defaultValues: {
      water_source: '',
      quantity: '',
      notes: '',
    },
  });

  const fetchFacilities = async () => {
    if (!currentOrganization?.id) {
      setIsLoadingFacilities(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('facilities')
        .select('id, name, location')
        .eq('organization_id', currentOrganization.id)
        .order('name', { ascending: true });

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
      setIsLoadingFacilities(false);
    }
  };

  const fetchRecentData = async () => {
    if (!currentOrganization?.id) {
      setIsLoadingData(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('activity_data')
        .select('id, name, quantity, unit, activity_date, created_at')
        .eq('organization_id', currentOrganization.id)
        .eq('category', 'Water')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        console.error('Error fetching recent water data:', error);
        toast.error('Failed to load recent data');
      } else {
        setRecentData(data || []);
      }
    } catch (error) {
      console.error('Error fetching recent water data:', error);
      toast.error('Failed to load recent data');
    } finally {
      setIsLoadingData(false);
    }
  };

  useEffect(() => {
    fetchFacilities();
    fetchRecentData();
  }, [currentOrganization?.id]);

  const onSubmit = async (data: WaterFormValues) => {
    if (!currentOrganization?.id) {
      toast.error('No organisation selected');
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: session } = await supabase.auth.getSession();

      if (!session.session) {
        toast.error('You must be logged in to submit water data');
        return;
      }

      const apiUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/ingest-water-data`;

      const payload: any = {
        water_source: data.water_source,
        quantity: Number(data.quantity),
        unit: data.unit,
        activity_date: data.activity_date,
        water_type: data.water_type,
      };

      if (data.facility_id) {
        payload.facility_id = data.facility_id;
      }

      if (data.notes) {
        payload.notes = data.notes;
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
        throw new Error(result.error || 'Failed to submit water data');
      }

      toast.success('Water consumption data submitted successfully');
      form.reset({
        water_source: '',
        quantity: '',
        notes: '',
      });
      await fetchRecentData();
    } catch (error) {
      console.error('Error submitting water data:', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to submit water data'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRunCalculations = async () => {
    if (!currentOrganization?.id) {
      toast.error('No organisation selected');
      return;
    }

    setIsCalculating(true);

    try {
      const { data: session } = await supabase.auth.getSession();

      if (!session.session) {
        toast.error('You must be logged in to run calculations');
        return;
      }

      const apiUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/invoke-water-calculations`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          organization_id: currentOrganization.id,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to run water footprint calculations');
      }

      const summary = result.summary;
      toast.success(
        `Water footprint calculations completed successfully. Processed ${summary?.activities_processed || 0} activities and created ${summary?.metrics_created || 0} metrics.`
      );
    } catch (error) {
      console.error('Error running water calculations:', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to run water footprint calculations'
      );
    } finally {
      setIsCalculating(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const getWaterTypeBadgeColor = (waterType: string) => {
    const type = waterType.toLowerCase();
    if (type.includes('blue')) {
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
    } else if (type.includes('green')) {
      return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
    } else if (type.includes('grey')) {
      return 'bg-slate-100 text-slate-800 dark:bg-slate-900/20 dark:text-slate-400';
    }
    return 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/20 dark:text-cyan-400';
  };

  if (isLoadingFacilities) {
    return <PageLoader message="Loading facilities..." />;
  }

  if (!facilities || facilities.length === 0) {
    return (
      <EmptyState
        icon={Building2}
        title="No Facilities Found"
        description="You must create a facility before you can add water data. Facilities help organise your water consumption data by location."
        actionLabel="Go to Facilities"
        actionHref="/company/facilities"
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-centre justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Water Footprint Data
          </h1>
          <p className="text-muted-foreground mt-2">
            Track water consumption and calculate your organisation's water footprint
          </p>
        </div>
        <Button
          onClick={handleRunCalculations}
          disabled={isCalculating || recentData.length === 0}
          size="lg"
          className="gap-2"
        >
          {isCalculating ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Calculating...
            </>
          ) : (
            <>
              <Calculator className="h-5 w-5" />
              Run Water Footprint Calculation
            </>
          )}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-centre gap-2">
            <Droplets className="h-5 w-5 text-blue-600" />
            Water Consumption Data Entry
          </CardTitle>
          <CardDescription>
            Enter water consumption data to calculate blue, green, and grey water footprints
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="facility">Facility (Optional)</Label>
                <Select
                  value={form.watch('facility_id')}
                  onValueChange={(value) =>
                    form.setValue('facility_id', value, {
                      shouldValidate: true,
                    })
                  }
                  disabled={isLoadingFacilities}
                >
                  <SelectTrigger id="facility">
                    <SelectValue placeholder="Select facility (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No facility</SelectItem>
                    {facilities.map((facility) => (
                      <SelectItem key={facility.id} value={facility.id}>
                        {facility.name}
                        {facility.location && ` (${facility.location})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="water-source">Water Source</Label>
                <Input
                  id="water-source"
                  placeholder="e.g., Municipal Supply, Groundwater, Rainwater"
                  {...form.register('water_source')}
                />
                {form.formState.errors.water_source && (
                  <p className="text-sm text-red-600">
                    {form.formState.errors.water_source.message}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="water-type">Water Type</Label>
                <Select
                  value={form.watch('water_type')}
                  onValueChange={(value) =>
                    form.setValue('water_type', value as any, {
                      shouldValidate: true,
                    })
                  }
                >
                  <SelectTrigger id="water-type">
                    <SelectValue placeholder="Select water type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="blue">Blue Water (Surface/Ground)</SelectItem>
                    <SelectItem value="green">Green Water (Rainwater)</SelectItem>
                    <SelectItem value="grey">Grey Water (Polluted)</SelectItem>
                  </SelectContent>
                </Select>
                {form.formState.errors.water_type && (
                  <p className="text-sm text-red-600">
                    {form.formState.errors.water_type.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  step="0.01"
                  placeholder="e.g., 5000"
                  {...form.register('quantity')}
                />
                {form.formState.errors.quantity && (
                  <p className="text-sm text-red-600">
                    {form.formState.errors.quantity.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="unit">Unit</Label>
                <Select
                  value={form.watch('unit')}
                  onValueChange={(value) =>
                    form.setValue('unit', value as any, {
                      shouldValidate: true,
                    })
                  }
                >
                  <SelectTrigger id="unit">
                    <SelectValue placeholder="Select unit" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="litres">Litres</SelectItem>
                    <SelectItem value="cubic meters">Cubic Metres (m³)</SelectItem>
                    <SelectItem value="m3">m³</SelectItem>
                    <SelectItem value="kL">Kilolitres (kL)</SelectItem>
                    <SelectItem value="ML">Megalitres (ML)</SelectItem>
                    <SelectItem value="gallons">Gallons</SelectItem>
                  </SelectContent>
                </Select>
                {form.formState.errors.unit && (
                  <p className="text-sm text-red-600">
                    {form.formState.errors.unit.message}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="activity-date">Activity Date</Label>
                <Input
                  id="activity-date"
                  type="date"
                  {...form.register('activity_date')}
                />
                {form.formState.errors.activity_date && (
                  <p className="text-sm text-red-600">
                    {form.formState.errors.activity_date.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Input
                  id="notes"
                  placeholder="Additional context or details"
                  {...form.register('notes')}
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={!form.formState.isValid || isSubmitting}
              className="w-full md:w-auto"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit Water Data'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Water Consumption Data</CardTitle>
          <CardDescription>
            10 most recently submitted water consumption records
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingData ? (
            <div className="flex items-centre justify-centre py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : recentData.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No water consumption data found. Submit your first entry using the form above.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Source / Activity</TableHead>
                    <TableHead>Water Type</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead>Submitted</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentData.map((record) => {
                    const waterType = record.name.toLowerCase().includes('blue')
                      ? 'blue'
                      : record.name.toLowerCase().includes('green')
                      ? 'green'
                      : record.name.toLowerCase().includes('grey')
                      ? 'grey'
                      : 'consumption';

                    return (
                      <TableRow key={record.id}>
                        <TableCell>{formatDate(record.activity_date)}</TableCell>
                        <TableCell className="font-medium">{record.name}</TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex items-centre gap-1 px-2 py-1 rounded-full text-xs font-medium ${getWaterTypeBadgeColor(
                              waterType
                            )}`}
                          >
                            <Droplets className="h-3 w-3" />
                            {waterType.charAt(0).toUpperCase() + waterType.slice(1)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          {record.quantity.toLocaleString()} {record.unit}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {formatDate(record.created_at)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
