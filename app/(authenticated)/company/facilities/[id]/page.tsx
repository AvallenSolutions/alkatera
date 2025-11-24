"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, ArrowLeft, Save, Trash2, Building2, Zap } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PageLoader } from "@/components/ui/page-loader";
import { toast } from "sonner";
import { useOrganization } from "@/lib/organizationContext";

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
  const { currentOrganization } = useOrganization();

  const [facility, setFacility] = useState<Facility | null>(null);
  const [dataContracts, setDataContracts] = useState<DataContract[]>([]);
  const [utilityData, setUtilityData] = useState<UtilityDataEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("data-entry");

  const [newEntry, setNewEntry] = useState({
    utility_type: '',
    quantity: '',
    unit: '',
    reporting_period_start: '',
    reporting_period_end: '',
    data_quality: 'actual',
    notes: '',
  });
  const [isAddingEntry, setIsAddingEntry] = useState(false);

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

  const handleAddEntry = async () => {
    if (!newEntry.utility_type || !newEntry.quantity || !newEntry.unit || !newEntry.reporting_period_start || !newEntry.reporting_period_end) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      setIsAddingEntry(true);

      const { error } = await supabase
        .from('utility_data_entries')
        .insert({
          facility_id: facilityId,
          utility_type: newEntry.utility_type,
          quantity: parseFloat(newEntry.quantity),
          unit: newEntry.unit,
          reporting_period_start: newEntry.reporting_period_start,
          reporting_period_end: newEntry.reporting_period_end,
          data_quality: newEntry.data_quality,
          notes: newEntry.notes || null,
        });

      if (error) throw error;

      toast.success('Utility data added successfully');
      setNewEntry({
        utility_type: '',
        quantity: '',
        unit: '',
        reporting_period_start: '',
        reporting_period_end: '',
        data_quality: 'actual',
        notes: '',
      });
      await loadFacilityData();
    } catch (error: any) {
      console.error('Error adding utility data:', error);
      toast.error(error.message || 'Failed to add utility data');
    } finally {
      setIsAddingEntry(false);
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
          <Card>
            <CardHeader>
              <CardTitle>Add Utility Data</CardTitle>
              <CardDescription>
                Enter consumption data for this facility
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="utility_type">Utility Type *</Label>
                  <Select
                    value={newEntry.utility_type}
                    onValueChange={(value) => {
                      const utility = UTILITY_TYPES.find(u => u.value === value);
                      setNewEntry({
                        ...newEntry,
                        utility_type: value,
                        unit: utility?.defaultUnit || '',
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select utility type..." />
                    </SelectTrigger>
                    <SelectContent>
                      {UTILITY_TYPES.map((utility) => (
                        <SelectItem key={utility.value} value={utility.value}>
                          {utility.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="quantity">Quantity *</Label>
                  <Input
                    id="quantity"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={newEntry.quantity}
                    onChange={(e) => setNewEntry({ ...newEntry, quantity: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="unit">Unit *</Label>
                  <Input
                    id="unit"
                    placeholder="kWh, Litres, m³, etc."
                    value={newEntry.unit}
                    onChange={(e) => setNewEntry({ ...newEntry, unit: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="data_quality">Data Quality</Label>
                  <Select
                    value={newEntry.data_quality}
                    onValueChange={(value) => setNewEntry({ ...newEntry, data_quality: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="actual">Actual</SelectItem>
                      <SelectItem value="estimated">Estimated</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="period_start">Period Start *</Label>
                  <Input
                    id="period_start"
                    type="date"
                    value={newEntry.reporting_period_start}
                    onChange={(e) => setNewEntry({ ...newEntry, reporting_period_start: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="period_end">Period End *</Label>
                  <Input
                    id="period_end"
                    type="date"
                    value={newEntry.reporting_period_end}
                    onChange={(e) => setNewEntry({ ...newEntry, reporting_period_end: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Input
                  id="notes"
                  placeholder="Any additional information..."
                  value={newEntry.notes}
                  onChange={(e) => setNewEntry({ ...newEntry, notes: e.target.value })}
                />
              </div>

              <Button onClick={handleAddEntry} disabled={isAddingEntry}>
                <Plus className="mr-2 h-4 w-4" />
                {isAddingEntry ? 'Adding...' : 'Add Entry'}
              </Button>
            </CardContent>
          </Card>

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
          <Card>
            <CardHeader>
              <CardTitle>Facility Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Address</p>
                <p>
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
