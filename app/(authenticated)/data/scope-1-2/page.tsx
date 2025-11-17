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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle, CheckCircle2, Calculator, Flame, Zap } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useOrganization } from '@/lib/organizationContext';

const scope1Schema = z.object({
  facility_id: z.string().min(1, 'Facility is required'),
  fuel_type: z.string().min(1, 'Fuel type is required'),
  amount: z.string().min(1, 'Amount is required').refine(
    (val) => !isNaN(Number(val)) && Number(val) > 0,
    'Amount must be a positive number'
  ),
  unit: z.enum(['litres', 'kWh', 'cubic meters', 'kg', 'tonnes'], {
    required_error: 'Unit is required',
  }),
  activity_date: z.string().min(1, 'Activity date is required'),
});

const scope2Schema = z.object({
  facility_id: z.string().min(1, 'Facility is required'),
  amount: z.string().min(1, 'Electricity consumed is required').refine(
    (val) => !isNaN(Number(val)) && Number(val) > 0,
    'Amount must be a positive number'
  ),
  unit: z.enum(['kWh', 'MWh'], {
    required_error: 'Unit is required',
  }),
  activity_date: z.string().min(1, 'Activity date is required'),
});

type Scope1FormValues = z.infer<typeof scope1Schema>;
type Scope2FormValues = z.infer<typeof scope2Schema>;

interface Facility {
  id: string;
  name: string;
  location: string | null;
}

interface ActivityDataRecord {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  activity_date: string;
  created_at: string;
}

