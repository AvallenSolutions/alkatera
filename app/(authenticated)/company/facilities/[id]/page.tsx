"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Trash2, Building2, Zap, Pencil } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PageLoader } from "@/components/ui/page-loader";
import { toast } from "sonner";
import { LogEmissionsWithProduction } from "@/components/facilities/LogEmissionsWithProduction";
import { EditFacilityDialog } from "@/components/facilities/EditFacilityDialog";

interface Facility {
  id: string;
  name: string;
  functions: string[];
  operational_control: 'owned' | 'third_party';
  address_line1: string;
  address_city: string;
  address_country: string;
  address_postcode: string;
  organization_id: string;
}

interface DataContract {
  id: string;
  utility_type: string;
  frequency: string;
  data_quality: string;
}

interface UtilityDataEntry {
  id: string;
  utility_type: string;
  quantity: number;
  unit: string;
  reporting_period_start: string;
  reporting_period_end: string;
  data_quality: string;
  calculated_scope: string;
  notes: string | null;
  created_at: string;
}

const UTILITY_TYPES = [
  { value: 'electricity_grid', label: 'Purchased Electricity', defaultUnit: 'kWh' },
  { value: 'heat_steam_purchased', label: 'Purchased Heat / Steam', defaultUnit: 'kWh' },
  { value: 'natural_gas', label: 'Natural Gas', defaultUnit: 'm³' },
  { value: 'lpg', label: 'LPG (Propane/Butane)', defaultUnit: 'Litres' },
  { value: 'diesel_stationary', label: 'Diesel (Generators/Stationary)', defaultUnit: 'Litres' },
  { value: 'heavy_fuel_oil', label: 'Heavy Fuel Oil', defaultUnit: 'Litres' },
  { value: 'biomass_solid', label: 'Biogas / Biomass', defaultUnit: 'kg' },
  { value: 'refrigerant_leakage', label: 'Refrigerants (Leakage)', defaultUnit: 'kg' },
  { value: 'diesel_mobile', label: 'Company Fleet (Diesel)', defaultUnit: 'Litres' },
  { value: 'petrol_mobile', label: 'Company Fleet (Petrol/Gasoline)', defaultUnit: 'Litres' },
];

