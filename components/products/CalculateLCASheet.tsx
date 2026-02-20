"use client";

import { useState, useEffect, Fragment } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Shield,
  Info,
  TrendingUp,
  Database,
  Factory,
  Building2,
  Users,
  Calendar,
  Search,
} from "lucide-react";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import { validateMaterialsBeforeCalculation, type ProductMaterial } from "@/lib/impact-waterfall-resolver";
import { calculateProductLCA } from "@/lib/product-lca-calculator";
import { OperationOverlay, type OperationStep } from "@/components/ui/operation-progress";
import { toast } from "sonner";
import { InlineIngredientSearch } from "@/components/lca/InlineIngredientSearch";
import type { DataSource } from "@/lib/types/lca";

interface MaterialWithValidation extends ProductMaterial {
  hasData: boolean;
  dataQuality?: string;
  confidenceScore?: number;
  error?: string;
}

interface LinkedFacility {
  id: string;
  facility_id: string;
  facility: {
    id: string;
    name: string;
    operational_control: "owned" | "third_party";
    address_city: string | null;
    address_country: string | null;
  };
}

interface FacilityAllocation {
  facilityId: string;
  facilityName: string;
  operationalControl: "owned" | "third_party";
  reportingPeriodStart: string;
  reportingPeriodEnd: string;
  productionVolume: string;
  productionVolumeUnit: string;
  facilityTotalProduction: string;
  selectedSessionId?: string;
}

interface ReportingSession {
  id: string;
  facility_id: string;
  reporting_period_start: string;
  reporting_period_end: string;
  total_production_volume: number;
  volume_unit: string;
  data_source_type: string;
}

const PRODUCTION_UNITS = [
  { value: "units", label: "Units" },
  { value: "litres", label: "Litres" },
  { value: "kg", label: "Kilograms" },
  { value: "tonnes", label: "Tonnes" },
  { value: "cases", label: "Cases" },
  { value: "pallets", label: "Pallets" },
];

interface CalculateLCASheetProps {
  productId: string;
  productName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCalculationComplete: (pcfId: string) => void;
}

