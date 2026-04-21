"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Trash2, Building2, Zap, Pencil, History, Package, Loader2, FlaskConical, Droplets, ArrowRightLeft } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageLoader } from "@/components/ui/page-loader";
import { toast } from "sonner";
import { EditFacilityDialog } from "@/components/facilities/EditFacilityDialog";
import { BrewwLinkBadge as FacilityBrewwLinkBadge } from "@/components/facilities/BrewwLinkBadge";
import { DirectDataEntry } from "@/components/facilities/DirectDataEntry";
import { ProductionVolumeManager } from "@/components/facilities/ProductionVolumeManager";
import { DataQualityConfidenceCard } from "@/components/facilities/DataQualityConfidenceCard";
import { ProductionRunDataEntry } from "@/components/facilities/ProductionRunDataEntry";
import { UTILITY_TYPES } from "@/lib/constants/utility-types";

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
  reporting_session_id: string | null;
  activity_date?: string | null;
}

interface FacilityActivityEntry {
  id: string;
  activity_category: string;
  quantity: number;
  unit: string;
  reporting_period_start: string;
  reporting_period_end: string;
  data_provenance: string;
  notes: string | null;
  created_at: string;
  water_source_type?: string;
  water_classification?: string;
  waste_category?: string;
  waste_treatment_method?: string;
  reporting_session_id?: string | null;
  activity_date?: string | null;
}

