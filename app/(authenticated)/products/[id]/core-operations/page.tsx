"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageLoader } from "@/components/ui/page-loader";
import { ArrowLeft, Calculator, AlertCircle, CheckCircle2, Info, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import { useOrganization } from "@/lib/organizationContext";
import { getFacilityIntensity, listFacilitiesWithIntensity, type FacilityIntensity } from "@/lib/facilityIntensity";

interface Facility {
  id: string;
  name: string;
  location: string | null;
}

interface ProductData {
  id: number;
  name: string;
  core_operations_data: any;
  core_operations_provenance: string | null;
  core_operations_complete: boolean;
}

interface AllocatedImpacts {
  co2e_per_unit: number;
  water_per_unit: number;
  waste_per_unit: number;
  allocation_ratio: number;
  facility_name: string;
}

interface CoreOperationsPageProps {
  params: {
    id: string;
  };
}

export default function CoreOperationsPage({ params }: CoreOperationsPageProps) {
  const router = useRouter();
  const { currentOrganization } = useOrganization();
  const productId = params.id;

  const [product, setProduct] = useState<ProductData | null>(null);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [facilitiesWithIntensity, setFacilitiesWithIntensity] = useState<FacilityIntensity[]>([]);
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>("");
  const [selectedIntensity, setSelectedIntensity] = useState<FacilityIntensity | null>(null);
  const [productNetVolume, setProductNetVolume] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allocatedImpacts, setAllocatedImpacts] = useState<AllocatedImpacts | null>(null);
  const [provenance, setProvenance] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [productId, currentOrganization]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      if (!currentOrganization?.id) {
        throw new Error("No organization selected");
      }

      const [productResult, facilitiesResult, intensitiesResult] = await Promise.all([
        supabase
          .from("products")
          .select("id, name, unit_size_value, unit_size_unit, core_operations_data, core_operations_provenance, core_operations_complete")
          .eq("id", productId)
          .single(),
        supabase
          .from("facilities")
          .select("id, name, location")
          .eq("organization_id", currentOrganization.id)
          .order("name"),
        listFacilitiesWithIntensity(currentOrganization.id),
      ]);

      if (productResult.error) throw productResult.error;
      if (facilitiesResult.error) throw facilitiesResult.error;

      setProduct(productResult.data);
      setFacilities(facilitiesResult.data || []);

      if (intensitiesResult.success) {
        setFacilitiesWithIntensity(intensitiesResult.facilities);
      }

      // Pre-fill product volume from product definition
      if (productResult.data.unit_size_value) {
        setProductNetVolume(String(productResult.data.unit_size_value));
      }

      if (productResult.data.core_operations_data &&
          typeof productResult.data.core_operations_data === 'object' &&
          'co2e_per_unit' in productResult.data.core_operations_data) {
        const data = productResult.data.core_operations_data;
        setAllocatedImpacts({
          co2e_per_unit: Number(data.co2e_per_unit) || 0,
          water_per_unit: Number(data.water_per_unit) || 0,
          waste_per_unit: Number(data.waste_per_unit) || 0,
          allocation_ratio: Number(data.allocation_ratio) || 0,
          facility_name: data.facility_name || 'Unknown',
        });
        setProvenance(productResult.data.core_operations_provenance);
      }
    } catch (err: any) {
      console.error("Error loading data:", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFacilityChange = async (facilityId: string) => {
    setSelectedFacilityId(facilityId);

    if (!currentOrganization?.id) return;

    // Fetch intensity for selected facility
    const result = await getFacilityIntensity(facilityId, currentOrganization.id);
    if (result.success && result.intensity) {
      setSelectedIntensity(result.intensity);
    } else {
      setSelectedIntensity(null);
      if (result.error) {
        toast.error(result.error);
      }
    }
  };

  const handleCalculate = async () => {
    try {
      setIsCalculating(true);
      setError(null);

      if (!selectedFacilityId || !selectedIntensity) {
        toast.error("Please select a facility with calculated intensity");
        return;
      }

      const productVol = parseFloat(productNetVolume);

      if (isNaN(productVol) || productVol <= 0) {
        toast.error("Please enter a valid product volume");
        return;
      }

      // Calculate impact using facility intensity
      const calculatedCO2e = selectedIntensity.calculatedIntensity! * productVol;

      // Store the calculated impact
      const { error: updateError } = await supabase
        .from("products")
        .update({
          core_operations_data: {
            co2e_per_unit: calculatedCO2e,
            water_per_unit: 0, // TODO: Add water intensity
            waste_per_unit: 0, // TODO: Add waste intensity
            facility_name: selectedIntensity.facilityName,
            facility_intensity: selectedIntensity.calculatedIntensity,
            product_volume: productVol,
            volume_unit: selectedIntensity.volumeUnit,
          },
          core_operations_provenance: selectedIntensity.isEstimate ? 'estimated' : 'verified',
          core_operations_complete: true,
        })
        .eq("id", productId);

      if (updateError) throw updateError;

      setAllocatedImpacts({
        co2e_per_unit: calculatedCO2e,
        water_per_unit: 0,
        waste_per_unit: 0,
        allocation_ratio: 1,
        facility_name: selectedIntensity.facilityName,
      });
      setProvenance(selectedIntensity.isEstimate ? 'estimated' : 'verified');
      toast.success("Manufacturing impact calculated successfully");

      await loadData();
    } catch (err: any) {
      console.error("Error calculating impacts:", err);
      toast.error(err.message || "Failed to calculate impacts");
      setError(err.message);
    } finally {
      setIsCalculating(false);
    }
  };

  if (isLoading) {
    return <PageLoader message="Loading core operations data..." />;
  }

  if (error && !product) {
    return (
      <div className="container mx-auto p-6 max-w-5xl">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button onClick={() => router.push(`/products/${productId}`)} className="mt-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Product
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Core Operations</h1>
          <p className="text-muted-foreground mt-1">{product?.name}</p>
        </div>
        <Button variant="outline" onClick={() => router.push(`/products/${productId}`)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Product
        </Button>
      </div>

      <Alert variant="default" className="border-amber-500 bg-amber-50 dark:bg-amber-950">
        <AlertCircle className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-800 dark:text-amber-200">
          <strong>Notice:</strong> This workflow has been superseded by our ISO14044-compliant LCA process.
          For new assessments, please use the <Button
            variant="link"
            className="p-0 h-auto text-amber-900 dark:text-amber-100 underline font-semibold"
            onClick={() => router.push(`/products/${productId}/lca/initiate`)}
          >
            ISO14044 LCA Flow
          </Button>.
        </AlertDescription>
      </Alert>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Calculate manufacturing impacts using facility emission intensity. This ISO 14044-compliant approach
          prevents denominator drift by using a fixed intensity factor calculated from verified facility data.
        </AlertDescription>
      </Alert>

      {facilities.length === 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No facilities found. Please add facilities to your organisation before allocating impacts.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Facility Impact Allocation</CardTitle>
          <CardDescription>
            Calculate manufacturing impacts using pre-calculated facility emission intensity
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="facility">Select Manufacturing Facility *</Label>
            <Select value={selectedFacilityId} onValueChange={handleFacilityChange}>
              <SelectTrigger id="facility" className="mt-1">
                <SelectValue placeholder="Choose a facility" />
              </SelectTrigger>
              <SelectContent>
                {facilitiesWithIntensity.map((facility) => (
                  <SelectItem key={facility.facilityId} value={facility.facilityId}>
                    <div className="flex items-center justify-between w-full">
                      <span>{facility.facilityName}</span>
                      {facility.isEstimate ? (
                        <Badge variant="outline" className="ml-2">ESTIMATE</Badge>
                      ) : (
                        <Badge variant="secondary" className="ml-2">VERIFIED</Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {facilitiesWithIntensity.length === 0 && facilities.length > 0 && (
              <Alert className="mt-2">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  No facilities have emission intensity data. Please log emissions data for your facilities first.
                </AlertDescription>
              </Alert>
            )}
          </div>

          {selectedIntensity && (
            <div className="p-4 border rounded-lg bg-muted/50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Facility Emission Intensity:</span>
                {selectedIntensity.isEstimate ? (
                  <Badge variant="outline">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    ESTIMATE
                  </Badge>
                ) : (
                  <Badge variant="secondary">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    VERIFIED
                  </Badge>
                )}
              </div>
              <p className="text-2xl font-bold text-primary">
                {selectedIntensity.calculatedIntensity?.toFixed(3)} kg CO₂e / {selectedIntensity.volumeUnit}
              </p>
              <p className="text-xs text-muted-foreground">
                Based on data from {new Date(selectedIntensity.reportingPeriodStart).toLocaleDateString()} to{' '}
                {new Date(selectedIntensity.reportingPeriodEnd).toLocaleDateString()}
              </p>
              {selectedIntensity.isEstimate && (
                <Alert variant="destructive" className="mt-2">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    This facility uses industry average data. This will result in a lower Data Quality Score.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          <div>
            <Label htmlFor="product_volume">
              Product Volume (per functional unit) *
            </Label>
            <Input
              id="product_volume"
              type="number"
              step="0.001"
              min="0"
              value={productNetVolume}
              onChange={(e) => setProductNetVolume(e.target.value)}
              placeholder="e.g., 0.33"
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Volume of this product (automatically populated from product definition)
            </p>
          </div>

          <Button
            onClick={handleCalculate}
            disabled={isCalculating || !selectedIntensity}
            className="w-full"
          >
            <Calculator className="mr-2 h-4 w-4" />
            {isCalculating ? "Calculating..." : "Calculate Manufacturing Impact"}
          </Button>
        </CardContent>
      </Card>

      {allocatedImpacts && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <CardTitle>Allocated Impacts (Per Unit)</CardTitle>
            </div>
            <CardDescription>
              Environmental impacts allocated to this product based on production volume
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">
                    Scope 1 & 2 CO₂e
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {(allocatedImpacts.co2e_per_unit ?? 0).toFixed(3)}
                  </div>
                  <p className="text-xs text-muted-foreground">kg CO₂e per unit</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Water Use</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {(allocatedImpacts.water_per_unit ?? 0).toFixed(3)}
                  </div>
                  <p className="text-xs text-muted-foreground">litres per unit</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Waste Generated</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {(allocatedImpacts.waste_per_unit ?? 0).toFixed(3)}
                  </div>
                  <p className="text-xs text-muted-foreground">kg per unit</p>
                </CardContent>
              </Card>
            </div>

            {provenance && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <strong>Provenance:</strong> {provenance}
                </AlertDescription>
              </Alert>
            )}

            <div className="text-sm text-muted-foreground">
              <p>
                <strong>Allocation Ratio:</strong>{" "}
                {((allocatedImpacts.allocation_ratio ?? 0) * 100).toFixed(2)}%
              </p>
              <p>
                <strong>Facility:</strong> {allocatedImpacts.facility_name ?? 'Unknown'}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
