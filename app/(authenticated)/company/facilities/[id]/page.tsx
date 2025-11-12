'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
import {
  Loader2,
  ArrowLeft,
  Save,
  Archive,
  Trash2,
  AlertCircle,
  FileText,
  ExternalLink,
} from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/lib/supabaseClient';
import { PageLoader } from '@/components/ui/page-loader';
import { DqiAwareKpi } from '@/components/ui/dqi-aware-kpi';
import { Separator } from '@/components/ui/separator';
import { useFacilities, type Facility } from '@/hooks/data/useFacilities';

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

const facilityEditSchema = z.object({
  name: z.string().min(1, 'Facility name is required').max(255),
  facility_type: z.string().min(1, 'Facility type is required'),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().min(1, 'Country is required'),
});

type FacilityEditFormValues = z.infer<typeof facilityEditSchema>;

interface ActivityDataRecord {
  id: string;
  reporting_period: string;
  data_type: string;
  value: number;
  unit: string;
  allocation_method: 'direct_apportionment' | 'economic_allocation' | 'spend_based';
  evidence_url?: string;
  justification_text?: string;
}

export default function FacilityDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { getFacilityById } = useFacilities();
  const facilityId = params.id as string;

  const [facility, setFacility] = useState<Facility | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activityData, setActivityData] = useState<ActivityDataRecord[]>([]);
  const [isLoadingActivity, setIsLoadingActivity] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const form = useForm<FacilityEditFormValues>({
    resolver: zodResolver(facilityEditSchema),
    mode: 'onChange',
    defaultValues: {
      name: '',
      facility_type: '',
      address: '',
      city: '',
      country: '',
    },
  });

  useEffect(() => {
    if (facilityId) {
      fetchFacilityDetails();
      fetchActivityData();
    }
  }, [facilityId]);

  const fetchFacilityDetails = async () => {
    setIsLoading(true);
    try {
      const data = await getFacilityById(facilityId);

      if (!data) {
        throw new Error('Facility not found');
      }

      setFacility(data);
      form.reset({
        name: data.name,
        facility_type: data.facility_type_name || '',
        address: data.address || '',
        city: data.city || '',
        country: data.country || '',
      });
    } catch (error) {
      console.error('Error fetching facility:', error);
      toast.error('Failed to load facility details');
      router.push('/company/facilities');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchActivityData = async () => {
    setIsLoadingActivity(true);
    try {
      const mockData: ActivityDataRecord[] = [
        {
          id: '1',
          reporting_period: '2025-10-01',
          data_type: 'Electricity',
          value: 1500,
          unit: 'kWh',
          allocation_method: 'direct_apportionment',
          evidence_url: 'https://example.com/evidence.pdf',
        },
        {
          id: '2',
          reporting_period: '2025-10-01',
          data_type: 'Waste to Landfill',
          value: 250,
          unit: 'kg',
          allocation_method: 'economic_allocation',
          justification_text: 'Represents our share of total production volume for the month (35% of facility output)',
          evidence_url: 'https://example.com/facility-report.pdf',
        },
        {
          id: '3',
          reporting_period: '2025-09-01',
          data_type: 'Natural Gas',
          value: 500,
          unit: 'm³',
          allocation_method: 'spend_based',
        },
        {
          id: '4',
          reporting_period: '2025-09-01',
          data_type: 'Water Consumption',
          value: 12500,
          unit: 'L',
          allocation_method: 'economic_allocation',
          justification_text: 'Based on our percentage of total revenue for this supplier (42% of annual spend)',
        },
      ];

      setActivityData(mockData);
    } catch (error) {
      console.error('Error fetching activity data:', error);
      toast.error('Failed to load activity data');
    } finally {
      setIsLoadingActivity(false);
    }
  };

  const onSubmit = async (data: FacilityEditFormValues) => {
    if (!facilityId) {
      toast.error('Missing required information');
      return;
    }

    setIsSaving(true);

    try {
      const { data: session } = await supabase.auth.getSession();

      if (!session.session) {
        toast.error('You must be logged in');
        return;
      }

      const apiUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/manage-facility`;

      const payload: any = {
        action: 'update',
        facility_id: facilityId,
        name: data.name.trim(),
        facility_type: data.facility_type,
        country: data.country,
      };

      if (data.address && data.address.trim()) {
        payload.address = data.address.trim();
      }

      if (data.city && data.city.trim()) {
        payload.city = data.city.trim();
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
        throw new Error(errorData.error || 'Failed to update facility');
      }

      toast.success('Facility updated successfully');
      fetchFacilityDetails();
    } catch (error: any) {
      console.error('Error updating facility:', error);
      toast.error(error.message || 'Failed to update facility');
    } finally {
      setIsSaving(false);
    }
  };

  const handleArchive = async () => {
    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from('facilities')
        .update({ is_archived: true, updated_at: new Date().toISOString() })
        .eq('id', facilityId);

      if (error) throw error;

      toast.success('Facility archived successfully');
      router.push('/company/facilities');
    } catch (error) {
      console.error('Error archiving facility:', error);
      toast.error('Failed to archive facility');
    } finally {
      setIsProcessing(false);
      setArchiveDialogOpen(false);
    }
  };

  const handleDelete = async () => {
    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from('facilities')
        .delete()
        .eq('id', facilityId);

      if (error) throw error;

      toast.success('Facility deleted successfully');
      router.push('/company/facilities');
    } catch (error) {
      console.error('Error deleting facility:', error);
      toast.error('Failed to delete facility');
    } finally {
      setIsProcessing(false);
      setDeleteDialogOpen(false);
    }
  };

  const getDqiBadge = (method: string) => {
    switch (method) {
      case 'direct_apportionment':
        return <Badge variant="default" className="bg-green-600">High</Badge>;
      case 'economic_allocation':
        return <Badge variant="secondary" className="bg-amber-500 text-white">Medium</Badge>;
      case 'spend_based':
        return <Badge variant="destructive">Low (Estimate)</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  if (isLoading) {
    return <PageLoader />;
  }

  if (!facility) {
    return null;
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/company/facilities')}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Facilities
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{facility.name}</h1>
          <div className="flex items-center gap-2 mt-2">
            {facility.data_source_type === 'internal' ? (
              <Badge variant="default" className="bg-blue-600">
                Owned
              </Badge>
            ) : (
              <Badge variant="secondary">
                Supplier
              </Badge>
            )}
            {facility.facility_type_name && (
              <Badge variant="outline">{facility.facility_type_name}</Badge>
            )}
          </div>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="activity-data">Activity Data Log</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Facility Details</CardTitle>
              <CardDescription>Update the facility information</CardDescription>
            </CardHeader>
            <CardContent>
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

                <Button
                  type="submit"
                  disabled={!form.formState.isValid || !form.formState.isDirty || isSaving}
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Changes
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          <div>
            <h3 className="text-lg font-semibold mb-4">Key Metrics (Last 90 Days)</h3>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <DqiAwareKpi
                title="Total Emissions"
                value="12.5"
                unit="tCO₂e"
                description="Scope 1 & 2 combined"
                dqiBreakdown={{
                  high_quality_percentage: 60,
                  medium_quality_percentage: 30,
                  low_quality_percentage: 10,
                }}
                trend={{ value: -5, label: 'from last period' }}
              />
              <DqiAwareKpi
                title="Energy Consumption"
                value="45,230"
                unit="kWh"
                dqiBreakdown={{
                  high_quality_percentage: 80,
                  medium_quality_percentage: 20,
                  low_quality_percentage: 0,
                }}
                trend={{ value: 3, label: 'from last period' }}
              />
              <DqiAwareKpi
                title="Waste Generated"
                value="1,250"
                unit="kg"
                dqiBreakdown={{
                  high_quality_percentage: 70,
                  medium_quality_percentage: 25,
                  low_quality_percentage: 5,
                }}
                trend={{ value: -12, label: 'from last period' }}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="activity-data" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Activity Data Audit Trail</CardTitle>
              <CardDescription>
                Complete record of all activity data submissions for this facility
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingActivity ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : activityData.length === 0 ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>No Activity Data</AlertTitle>
                  <AlertDescription>
                    No activity data has been submitted for this facility yet.
                  </AlertDescription>
                </Alert>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Reporting Period</TableHead>
                      <TableHead>Data Type</TableHead>
                      <TableHead>Value</TableHead>
                      <TableHead>DQI</TableHead>
                      <TableHead>Justification / Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activityData.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell>
                          {format(new Date(record.reporting_period), 'MMMM yyyy')}
                        </TableCell>
                        <TableCell className="font-medium">{record.data_type}</TableCell>
                        <TableCell>
                          {record.value.toLocaleString()} {record.unit}
                        </TableCell>
                        <TableCell>{getDqiBadge(record.allocation_method)}</TableCell>
                        <TableCell>
                          <div className="space-y-2">
                            {record.allocation_method === 'economic_allocation' && record.justification_text && (
                              <div className="text-sm">
                                <span className="font-medium text-muted-foreground">Allocation Basis: </span>
                                <span>{record.justification_text}</span>
                              </div>
                            )}
                            {record.evidence_url && (
                              <Button
                                variant="ghost"
                                size="sm"
                                asChild
                                className="h-auto p-0 text-blue-600 hover:text-blue-800"
                              >
                                <a
                                  href={record.evidence_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1"
                                >
                                  <FileText className="h-3 w-3" />
                                  View Evidence
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              </Button>
                            )}
                            {!record.justification_text && !record.evidence_url && (
                              <span className="text-sm text-muted-foreground">No additional details</span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Facility Settings</CardTitle>
              <CardDescription>Manage facility status and data</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Archive Facility</h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    Archiving will hide this facility from the active facilities list. You can restore it later.
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => setArchiveDialogOpen(true)}
                  >
                    <Archive className="mr-2 h-4 w-4" />
                    Archive Facility
                  </Button>
                </div>

                <Separator />

                <div>
                  <h4 className="font-semibold mb-2 text-red-600">Delete Facility</h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    Permanently delete this facility and all associated data. This action cannot be undone.
                  </p>
                  <Button
                    variant="destructive"
                    onClick={() => setDeleteDialogOpen(true)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Facility
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AlertDialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Facility</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to archive "{facility.name}"? This facility will be hidden from the active facilities list but can be restored later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleArchive}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Archiving...
                </>
              ) : (
                'Archive Facility'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Facility</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete "{facility.name}"? This action cannot be undone and all associated data will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isProcessing}
              className="bg-red-600 hover:bg-red-700"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete Facility'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