export default function FacilityDetailPage() {
  const params = useParams();
  const router = useRouter();
  const facilityId = params.id as string;

  const [facility, setFacility] = useState<Facility | null>(null);
  const [dataContracts, setDataContracts] = useState<DataContract[]>([]);
  const [utilityData, setUtilityData] = useState<UtilityDataEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("data-entry");
  const [editDialogOpen, setEditDialogOpen] = useState(false);


  useEffect(() => {
    if (facilityId) {
      loadFacilityData();
    }
  }, [facilityId]);

  const loadFacilityData = async () => {
    try {
      setLoading(true);

      const [facilityResult, contractsResult, dataResult] = await Promise.all([
        supabase
          .from('facilities')
          .select('*')
          .eq('id', facilityId)
          .single(),
        supabase
          .from('facility_data_contracts')
          .select('*')
          .eq('facility_id', facilityId),
        supabase
          .from('utility_data_entries')
          .select('*')
          .eq('facility_id', facilityId)
          .order('reporting_period_start', { ascending: false }),
      ]);

      if (facilityResult.error) throw facilityResult.error;
      if (contractsResult.error) throw contractsResult.error;
      if (dataResult.error) throw dataResult.error;

      setFacility(facilityResult.data);
      setDataContracts(contractsResult.data || []);
      setUtilityData(dataResult.data || []);
    } catch (error: any) {
      console.error('Error loading facility data:', error);
      toast.error(error.message || 'Failed to load facility data');
    } finally {
      setLoading(false);
    }
  };


  const handleDeleteEntry = async (entryId: string) => {
    if (!confirm('Are you sure you want to delete this entry?')) return;

    try {
      const { error } = await supabase
        .from('utility_data_entries')
        .delete()
        .eq('id', entryId);

      if (error) throw error;

      toast.success('Entry deleted');
      await loadFacilityData();
    } catch (error: any) {
      console.error('Error deleting entry:', error);
      toast.error(error.message || 'Failed to delete entry');
    }
  };

  const getUtilityLabel = (value: string) => {
    return UTILITY_TYPES.find(u => u.value === value)?.label || value;
  };

  const handleDeleteFacility = async () => {
    if (!facility) return;

    if (!confirm(`Are you sure you want to delete "${facility.name}"? This action cannot be undone and will remove all associated data.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('facilities')
        .delete()
        .eq('id', facilityId);

      if (error) throw error;

      toast.success('Facility deleted successfully');
      router.push('/company/facilities');
    } catch (error: any) {
      console.error('Error deleting facility:', error);
      toast.error(error.message || 'Failed to delete facility');
    }
  };

  if (loading) {
    return <PageLoader message="Loading facility..." />;
  }

  if (!facility) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <AlertDescription>Facility not found</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-6">
        <Button variant="outline" onClick={() => router.push('/company/facilities')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Facilities
        </Button>
      </div>

      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Building2 className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">{facility.name}</h1>
            <p className="text-muted-foreground">
              {facility.address_city}, {facility.address_country}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mt-4">
          {facility.functions.map((func: string) => (
            <Badge key={func} variant="secondary">{func}</Badge>
          ))}
          <Badge className={facility.operational_control === 'owned' ? 'bg-green-600' : 'bg-blue-600'}>
            {facility.operational_control === 'owned' ? 'Owned' : 'Third-Party'}
          </Badge>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="data-entry">
            <Zap className="h-4 w-4 mr-2" />
            Utility Data Entry
          </TabsTrigger>
          <TabsTrigger value="overview">
            <Building2 className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
        </TabsList>

        <TabsContent value="data-entry" className="space-y-6 mt-6">
          <LogEmissionsWithProduction
            facilityId={facilityId}
            onSuccess={loadFacilityData}
          />

          <Card>
            <CardHeader>
              <CardTitle>Utility Data History</CardTitle>
              <CardDescription>
                All consumption data for this facility
              </CardDescription>
            </CardHeader>
            <CardContent>
              {utilityData.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No utility data recorded yet</p>
                  <p className="text-sm mt-1">Add your first entry above</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Utility Type</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Scope</TableHead>
                      <TableHead>Quality</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {utilityData.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="font-medium">
                          {getUtilityLabel(entry.utility_type)}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {new Date(entry.reporting_period_start).toLocaleDateString()} -
                            <br />
                            {new Date(entry.reporting_period_end).toLocaleDateString()}
                          </div>
                        </TableCell>
                        <TableCell>
                          {entry.quantity.toLocaleString()} {entry.unit}
                        </TableCell>
                        <TableCell>
                          <Badge variant={entry.calculated_scope === 'Scope 1' ? 'default' : 'secondary'}>
                            {entry.calculated_scope}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {entry.data_quality}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteEntry(entry.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="overview" className="mt-6">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Facility Information</CardTitle>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditDialogOpen(true)}
                    >
                      <Pencil className="h-4 w-4 mr-2" />
                      Edit Facility
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleDeleteFacility}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Facility
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Operational Control</p>
                  <div className="mt-1">
                    <Badge className={facility.operational_control === 'owned' ? 'bg-green-600' : 'bg-blue-600'}>
                      {facility.operational_control === 'owned' ? 'Owned' : 'Third-Party'}
                    </Badge>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium text-muted-foreground">Address</p>
                  <p className="mt-1">
                    {facility.address_line1}
                    <br />
                    {facility.address_city}, {facility.address_postcode}
                    <br />
                    {facility.address_country}
                  </p>
                </div>

                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Data Contracts</p>
                  {dataContracts.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No data contracts defined</p>
                  ) : (
                    <div className="space-y-2">
                      {dataContracts.map((contract) => (
                        <div key={contract.id} className="flex items-center justify-between p-2 border rounded">
                          <span className="text-sm">{getUtilityLabel(contract.utility_type)}</span>
                          <div className="flex gap-2">
                            <Badge variant="outline">{contract.frequency}</Badge>
                            <Badge variant="outline">{contract.data_quality}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <EditFacilityDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        facilityId={facilityId}
        onSuccess={loadFacilityData}
      />
    </div>
  );
}