export default function FacilityDetailPage() {
  const params = useParams();
  const router = useRouter();
  const facilityId = params.id as string;

  const [facility, setFacility] = useState<Facility | null>(null);
  const [dataContracts, setDataContracts] = useState<DataContract[]>([]);
  const [utilityData, setUtilityData] = useState<UtilityDataEntry[]>([]);
  const [waterData, setWaterData] = useState<FacilityActivityEntry[]>([]);
  const [wasteData, setWasteData] = useState<FacilityActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("data-entry");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<{
    id: string;
    table: 'utility_data_entries' | 'facility_activity_entries';
    activity_date: string;
    quantity: string;
    notes: string;
  } | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  const loadFacilityData = useCallback(async () => {
    try {
      setLoading(true);

      const [facilityResult, contractsResult, utilityResult, waterResult, wasteResult] = await Promise.all([
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
        supabase
          .from('facility_activity_entries')
          .select('*')
          .eq('facility_id', facilityId)
          .in('activity_category', ['water_intake', 'water_discharge', 'water_recycled'])
          .order('reporting_period_start', { ascending: false }),
        supabase
          .from('facility_activity_entries')
          .select('*')
          .eq('facility_id', facilityId)
          .in('activity_category', ['waste_general', 'waste_hazardous', 'waste_recycling'])
          .order('reporting_period_start', { ascending: false }),
      ]);

      if (facilityResult.error) throw facilityResult.error;
      if (contractsResult.error) throw contractsResult.error;
      if (utilityResult.error) throw utilityResult.error;
      if (waterResult.error) throw waterResult.error;
      if (wasteResult.error) throw wasteResult.error;

      setFacility(facilityResult.data);
      setDataContracts(contractsResult.data || []);
      setUtilityData(utilityResult.data || []);
      setWaterData(waterResult.data || []);
      setWasteData(wasteResult.data || []);
    } catch (error: any) {
      console.error('Error loading facility data:', error);
      toast.error(error.message || 'Failed to load facility data');
    } finally {
      setLoading(false);
    }
  }, [facilityId]);

  useEffect(() => {
    if (facilityId) {
      loadFacilityData();
    }
  }, [facilityId, loadFacilityData]);

  const handleDeleteEntry = async (entryId: string, table: 'utility_data_entries' | 'facility_activity_entries') => {
    if (!confirm('Are you sure you want to delete this entry?')) return;

    try {
      const { error } = await supabase
        .from(table)
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

  const openEditDialog = (
    entry: UtilityDataEntry | FacilityActivityEntry,
    table: 'utility_data_entries' | 'facility_activity_entries'
  ) => {
    setEditingEntry({
      id: entry.id,
      table,
      activity_date: entry.activity_date || '',
      quantity: String(entry.quantity),
      notes: entry.notes || '',
    });
  };

  const handleSaveEdit = async () => {
    if (!editingEntry) return;
    setEditSaving(true);

    try {
      const updates: Record<string, any> = {
        quantity: parseFloat(editingEntry.quantity),
        notes: editingEntry.notes || null,
        activity_date: editingEntry.activity_date || null,
      };

      const { error } = await supabase
        .from(editingEntry.table)
        .update(updates)
        .eq('id', editingEntry.id);

      if (error) throw error;

      toast.success('Entry updated');
      setEditingEntry(null);
      await loadFacilityData();
    } catch (error: any) {
      console.error('Error updating entry:', error);
      toast.error(error.message || 'Failed to update entry');
    } finally {
      setEditSaving(false);
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

        <div className="flex flex-wrap gap-2 mt-4 items-center">
          {facility.functions.map((func: string) => (
            <Badge key={func} variant="secondary">{func}</Badge>
          ))}
          <Badge className={facility.operational_control === 'owned' ? 'bg-green-600' : 'bg-blue-600'}>
            {facility.operational_control === 'owned' ? 'Owned' : 'Third-Party'}
          </Badge>
          <FacilityBrewwLinkBadge facilityId={facility.id} />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="data-entry">
            <Zap className="h-4 w-4 mr-2" />
            Data Entry
          </TabsTrigger>
          <TabsTrigger value="production">
            <Package className="h-4 w-4 mr-2" />
            Production
          </TabsTrigger>
          <TabsTrigger value="run-data">
            <FlaskConical className="h-4 w-4 mr-2" />
            Run Data
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="h-4 w-4 mr-2" />
            History
          </TabsTrigger>
          <TabsTrigger value="overview">
            <Building2 className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
        </TabsList>

        {/* ============================================================= */}
        {/* DATA ENTRY TAB */}
        {/* ============================================================= */}
        <TabsContent value="data-entry" className="space-y-6 mt-6">
          <DirectDataEntry
            facilityId={facilityId}
            organizationId={facility.organization_id}
            onDataSaved={loadFacilityData}
          />
        </TabsContent>

        {/* ============================================================= */}
        {/* PRODUCTION TAB */}
        {/* ============================================================= */}
        <TabsContent value="production" className="space-y-6 mt-6">
          <ProductionVolumeManager
            facilityId={facilityId}
            organizationId={facility.organization_id}
          />
        </TabsContent>

        {/* ============================================================= */}
        {/* RUN DATA TAB */}
        {/* ============================================================= */}
        <TabsContent value="run-data" className="space-y-6 mt-6">
          <ProductionRunDataEntry
            facilityId={facilityId}
            organizationId={facility.organization_id}
            onDataSaved={loadFacilityData}
          />
        </TabsContent>

        {/* ============================================================= */}
        {/* HISTORY TAB */}
        {/* ============================================================= */}
        <TabsContent value="history" className="space-y-6 mt-6">
          {/* Utility History */}
          <Card>
            <CardHeader>
              <CardTitle>Utility Data</CardTitle>
              <CardDescription>
                All energy and fuel consumption data for this facility
              </CardDescription>
            </CardHeader>
            <CardContent>
              {utilityData.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No utility data recorded yet</p>
                  <p className="text-sm mt-1">Add entries in the Data Entry tab</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Utility Type</TableHead>
                      <TableHead>Date</TableHead>
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
                            {entry.activity_date ? (
                              <>{new Date(entry.activity_date).toLocaleDateString()}</>
                            ) : (
                              <>
                                {new Date(entry.reporting_period_start).toLocaleDateString()} -
                                <br />
                                {new Date(entry.reporting_period_end).toLocaleDateString()}
                              </>
                            )}
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
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditDialog(entry, 'utility_data_entries')}
                            >
                              <Pencil className="h-4 w-4 text-muted-foreground" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteEntry(entry.id, 'utility_data_entries')}
                            >
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Water History */}
          <Card>
            <CardHeader>
              <CardTitle>Water Data</CardTitle>
              <CardDescription>
                All water intake, discharge, and recycling data
              </CardDescription>
            </CardHeader>
            <CardContent>
              {waterData.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No water data recorded yet</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Activity Type</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Data Quality</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {waterData.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="font-medium">
                          {entry.activity_category === 'water_intake' && 'Water Intake'}
                          {entry.activity_category === 'water_discharge' && 'Wastewater Discharge'}
                          {entry.activity_category === 'water_recycled' && 'Recycled Water'}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {entry.activity_date ? (
                              <>{new Date(entry.activity_date).toLocaleDateString()}</>
                            ) : (
                              <>
                                {new Date(entry.reporting_period_start).toLocaleDateString()} -
                                <br />
                                {new Date(entry.reporting_period_end).toLocaleDateString()}
                              </>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {entry.quantity.toLocaleString()} {entry.unit}
                        </TableCell>
                        <TableCell>
                          {entry.water_source_type ? (
                            <Badge variant="outline" className="text-xs">
                              {entry.water_source_type.replace('_', ' ')}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`text-xs ${
                              entry.data_provenance?.includes('primary')
                                ? 'bg-green-50 text-green-700 border-green-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}
                          >
                            {entry.data_provenance?.includes('verified') && 'Verified'}
                            {entry.data_provenance?.includes('measured') && 'Measured'}
                            {entry.data_provenance?.includes('allocated') && 'Allocated'}
                            {entry.data_provenance?.includes('modelled') && 'Modelled'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditDialog(entry, 'facility_activity_entries')}
                            >
                              <Pencil className="h-4 w-4 text-muted-foreground" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteEntry(entry.id, 'facility_activity_entries')}
                            >
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Waste History */}
          <Card>
            <CardHeader>
              <CardTitle>Waste Data</CardTitle>
              <CardDescription>
                All waste generation, recycling, and disposal data
              </CardDescription>
            </CardHeader>
            <CardContent>
              {wasteData.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No waste data recorded yet</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Waste Category</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Treatment Method</TableHead>
                      <TableHead>Data Quality</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {wasteData.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="font-medium">
                          {entry.activity_category === 'waste_general' && 'General Waste'}
                          {entry.activity_category === 'waste_hazardous' && 'Hazardous Waste'}
                          {entry.activity_category === 'waste_recycling' && 'Recycling'}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {entry.activity_date ? (
                              <>{new Date(entry.activity_date).toLocaleDateString()}</>
                            ) : (
                              <>
                                {new Date(entry.reporting_period_start).toLocaleDateString()} -
                                <br />
                                {new Date(entry.reporting_period_end).toLocaleDateString()}
                              </>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {entry.quantity.toLocaleString()} {entry.unit}
                        </TableCell>
                        <TableCell>
                          {entry.waste_treatment_method ? (
                            <Badge variant="outline" className="text-xs">
                              {entry.waste_treatment_method.replace('_', ' ')}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`text-xs ${
                              entry.data_provenance?.includes('primary')
                                ? 'bg-green-50 text-green-700 border-green-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}
                          >
                            {entry.data_provenance?.includes('verified') && 'Verified'}
                            {entry.data_provenance?.includes('measured') && 'Measured'}
                            {entry.data_provenance?.includes('allocated') && 'Allocated'}
                            {entry.data_provenance?.includes('modelled') && 'Modelled'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditDialog(entry, 'facility_activity_entries')}
                            >
                              <Pencil className="h-4 w-4 text-muted-foreground" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteEntry(entry.id, 'facility_activity_entries')}
                            >
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Production Run Resource Data History */}
          <ProductionRunDataEntry
            facilityId={facilityId}
            organizationId={facility.organization_id}
            onDataSaved={loadFacilityData}
          />

          {/* Edit Entry Dialog */}
          <Dialog open={!!editingEntry} onOpenChange={(open) => !open && setEditingEntry(null)}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Edit Entry</DialogTitle>
              </DialogHeader>
              {editingEntry && (
                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label htmlFor="edit-date">Activity Date</Label>
                    <Input
                      id="edit-date"
                      type="date"
                      value={editingEntry.activity_date}
                      onChange={(e) =>
                        setEditingEntry({ ...editingEntry, activity_date: e.target.value })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      The specific date of this reading (e.g. invoice date, meter reading date)
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-quantity">Quantity</Label>
                    <Input
                      id="edit-quantity"
                      type="number"
                      step="any"
                      value={editingEntry.quantity}
                      onChange={(e) =>
                        setEditingEntry({ ...editingEntry, quantity: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-notes">Notes</Label>
                    <Input
                      id="edit-notes"
                      value={editingEntry.notes}
                      placeholder="Optional notes"
                      onChange={(e) =>
                        setEditingEntry({ ...editingEntry, notes: e.target.value })
                      }
                    />
                  </div>
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditingEntry(null)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveEdit} disabled={editSaving}>
                  {editSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Save Changes
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ============================================================= */}
        {/* OVERVIEW TAB */}
        {/* ============================================================= */}
        <TabsContent value="overview" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
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
            <div className="lg:col-span-1">
              <DataQualityConfidenceCard
                facilityId={facilityId}
                organizationId={facility.organization_id}
              />
            </div>
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