export default function Scope12DataPage() {
  const { currentOrganization } = useOrganization();
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [recentData, setRecentData] = useState<ActivityDataRecord[]>([]);
  const [isLoadingFacilities, setIsLoadingFacilities] = useState(true);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [activeTab, setActiveTab] = useState('scope1');

  const scope1Form = useForm<Scope1FormValues>({
    resolver: zodResolver(scope1Schema),
    mode: 'onChange',
  });

  const scope2Form = useForm<Scope2FormValues>({
    resolver: zodResolver(scope2Schema),
    mode: 'onChange',
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
        .select('id, name, category, quantity, unit, activity_date, created_at')
        .eq('organization_id', currentOrganization.id)
        .in('category', ['Scope 1', 'Scope 2'])
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        console.error('Error fetching recent data:', error);
        toast.error('Failed to load recent data');
      } else {
        setRecentData(data || []);
      }
    } catch (error) {
      console.error('Error fetching recent data:', error);
      toast.error('Failed to load recent data');
    } finally {
      setIsLoadingData(false);
    }
  };

  useEffect(() => {
    fetchFacilities();
    fetchRecentData();
  }, [currentOrganization?.id]);

  const onSubmitScope1 = async (data: Scope1FormValues) => {
    if (!currentOrganization?.id) {
      toast.error('No organisation selected');
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: session } = await supabase.auth.getSession();

      if (!session.session) {
        toast.error('You must be logged in to submit activity data');
        return;
      }

      const facility = facilities.find(f => f.id === data.facility_id);
      const activityName = `${facility?.name} - ${data.fuel_type}`;

      const apiUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/ingest-activity-data`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: activityName,
          category: 'Scope 1',
          quantity: Number(data.amount),
          unit: data.unit,
          activity_date: data.activity_date,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to submit Scope 1 data');
      }

      toast.success('Scope 1 activity data submitted successfully');
      scope1Form.reset();
      await fetchRecentData();
    } catch (error) {
      console.error('Error submitting Scope 1 data:', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to submit Scope 1 data'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const onSubmitScope2 = async (data: Scope2FormValues) => {
    if (!currentOrganization?.id) {
      toast.error('No organisation selected');
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: session } = await supabase.auth.getSession();

      if (!session.session) {
        toast.error('You must be logged in to submit activity data');
        return;
      }

      const facility = facilities.find(f => f.id === data.facility_id);
      const activityName = `${facility?.name} - Electricity`;

      const apiUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/ingest-activity-data`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: activityName,
          category: 'Scope 2',
          quantity: Number(data.amount),
          unit: data.unit,
          activity_date: data.activity_date,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to submit Scope 2 data');
      }

      toast.success('Scope 2 activity data submitted successfully');
      scope2Form.reset();
      await fetchRecentData();
    } catch (error) {
      console.error('Error submitting Scope 2 data:', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to submit Scope 2 data'
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

      const apiUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/invoke-scope1-2-calculations`;

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
        throw new Error(result.error || 'Failed to run calculations');
      }

      toast.success(result.message || 'Calculations completed successfully');
    } catch (error) {
      console.error('Error running calculations:', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to run calculations'
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Scope 1 & 2 Data Ingestion
          </h1>
          <p className="text-muted-foreground mt-2">
            Track direct and indirect GHG emissions from your operations
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
              Run Scope 1 & 2 Calculation
            </>
          )}
        </Button>
      </div>

      {facilities.length === 0 && !isLoadingFacilities && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No facilities found. Please add facilities to your organisation before entering activity data.
          </AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="scope1" className="gap-2">
            <Flame className="h-4 w-4" />
            Scope 1: Direct Emissions
          </TabsTrigger>
          <TabsTrigger value="scope2" className="gap-2">
            <Zap className="h-4 w-4" />
            Scope 2: Indirect Emissions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="scope1">
          <Card>
            <CardHeader>
              <CardTitle>Scope 1: Stationary Combustion</CardTitle>
              <CardDescription>
                Enter data for direct emissions from fuel combustion in owned or controlled equipment
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={scope1Form.handleSubmit(onSubmitScope1)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="scope1-facility">Facility</Label>
                    <Select
                      value={scope1Form.watch('facility_id')}
                      onValueChange={(value) =>
                        scope1Form.setValue('facility_id', value, {
                          shouldValidate: true,
                        })
                      }
                      disabled={isLoadingFacilities || facilities.length === 0}
                    >
                      <SelectTrigger id="scope1-facility">
                        <SelectValue placeholder="Select facility" />
                      </SelectTrigger>
                      <SelectContent>
                        {facilities.map((facility) => (
                          <SelectItem key={facility.id} value={facility.id}>
                            {facility.name}
                            {facility.location && ` (${facility.location})`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {scope1Form.formState.errors.facility_id && (
                      <p className="text-sm text-red-600">
                        {scope1Form.formState.errors.facility_id.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="scope1-fuel-type">Fuel Type</Label>
                    <Input
                      id="scope1-fuel-type"
                      placeholder="e.g., Natural Gas, Diesel"
                      {...scope1Form.register('fuel_type')}
                    />
                    {scope1Form.formState.errors.fuel_type && (
                      <p className="text-sm text-red-600">
                        {scope1Form.formState.errors.fuel_type.message}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="scope1-amount">Amount Consumed</Label>
                    <Input
                      id="scope1-amount"
                      type="number"
                      step="0.01"
                      placeholder="e.g., 1500"
                      {...scope1Form.register('amount')}
                    />
                    {scope1Form.formState.errors.amount && (
                      <p className="text-sm text-red-600">
                        {scope1Form.formState.errors.amount.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="scope1-unit">Unit</Label>
                    <Select
                      value={scope1Form.watch('unit')}
                      onValueChange={(value) =>
                        scope1Form.setValue('unit', value as any, {
                          shouldValidate: true,
                        })
                      }
                    >
                      <SelectTrigger id="scope1-unit">
                        <SelectValue placeholder="Select unit" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="litres">Litres</SelectItem>
                        <SelectItem value="kWh">kWh</SelectItem>
                        <SelectItem value="cubic meters">Cubic Metres</SelectItem>
                        <SelectItem value="kg">Kilograms</SelectItem>
                        <SelectItem value="tonnes">Tonnes</SelectItem>
                      </SelectContent>
                    </Select>
                    {scope1Form.formState.errors.unit && (
                      <p className="text-sm text-red-600">
                        {scope1Form.formState.errors.unit.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="scope1-date">Activity Date</Label>
                    <Input
                      id="scope1-date"
                      type="date"
                      {...scope1Form.register('activity_date')}
                    />
                    {scope1Form.formState.errors.activity_date && (
                      <p className="text-sm text-red-600">
                        {scope1Form.formState.errors.activity_date.message}
                      </p>
                    )}
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={!scope1Form.formState.isValid || isSubmitting || facilities.length === 0}
                  className="w-full md:w-auto"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    'Submit Scope 1 Data'
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scope2">
          <Card>
            <CardHeader>
              <CardTitle>Scope 2: Purchased Electricity</CardTitle>
              <CardDescription>
                Enter data for indirect emissions from purchased electricity consumption
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={scope2Form.handleSubmit(onSubmitScope2)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="scope2-facility">Facility</Label>
                  <Select
                    value={scope2Form.watch('facility_id')}
                    onValueChange={(value) =>
                      scope2Form.setValue('facility_id', value, {
                        shouldValidate: true,
                      })
                    }
                    disabled={isLoadingFacilities || facilities.length === 0}
                  >
                    <SelectTrigger id="scope2-facility">
                      <SelectValue placeholder="Select facility" />
                    </SelectTrigger>
                    <SelectContent>
                      {facilities.map((facility) => (
                        <SelectItem key={facility.id} value={facility.id}>
                          {facility.name}
                          {facility.location && ` (${facility.location})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {scope2Form.formState.errors.facility_id && (
                    <p className="text-sm text-red-600">
                      {scope2Form.formState.errors.facility_id.message}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="scope2-amount">Electricity Consumed</Label>
                    <Input
                      id="scope2-amount"
                      type="number"
                      step="0.01"
                      placeholder="e.g., 25000"
                      {...scope2Form.register('amount')}
                    />
                    {scope2Form.formState.errors.amount && (
                      <p className="text-sm text-red-600">
                        {scope2Form.formState.errors.amount.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="scope2-unit">Unit</Label>
                    <Select
                      value={scope2Form.watch('unit')}
                      onValueChange={(value) =>
                        scope2Form.setValue('unit', value as any, {
                          shouldValidate: true,
                        })
                      }
                    >
                      <SelectTrigger id="scope2-unit">
                        <SelectValue placeholder="Select unit" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="kWh">kWh (kilowatt-hours)</SelectItem>
                        <SelectItem value="MWh">MWh (megawatt-hours)</SelectItem>
                      </SelectContent>
                    </Select>
                    {scope2Form.formState.errors.unit && (
                      <p className="text-sm text-red-600">
                        {scope2Form.formState.errors.unit.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="scope2-date">Activity Date</Label>
                    <Input
                      id="scope2-date"
                      type="date"
                      {...scope2Form.register('activity_date')}
                    />
                    {scope2Form.formState.errors.activity_date && (
                      <p className="text-sm text-red-600">
                        {scope2Form.formState.errors.activity_date.message}
                      </p>
                    )}
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={!scope2Form.formState.isValid || isSubmitting || facilities.length === 0}
                  className="w-full md:w-auto"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    'Submit Scope 2 Data'
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity Data</CardTitle>
          <CardDescription>
            10 most recently submitted Scope 1 & 2 activity records
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingData ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : recentData.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No activity data found. Submit your first entry using the form above.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Facility / Activity</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Submitted</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentData.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>{formatDate(record.activity_date)}</TableCell>
                      <TableCell className="font-medium">{record.name}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                          record.category === 'Scope 1'
                            ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400'
                            : 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
                        }`}>
                          {record.category === 'Scope 1' ? (
                            <Flame className="h-3 w-3" />
                          ) : (
                            <Zap className="h-3 w-3" />
                          )}
                          {record.category}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {record.quantity.toLocaleString()} {record.unit}
                      </TableCell>
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
  );
}
