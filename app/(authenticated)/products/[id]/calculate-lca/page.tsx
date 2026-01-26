"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageLoader } from "@/components/ui/page-loader";
import {
  ArrowLeft,
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
  MapPin,
  Calendar
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import { validateMaterialsBeforeCalculation, type ProductMaterial } from "@/lib/impact-waterfall-resolver";
import { calculateProductLCA } from "@/lib/product-lca-calculator";
import { toast } from "sonner";

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
}

const PRODUCTION_UNITS = [
  { value: "units", label: "Units" },
  { value: "litres", label: "Litres" },
  { value: "kg", label: "Kilograms" },
  { value: "tonnes", label: "Tonnes" },
  { value: "cases", label: "Cases" },
  { value: "pallets", label: "Pallets" },
];

export default function CalculateLCAPage() {
  const router = useRouter();
  const params = useParams();
  const productId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [product, setProduct] = useState<any>(null);
  const [materials, setMaterials] = useState<MaterialWithValidation[]>([]);
  const [canCalculate, setCanCalculate] = useState(false);
  const [missingCount, setMissingCount] = useState(0);
  const [linkedFacilities, setLinkedFacilities] = useState<LinkedFacility[]>([]);
  const [facilityAllocations, setFacilityAllocations] = useState<FacilityAllocation[]>([]);

  useEffect(() => {
    async function loadAndValidate() {
      const supabase = getSupabaseBrowserClient();

      try {
        setLoading(true);

        // Fetch product
        const { data: productData, error: productError } = await supabase
          .from('products')
          .select('*')
          .eq('id', productId)
          .maybeSingle();

        if (productError || !productData) {
          toast.error('Product not found');
          router.push('/products');
          return;
        }

        setProduct(productData);

        // Fetch materials
        const { data: materialsData, error: materialsError } = await supabase
          .from('product_materials')
          .select('*')
          .eq('product_id', productId);

        if (materialsError) {
          throw materialsError;
        }

        if (!materialsData || materialsData.length === 0) {
          toast.error('No materials found. Please add ingredients and packaging first.');
          router.push(`/products/${productId}`);
          return;
        }

        // Validate each material
        const validation = await validateMaterialsBeforeCalculation(materialsData as ProductMaterial[]);

        const materialsWithStatus: MaterialWithValidation[] = materialsData.map((mat) => {
          const validMaterial = validation.validMaterials.find((v) => v.material.id === mat.id);
          const missingMaterial = validation.missingData.find((m) => m.material.id === mat.id);

          if (validMaterial) {
            return {
              ...mat,
              hasData: true,
              dataQuality: validMaterial.resolved.data_quality_tag,
              confidenceScore: validMaterial.resolved.confidence_score
            };
          } else if (missingMaterial) {
            return {
              ...mat,
              hasData: false,
              error: missingMaterial.error
            };
          } else {
            return {
              ...mat,
              hasData: false,
              error: 'Unknown validation error'
            };
          }
        });

        setMaterials(materialsWithStatus);
        setCanCalculate(validation.valid);
        setMissingCount(validation.missingData.length);

        // Fetch linked facilities
        const { data: facilitiesData, error: facilitiesError } = await supabase
          .from('facility_product_assignments')
          .select(`
            id,
            facility_id,
            facilities (
              id,
              name,
              operational_control,
              address_city,
              address_country
            )
          `)
          .eq('product_id', productId)
          .eq('assignment_status', 'active');

        if (!facilitiesError && facilitiesData) {
          const facilities = facilitiesData.map((f: any) => ({
            id: f.id,
            facility_id: f.facility_id,
            facility: f.facilities
          })) as LinkedFacility[];

          setLinkedFacilities(facilities);

          // Initialize allocations for each facility
          const defaultEndDate = new Date().toISOString().split('T')[0];
          const defaultStartDate = new Date(new Date().setFullYear(new Date().getFullYear() - 1)).toISOString().split('T')[0];

          setFacilityAllocations(facilities.map(f => ({
            facilityId: f.facility_id,
            facilityName: f.facility.name,
            operationalControl: f.facility.operational_control,
            reportingPeriodStart: defaultStartDate,
            reportingPeriodEnd: defaultEndDate,
            productionVolume: '',
            productionVolumeUnit: 'units',
            facilityTotalProduction: '',
          })));
        }

      } catch (error: any) {
        console.error('Error loading materials:', error);
        toast.error(error.message || 'Failed to load materials');
      } finally {
        setLoading(false);
      }
    }

    loadAndValidate();
  }, [productId, router]);

  const handleCalculate = async () => {
    if (!canCalculate) {
      toast.error('Cannot calculate: some materials are missing emission data');
      return;
    }

    // Validate: if facilities are linked, require production volumes
    if (linkedFacilities.length > 0) {
      const missingVolumes = facilityAllocations.filter(
        a => !a.productionVolume || !a.facilityTotalProduction
      );

      if (missingVolumes.length > 0) {
        const facilityNames = missingVolumes.map(a => a.facilityName).join(', ');
        toast.error(
          `Please enter production volumes for all linked facilities: ${facilityNames}`,
          { duration: 6000 }
        );
        return;
      }
    }

    setCalculating(true);

    try {
      toast.info('Starting LCA calculation...');

      // Prepare facility allocations if available
      const validAllocations = facilityAllocations
        .filter(a => a.productionVolume && a.facilityTotalProduction)
        .map(a => ({
          facilityId: a.facilityId,
          facilityName: a.facilityName,
          operationalControl: a.operationalControl,
          reportingPeriodStart: a.reportingPeriodStart,
          reportingPeriodEnd: a.reportingPeriodEnd,
          productionVolume: parseFloat(a.productionVolume),
          productionVolumeUnit: a.productionVolumeUnit,
          facilityTotalProduction: parseFloat(a.facilityTotalProduction),
        }));

      const result = await calculateProductLCA({
        productId,
        functionalUnit: `1 ${product.unit || 'unit'} of ${product.name}`,
        systemBoundary: 'cradle-to-gate',
        referenceYear: new Date().getFullYear(),
        facilityAllocations: validAllocations.length > 0 ? validAllocations : undefined
      });

      if (!result.success) {
        throw new Error(result.error || 'Calculation failed');
      }

      toast.success('LCA calculation completed successfully');
      router.push(`/products/${productId}/report`);

    } catch (error: any) {
      console.error('Calculation error:', error);
      toast.error(error.message || 'Failed to calculate impact');
    } finally {
      setCalculating(false);
    }
  };

  const getQualityBadgeProps = (tag: string) => {
    switch (tag) {
      case 'Primary_Verified':
        return { variant: 'default' as const, className: 'bg-green-600 hover:bg-green-700', icon: Shield };
      case 'Regional_Standard':
        return { variant: 'default' as const, className: 'bg-blue-600 hover:bg-blue-700', icon: TrendingUp };
      case 'Secondary_Modelled':
        return { variant: 'secondary' as const, className: '', icon: Database };
      default:
        return { variant: 'secondary' as const, className: '', icon: Info };
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

  // Check if facilities are linked but missing production volumes
  const hasFacilitiesMissingVolumes = linkedFacilities.length > 0 &&
    facilityAllocations.some(a => !a.productionVolume || !a.facilityTotalProduction);

  if (loading) {
    return <PageLoader message="Validating materials..." />;
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Calculate Product Impact</h1>
          <p className="text-muted-foreground mt-1">
            ISO 14067 compliant carbon footprint calculation
          </p>
        </div>
        <Button variant="outline" onClick={() => router.push(`/products/${productId}`)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Product
        </Button>
      </div>

      {/* Product Info */}
      {product && (
        <Card>
          <CardHeader>
            <CardTitle>{product.name}</CardTitle>
            <CardDescription>
              {product.product_description || 'No description'}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Validation Status */}
      {!canCalculate && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Missing Emission Data</AlertTitle>
          <AlertDescription>
            {missingCount} material{missingCount !== 1 ? 's are' : ' is'} missing emission factors.
            Please add emission data, select verified supplier products, or choose materials
            from the database before calculating.
          </AlertDescription>
        </Alert>
      )}

      {canCalculate && (
        <Alert className="border-green-200 bg-green-50 dark:bg-green-950/20">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-green-900 dark:text-green-100">Ready to Calculate</AlertTitle>
          <AlertDescription className="text-green-800 dark:text-green-200">
            All materials have verified emission data. You can proceed with the calculation.
          </AlertDescription>
        </Alert>
      )}

      {/* Materials Table */}
      <Card>
        <CardHeader>
          <CardTitle>Materials Data Quality ({materials.length} items)</CardTitle>
          <CardDescription>
            Review data sources and quality before calculating impact
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Material Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead>Data Quality</TableHead>
                <TableHead className="text-right">Confidence</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {materials.map((material) => {
                const badgeProps = material.dataQuality ? getQualityBadgeProps(material.dataQuality) : null;
                const Icon = badgeProps?.icon;

                return (
                  <TableRow key={material.id}>
                    <TableCell className="font-medium">{material.material_name}</TableCell>
                    <TableCell className="capitalize">{material.material_type}</TableCell>
                    <TableCell className="text-right font-mono">
                      {material.quantity} {material.unit}
                    </TableCell>
                    <TableCell>
                      {material.hasData && badgeProps ? (
                        <Badge variant={badgeProps.variant} className={badgeProps.className}>
                          {Icon && <Icon className="h-3 w-3 mr-1" />}
                          {material.dataQuality?.replace('_', ' ')}
                        </Badge>
                      ) : (
                        <Badge variant="destructive">Missing Data</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {material.hasData && material.confidenceScore ? (
                        <span className={`font-semibold ${getConfidenceColor(material.confidenceScore)}`}>
                          {material.confidenceScore}%
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {material.hasData ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-red-600" />
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Facility Allocation Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Factory className="h-5 w-5" />
                Facility Allocation
              </CardTitle>
              <CardDescription>
                Enter production volumes for each linked facility to calculate manufacturing emissions
              </CardDescription>
            </div>
            {linkedFacilities.length === 0 && (
              <Link href={`/products/${productId}?tab=facilities`}>
                <Button variant="outline" size="sm">
                  Link Facilities
                </Button>
              </Link>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {linkedFacilities.length === 0 ? (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                No facilities linked to this product. Manufacturing emissions (Scope 1 & 2) will not be included.
                <Link href={`/products/${productId}?tab=facilities`} className="ml-1 underline">
                  Link facilities
                </Link> to include facility-level emissions in the calculation.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-6">
              {facilityAllocations.map((allocation) => (
                <div key={allocation.facilityId} className="p-4 rounded-lg border bg-slate-50 dark:bg-slate-900/50 space-y-4">
                  <div className="flex items-center gap-3">
                    {allocation.operationalControl === 'owned' ? (
                      <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                        <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      </div>
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                        <Users className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                      </div>
                    )}
                    <div>
                      <p className="font-semibold">{allocation.facilityName}</p>
                      <Badge variant="outline" className="text-xs">
                        {allocation.operationalControl === 'owned' ? 'Owned Facility' : 'Contract Manufacturer'}
                      </Badge>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        Reporting Period Start
                      </Label>
                      <Input
                        type="date"
                        value={allocation.reportingPeriodStart}
                        onChange={(e) => updateAllocation(allocation.facilityId, 'reportingPeriodStart', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        Reporting Period End
                      </Label>
                      <Input
                        type="date"
                        value={allocation.reportingPeriodEnd}
                        onChange={(e) => updateAllocation(allocation.facilityId, 'reportingPeriodEnd', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Product Volume</Label>
                      <Input
                        type="number"
                        placeholder="e.g. 10000"
                        value={allocation.productionVolume}
                        onChange={(e) => updateAllocation(allocation.facilityId, 'productionVolume', e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Volume of this product made at this facility
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>Unit</Label>
                      <Select
                        value={allocation.productionVolumeUnit}
                        onValueChange={(value) => updateAllocation(allocation.facilityId, 'productionVolumeUnit', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PRODUCTION_UNITS.map((unit) => (
                            <SelectItem key={unit.value} value={unit.value}>
                              {unit.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Total Facility Production</Label>
                      <Input
                        type="number"
                        placeholder="e.g. 100000"
                        value={allocation.facilityTotalProduction}
                        onChange={(e) => updateAllocation(allocation.facilityId, 'facilityTotalProduction', e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Total production at facility in the period
                      </p>
                    </div>
                  </div>

                  {allocation.productionVolume && allocation.facilityTotalProduction && (
                    <div className="p-3 rounded-lg bg-lime-50 dark:bg-lime-900/20 border border-lime-200 dark:border-lime-800">
                      <p className="text-sm text-lime-800 dark:text-lime-200">
                        <strong>Attribution Ratio:</strong>{' '}
                        {((parseFloat(allocation.productionVolume) / parseFloat(allocation.facilityTotalProduction)) * 100).toFixed(2)}%
                        of facility emissions will be allocated to this product
                      </p>
                    </div>
                  )}
                </div>
              ))}

              {linkedFacilities.length > 0 && !hasFacilitiesWithAllocations && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Production Volumes Required</AlertTitle>
                  <AlertDescription>
                    You have {linkedFacilities.length} facilit{linkedFacilities.length === 1 ? 'y' : 'ies'} linked to this product.
                    Enter the product volume and total facility production for each facility to calculate manufacturing emissions.
                    This data is required to determine how much of each facility's emissions should be allocated to this product.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Data Quality Legend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Data Quality Hierarchy</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-green-600" />
            <strong>Primary Verified:</strong>
            <span className="text-muted-foreground">
              Direct supplier EPDs and verified product carbon footprints (95% confidence)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-blue-600" />
            <strong>Regional Standard:</strong>
            <span className="text-muted-foreground">
              Government emission factors (DEFRA, EPA) for energy and transport (85% confidence)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-slate-600" />
            <strong>Secondary Modelled:</strong>
            <span className="text-muted-foreground">
              Ecoinvent 3.12 life cycle database averages (50-70% confidence)
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Calculate Button */}
      <div className="flex justify-end gap-4 items-center">
        {hasFacilitiesMissingVolumes && (
          <span className="text-sm text-muted-foreground">
            Enter production volumes above to enable calculation
          </span>
        )}
        <Button
          onClick={handleCalculate}
          disabled={!canCalculate || calculating || hasFacilitiesMissingVolumes}
          size="lg"
          className="min-w-[200px]"
        >
          {calculating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Calculating...
            </>
          ) : (
            <>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Calculate Impact Report
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