export function CalculateLCASheet({
  productId,
  productName,
  open,
  onOpenChange,
  onCalculationComplete,
}: CalculateLCASheetProps) {
  const [loading, setLoading] = useState(true);
  const [loadingStep, setLoadingStep] = useState('');
  const [calculating, setCalculating] = useState(false);
  const [calcSteps, setCalcSteps] = useState<OperationStep[]>([]);
  const [calcProgress, setCalcProgress] = useState(0);
  const [product, setProduct] = useState<any>(null);
  const [materials, setMaterials] = useState<MaterialWithValidation[]>([]);
  const [canCalculate, setCanCalculate] = useState(false);
  const [missingCount, setMissingCount] = useState(0);
  const [linkedFacilities, setLinkedFacilities] = useState<LinkedFacility[]>([]);
  const [facilityAllocations, setFacilityAllocations] = useState<FacilityAllocation[]>([]);
  const [reportingSessions, setReportingSessions] = useState<Record<string, ReportingSession[]>>({});
  const [editingMaterialId, setEditingMaterialId] = useState<string | null>(null);
  const [savingMaterialId, setSavingMaterialId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      loadAndValidate();
    }
  }, [open, productId]);

  async function loadAndValidate() {
    const supabase = getSupabaseBrowserClient();

    try {
      setLoading(true);
      setLoadingStep('Fetching product data...');

      const { data: productData, error: productError } = await supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .maybeSingle();

      if (productError || !productData) {
        toast.error('Product not found');
        onOpenChange(false);
        return;
      }
      setProduct(productData);

      setLoadingStep('Loading materials...');
      const { data: materialsData, error: materialsError } = await supabase
        .from('product_materials')
        .select('*')
        .eq('product_id', productId);

      if (materialsError) throw materialsError;

      if (!materialsData || materialsData.length === 0) {
        toast.error('No materials found. Please add ingredients and packaging first.');
        onOpenChange(false);
        return;
      }

      setLoadingStep('Validating emission factors...');
      const validation = await validateMaterialsBeforeCalculation(
        materialsData as ProductMaterial[],
        productData.organization_id,
        (index, total, name) => {
          setLoadingStep(`Validating material ${index} of ${total}: ${name}...`);
        }
      );

      const materialsWithStatus: MaterialWithValidation[] = materialsData.map((mat) => {
        const validMaterial = validation.validMaterials.find((v) => v.material.id === mat.id);
        const missingMaterial = validation.missingData.find((m) => m.material.id === mat.id);

        if (validMaterial) {
          return { ...mat, hasData: true, dataQuality: validMaterial.resolved.data_quality_tag, confidenceScore: validMaterial.resolved.confidence_score };
        } else if (missingMaterial) {
          return { ...mat, hasData: false, error: missingMaterial.error };
        }
        return { ...mat, hasData: false, error: 'Unknown validation error' };
      });

      setMaterials(materialsWithStatus);
      setCanCalculate(validation.valid);
      setMissingCount(validation.missingData.length);

      setLoadingStep('Loading facility data...');
      const { data: facilitiesData } = await supabase
        .from('facility_product_assignments')
        .select(`id, facility_id, facilities (id, name, operational_control, address_city, address_country)`)
        .eq('product_id', productId)
        .eq('assignment_status', 'active');

      if (facilitiesData) {
        const facilities = facilitiesData.map((f: any) => ({
          id: f.id, facility_id: f.facility_id, facility: f.facilities,
        })) as LinkedFacility[];

        setLinkedFacilities(facilities);

        const facilityIds = facilities.map(f => f.facility_id);
        const { data: sessions } = await supabase
          .from('facility_reporting_sessions')
          .select('id, facility_id, reporting_period_start, reporting_period_end, total_production_volume, volume_unit, data_source_type')
          .in('facility_id', facilityIds)
          .order('reporting_period_end', { ascending: false });

        const sessionsByFacility: Record<string, ReportingSession[]> = {};
        for (const session of (sessions || [])) {
          if (!sessionsByFacility[session.facility_id]) sessionsByFacility[session.facility_id] = [];
          sessionsByFacility[session.facility_id].push(session);
        }
        setReportingSessions(sessionsByFacility);

        const defaultEndDate = new Date().toISOString().split('T')[0];
        const defaultStartDate = new Date(new Date().setFullYear(new Date().getFullYear() - 1)).toISOString().split('T')[0];

        setFacilityAllocations(facilities.map(f => {
          const facilitySessions = sessionsByFacility[f.facility_id] || [];
          const latestSession = facilitySessions[0];
          if (latestSession) {
            return {
              facilityId: f.facility_id, facilityName: f.facility.name, operationalControl: f.facility.operational_control,
              reportingPeriodStart: latestSession.reporting_period_start, reportingPeriodEnd: latestSession.reporting_period_end,
              productionVolume: '', productionVolumeUnit: latestSession.volume_unit || 'units',
              facilityTotalProduction: String(latestSession.total_production_volume), selectedSessionId: latestSession.id,
            };
          }
          return {
            facilityId: f.facility_id, facilityName: f.facility.name, operationalControl: f.facility.operational_control,
            reportingPeriodStart: defaultStartDate, reportingPeriodEnd: defaultEndDate,
            productionVolume: '', productionVolumeUnit: 'units', facilityTotalProduction: '',
          };
        }));
      }
    } catch (error: any) {
      console.error('Error loading materials:', error);
      toast.error(error.message || 'Failed to load materials');
    } finally {
      setLoading(false);
    }
  }

  async function handleEmissionFactorSelect(
    materialId: string,
    selection: {
      name: string;
      data_source: DataSource;
      data_source_id?: string;
      supplier_product_id?: string;
      unit: string;
      carbon_intensity?: number;
    }
  ) {
    const supabase = getSupabaseBrowserClient();
    setSavingMaterialId(materialId);

    try {
      // 1. Update DB row
      const material = materials.find(m => m.id === materialId);
      const updateData: Record<string, any> = {
        data_source: selection.data_source,
        data_source_id: selection.data_source_id || null,
        supplier_product_id: null,
        // Set matched_source_name if the selected factor name differs from the material name
        matched_source_name: material && selection.name !== material.material_name ? selection.name : null,
      };
      if (selection.data_source === 'supplier' && selection.supplier_product_id) {
        updateData.supplier_product_id = selection.supplier_product_id;
      }

      const { error: updateError } = await supabase
        .from('product_materials')
        .update(updateData)
        .eq('id', materialId);

      if (updateError) throw updateError;

      // 2. Re-fetch the updated row
      const { data: updatedRow, error: fetchError } = await supabase
        .from('product_materials')
        .select('*')
        .eq('id', materialId)
        .single();

      if (fetchError || !updatedRow) throw fetchError || new Error('Material not found');

      // 3. Re-validate this single material
      const validation = await validateMaterialsBeforeCalculation(
        [updatedRow as ProductMaterial],
        product.organization_id
      );

      // 4. Update local state
      setMaterials(prev => {
        const updated = prev.map(m => {
          if (m.id !== materialId) return m;
          const valid = validation.validMaterials[0];
          if (valid) {
            return {
              ...updatedRow,
              hasData: true,
              dataQuality: valid.resolved.data_quality_tag,
              confidenceScore: valid.resolved.confidence_score,
              error: undefined,
            } as MaterialWithValidation;
          }
          const missing = validation.missingData[0];
          return {
            ...updatedRow,
            hasData: false,
            error: missing?.error || 'Validation failed',
          } as MaterialWithValidation;
        });

        // 5. Recalculate canCalculate and missingCount
        const newMissing = updated.filter(m => !m.hasData).length;
        setMissingCount(newMissing);
        setCanCalculate(newMissing === 0);

        return updated;
      });

      setEditingMaterialId(null);
      toast.success(`Emission factor assigned for ${updatedRow.material_name}`);
    } catch (error: any) {
      console.error('Error updating emission factor:', error);
      toast.error(error.message || 'Failed to update emission factor');
    } finally {
      setSavingMaterialId(null);
    }
  }

  const handleCalculate = async () => {
    if (!canCalculate) {
      toast.error('Cannot calculate: some materials are missing emission data');
      return;
    }

    if (linkedFacilities.length > 0) {
      const missingVolumes = facilityAllocations.filter(a => !a.productionVolume || !a.facilityTotalProduction);
      if (missingVolumes.length > 0) {
        toast.error(`Please enter production volumes for all linked facilities`);
        return;
      }
    }

    setCalculating(true);
    setCalcSteps([
      { label: 'Loading product data', status: 'active' },
      { label: `Resolving impact factors for ${materials.length} materials`, status: 'pending' },
      { label: 'Processing facility allocations', status: 'pending' },
      { label: 'Aggregating lifecycle impacts', status: 'pending' },
      { label: 'Generating interpretation report', status: 'pending' },
    ]);
    setCalcProgress(0);

    try {
      const validAllocations = facilityAllocations
        .filter(a => a.productionVolume && a.facilityTotalProduction)
        .map(a => ({
          facilityId: a.facilityId, facilityName: a.facilityName, operationalControl: a.operationalControl,
          reportingPeriodStart: a.reportingPeriodStart, reportingPeriodEnd: a.reportingPeriodEnd,
          productionVolume: parseFloat(a.productionVolume), productionVolumeUnit: a.productionVolumeUnit,
          facilityTotalProduction: parseFloat(a.facilityTotalProduction),
        }));

      const result = await calculateProductLCA({
        productId,
        functionalUnit: `1 ${product?.unit || 'unit'} of ${productName}`,
        systemBoundary: 'cradle-to-gate',
        referenceYear: new Date().getFullYear(),
        facilityAllocations: validAllocations.length > 0 ? validAllocations : undefined,
        onProgress: (step, percent) => {
          setCalcProgress(percent);
          setCalcSteps(prev => prev.map((s, i) => {
            if (percent >= 90) return { ...s, status: i <= 4 ? (i < 4 ? 'completed' : 'active') : 'pending' };
            if (percent >= 75) return { ...s, status: i <= 3 ? (i < 3 ? 'completed' : 'active') : 'pending' };
            if (percent >= 50) return { ...s, status: i <= 2 ? (i < 2 ? 'completed' : 'active') : 'pending' };
            if (percent >= 20) return { ...s, status: i <= 1 ? (i < 1 ? 'completed' : 'active') : 'pending' };
            return { ...s, status: i === 0 ? 'active' : 'pending' };
          }));
        },
      });

      if (!result.success) throw new Error(result.error || 'Calculation failed');

      setCalcSteps(prev => prev.map(s => ({ ...s, status: 'completed' as const })));
      setCalcProgress(100);

      toast.success('Carbon footprint calculated!');
      await new Promise(resolve => setTimeout(resolve, 500));
      onCalculationComplete(result.pcfId!);
    } catch (error: any) {
      console.error('Calculation error:', error);
      toast.error(error.message || 'Failed to calculate impact');
    } finally {
      setCalculating(false);
    }
  };

  const getQualityBadgeProps = (tag: string) => {
    switch (tag) {
      case 'Primary_Verified': return { variant: 'default' as const, className: 'bg-green-600 hover:bg-green-700', icon: Shield };
      case 'Regional_Standard': return { variant: 'default' as const, className: 'bg-blue-600 hover:bg-blue-700', icon: TrendingUp };
      case 'Secondary_Modelled': return { variant: 'secondary' as const, className: '', icon: Database };
      default: return { variant: 'secondary' as const, className: '', icon: Info };
    }
  };

  const getConfidenceColor = (score: number) => {
    if (score >= 85) return 'text-green-600 dark:text-green-400';
    if (score >= 70) return 'text-blue-600 dark:text-blue-400';
    return 'text-slate-600 dark:text-slate-400';
  };

  const updateAllocation = (facilityId: string, field: keyof FacilityAllocation, value: string) => {
    setFacilityAllocations(prev => prev.map(a =>
      a.facilityId === facilityId ? { ...a, [field]: value } : a
    ));
  };

  const hasFacilitiesWithAllocations = linkedFacilities.length > 0 &&
    facilityAllocations.every(a => a.productionVolume && a.facilityTotalProduction);
  const hasFacilitiesMissingVolumes = linkedFacilities.length > 0 &&
    facilityAllocations.some(a => !a.productionVolume || !a.facilityTotalProduction);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-4xl overflow-y-auto" preventClose>
        <SheetHeader className="mb-4">
          <SheetTitle>Create LCA</SheetTitle>
          <SheetDescription>
            ISO 14067 compliant lifecycle assessment for {productName}
          </SheetDescription>
        </SheetHeader>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-lime-500" />
            <p className="text-sm text-muted-foreground">{loadingStep || 'Loading...'}</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Status */}
            {!canCalculate && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Missing Emission Data</AlertTitle>
                <AlertDescription>
                  {missingCount} material{missingCount !== 1 ? 's are' : ' is'} missing emission factors.
                  Click &quot;Fix&quot; next to each missing material to search and assign one.
                </AlertDescription>
              </Alert>
            )}
            {canCalculate && (
              <Alert className="border-green-200 bg-green-50 dark:bg-green-950/20">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertTitle className="text-green-900 dark:text-green-100">Ready to Calculate</AlertTitle>
                <AlertDescription className="text-green-800 dark:text-green-200">
                  All {materials.length} materials have verified emission data.
                </AlertDescription>
              </Alert>
            )}

            {/* Materials Table */}
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-base">Materials Data Quality ({materials.length})</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Material</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead>Quality</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {materials.map((material) => {
                      const badgeProps = material.dataQuality ? getQualityBadgeProps(material.dataQuality) : null;
                      const Icon = badgeProps?.icon;
                      const isEditing = editingMaterialId === material.id;
                      const isSaving = savingMaterialId === material.id;

                      return (
                        <Fragment key={material.id}>
                          <TableRow>
                            <TableCell className="font-medium text-sm">
                              {material.material_name}
                              {material.matched_source_name && material.matched_source_name !== material.material_name && (
                                <div className="text-xs text-amber-500 font-normal mt-0.5">Proxy: {material.matched_source_name}</div>
                              )}
                            </TableCell>
                            <TableCell className="capitalize text-sm">{material.material_type}</TableCell>
                            <TableCell className="text-right font-mono text-sm">{material.quantity} {material.unit}</TableCell>
                            <TableCell>
                              {material.hasData && badgeProps ? (
                                <Badge variant={badgeProps.variant} className={`${badgeProps.className} text-xs`}>
                                  {Icon && <Icon className="h-3 w-3 mr-1" />}
                                  {material.dataQuality?.replace('_', ' ')}
                                </Badge>
                              ) : (
                                <Badge variant="destructive" className="text-xs">Missing</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {material.hasData ? (
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                              ) : isSaving ? (
                                <Loader2 className="h-4 w-4 animate-spin text-lime-500" />
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-xs text-lime-600 hover:text-lime-700 hover:bg-lime-50 dark:text-lime-400 dark:hover:text-lime-300 dark:hover:bg-lime-950/30"
                                  onClick={() => setEditingMaterialId(isEditing ? null : material.id)}
                                >
                                  <Search className="h-3 w-3 mr-1" />
                                  {isEditing ? 'Cancel' : 'Fix'}
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>

                          {/* Inline search row for missing materials */}
                          {isEditing && !material.hasData && (
                            <TableRow className="bg-muted/30 hover:bg-muted/30">
                              <TableCell colSpan={5} className="py-3">
                                <div className="max-w-lg">
                                  <p className="text-xs text-muted-foreground mb-2">
                                    Search for an emission factor for &quot;{material.material_name}&quot;:
                                  </p>
                                  <InlineIngredientSearch
                                    organizationId={product.organization_id}
                                    value={material.material_name}
                                    placeholder={`Search emission factor for ${material.material_name}...`}
                                    materialType={material.material_type as 'ingredient' | 'packaging'}
                                    onSelect={(selection) => handleEmissionFactorSelect(material.id, selection)}
                                  />
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Facility Allocation */}
            {linkedFacilities.length > 0 && (
              <Card>
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Factory className="h-4 w-4" />
                    Facility Allocation
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {facilityAllocations.map((allocation) => (
                      <div key={allocation.facilityId} className="p-3 rounded-lg border space-y-3">
                        <div className="flex items-center gap-2">
                          {allocation.operationalControl === 'owned' ? (
                            <Building2 className="h-4 w-4 text-blue-600" />
                          ) : (
                            <Users className="h-4 w-4 text-amber-600" />
                          )}
                          <p className="font-medium text-sm">{allocation.facilityName}</p>
                        </div>

                        {/* Session selector */}
                        {(reportingSessions[allocation.facilityId] || []).length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {(reportingSessions[allocation.facilityId] || []).map((session) => {
                              const isSelected = allocation.selectedSessionId === session.id;
                              return (
                                <button
                                  key={session.id}
                                  type="button"
                                  onClick={() => {
                                    setFacilityAllocations(prev => prev.map(a =>
                                      a.facilityId === allocation.facilityId
                                        ? {
                                            ...a,
                                            reportingPeriodStart: session.reporting_period_start,
                                            reportingPeriodEnd: session.reporting_period_end,
                                            facilityTotalProduction: String(session.total_production_volume),
                                            productionVolumeUnit: session.volume_unit || 'units',
                                            selectedSessionId: session.id,
                                          }
                                        : a
                                    ));
                                  }}
                                  className={`px-2 py-1 rounded border text-xs transition-all ${
                                    isSelected
                                      ? 'border-green-500 bg-green-50 dark:bg-green-950/30'
                                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-400'
                                  }`}
                                >
                                  {new Date(session.reporting_period_start).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
                                  {isSelected && <CheckCircle2 className="h-3 w-3 inline ml-1 text-green-600" />}
                                </button>
                              );
                            })}
                          </div>
                        )}

                        <div className="grid grid-cols-3 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Product Volume</Label>
                            <Input
                              type="number"
                              placeholder="e.g. 10000"
                              value={allocation.productionVolume}
                              onChange={(e) => updateAllocation(allocation.facilityId, 'productionVolume', e.target.value)}
                              className="h-8 text-sm"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Unit</Label>
                            <Select
                              value={allocation.productionVolumeUnit}
                              onValueChange={(value) => updateAllocation(allocation.facilityId, 'productionVolumeUnit', value)}
                            >
                              <SelectTrigger className="h-8 text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {PRODUCTION_UNITS.map((unit) => (
                                  <SelectItem key={unit.value} value={unit.value}>{unit.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Total Facility</Label>
                            <Input
                              type="number"
                              placeholder="e.g. 100000"
                              value={allocation.facilityTotalProduction}
                              onChange={(e) => updateAllocation(allocation.facilityId, 'facilityTotalProduction', e.target.value)}
                              className="h-8 text-sm"
                            />
                          </div>
                        </div>

                        {allocation.productionVolume && allocation.facilityTotalProduction && (
                          <div className="p-2 rounded bg-lime-50 dark:bg-lime-900/20 border border-lime-200 dark:border-lime-800">
                            <p className="text-xs text-lime-800 dark:text-lime-200">
                              <strong>Attribution:</strong>{' '}
                              {((parseFloat(allocation.productionVolume) / parseFloat(allocation.facilityTotalProduction)) * 100).toFixed(2)}%
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {linkedFacilities.length === 0 && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  No facilities linked. Manufacturing emissions won't be included.
                </AlertDescription>
              </Alert>
            )}

            {/* Calculate Button */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCalculate}
                disabled={!canCalculate || calculating || hasFacilitiesMissingVolumes}
                className="min-w-[180px]"
              >
                {calculating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Calculating...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Calculate Impact
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Calculation progress overlay */}
        <OperationOverlay
          open={calculating}
          title="Creating Lifecycle Assessment"
          steps={calcSteps}
          progress={calcProgress}
          message="ISO 14067 compliant lifecycle assessment"
        />
      </SheetContent>
    </Sheet>
  );
}
