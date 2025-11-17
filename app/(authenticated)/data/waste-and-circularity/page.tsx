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
import { Loader2, Trash2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useOrganization } from '@/lib/organizationContext';

const wasteActivitySchema = z.object({
  activityType: z.string().min(1, 'Activity type is required'),
  quantity: z.string().min(1, 'Quantity is required').refine(
    (val) => !isNaN(Number(val)) && Number(val) > 0,
    'Quantity must be a positive number'
  ),
  unit: z.enum(['kg', 'tonnes'], {
    required_error: 'Unit is required',
  }),
  activity_date: z.string().min(1, 'Activity date is required'),
});

type WasteActivityFormValues = z.infer<typeof wasteActivitySchema>;

interface ActivityDataRecord {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  activity_date: string;
  created_at: string;
}

const wasteActivityTypes = [
  { value: 'Waste to Landfill', label: 'Waste to Landfill' },
  { value: 'Waste Recycled', label: 'Waste Recycled' },
  { value: 'Waste Composted', label: 'Waste Composted' },
  { value: 'Waste Incinerated', label: 'Waste Incinerated' },
  { value: 'Waste to Anaerobic Digestion', label: 'Waste to Anaerobic Digestion' },
  { value: 'Wastewater Treatment', label: 'Wastewater Treatment' },
];

export default function WasteAndCircularityPage() {
  const { currentOrganization } = useOrganization();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [wasteData, setWasteData] = useState<ActivityDataRecord[]>([]);
  const [showSuccess, setShowSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isValid },
  } = useForm<WasteActivityFormValues>({
    resolver: zodResolver(wasteActivitySchema),
    mode: 'onChange',
  });

  const activityType = watch('activityType');
  const unit = watch('unit');

  const fetchWasteData = async () => {
    if (!currentOrganization?.id) {
      setIsLoadingData(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('activity_data')
        .select('id, name, category, quantity, unit, activity_date, created_at')
        .eq('organization_id', currentOrganization.id)
        .eq('category', 'Waste')
        .order('activity_date', { ascending: false });

      if (error) {
        console.error('Error fetching waste data:', error);
        toast.error('Failed to load waste data');
      } else {
        setWasteData(data || []);
      }
    } catch (error) {
      console.error('Error fetching waste data:', error);
      toast.error('Failed to load waste data');
    } finally {
      setIsLoadingData(false);
    }
  };

  useEffect(() => {
    fetchWasteData();
  }, [currentOrganization?.id]);

  const onSubmit = async (data: WasteActivityFormValues) => {
    if (!currentOrganization?.id) {
      toast.error('No organisation selected');
      return;
    }

    setIsSubmitting(true);
    setShowSuccess(false);

    try {
      const { data: session } = await supabase.auth.getSession();

      if (!session.session) {
        toast.error('You must be logged in to submit activity data');
        return;
      }

      const apiUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/ingest-activity-data`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: data.activityType,
          category: 'Waste',
          quantity: Number(data.quantity),
          unit: data.unit,
          activity_date: data.activity_date,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to submit waste activity data');
      }

      toast.success('Waste activity data submitted successfully');
      setShowSuccess(true);
      reset();

      setTimeout(() => setShowSuccess(false), 5000);

      await fetchWasteData();
    } catch (error) {
      console.error('Error submitting waste activity data:', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to submit waste activity data'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Waste & Circularity Data Entry
          </h1>
          <p className="text-muted-foreground mt-2">
            Track and manage your organisation's waste activities and circular economy initiatives
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>Add Waste Activity</CardTitle>
                <CardDescription>
                  Submit waste data for emissions calculations
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="activityType">Activity Type</Label>
                    <Select
                      value={activityType}
                      onValueChange={(value) =>
                        setValue('activityType', value, {
                          shouldValidate: true,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select waste activity type" />
                      </SelectTrigger>
                      <SelectContent>
                        {wasteActivityTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.activityType && (
                      <p className="text-sm text-red-600">
                        {errors.activityType.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="quantity">Quantity</Label>
                    <Input
                      id="quantity"
                      type="number"
                      step="0.01"
                      placeholder="e.g., 150"
                      {...register('quantity')}
                    />
                    {errors.quantity && (
                      <p className="text-sm text-red-600">
                        {errors.quantity.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="unit">Unit</Label>
                    <Select
                      value={unit}
                      onValueChange={(value) =>
                        setValue('unit', value as 'kg' | 'tonnes', {
                          shouldValidate: true,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select unit" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="kg">Kilograms (kg)</SelectItem>
                        <SelectItem value="tonnes">Tonnes</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.unit && (
                      <p className="text-sm text-red-600">{errors.unit.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="activity_date">Activity Date</Label>
                    <Input
                      id="activity_date"
                      type="date"
                      {...register('activity_date')}
                    />
                    {errors.activity_date && (
                      <p className="text-sm text-red-600">
                        {errors.activity_date.message}
                      </p>
                    )}
                  </div>

                  {showSuccess && (
                    <Alert className="bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-900">
                      <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                      <AlertDescription className="text-green-800 dark:text-green-200">
                        Waste activity submitted successfully!
                      </AlertDescription>
                    </Alert>
                  )}

                  <Button
                    type="submit"
                    disabled={!isValid || isSubmitting}
                    className="w-full"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      'Submit Waste Activity'
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Waste Activity History</CardTitle>
                <CardDescription>
                  View all submitted waste activities for your organisation
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingData ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : wasteData.length === 0 ? (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      No waste activity data found. Submit your first entry using the form.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Activity Type</TableHead>
                          <TableHead className="text-right">Quantity</TableHead>
                          <TableHead>Unit</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Submitted</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {wasteData.map((record) => (
                          <TableRow key={record.id}>
                            <TableCell className="font-medium">
                              {record.name}
                            </TableCell>
                            <TableCell className="text-right">
                              {record.quantity.toLocaleString()}
                            </TableCell>
                            <TableCell>{record.unit}</TableCell>
                            <TableCell>{formatDate(record.activity_date)}</TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {formatDate(record.created_at)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
