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
import { ArrowLeft, Calculator, AlertCircle, CheckCircle2, Info } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import { useOrganization } from "@/lib/organizationContext";

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
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>("");
  const [totalProductionVolume, setTotalProductionVolume] = useState<string>("");
  const [productProductionVolume, setProductProductionVolume] = useState<string>("");
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

      const [productResult, facilitiesResult] = await Promise.all([
        supabase
          .from("products")
          .select("id, name, core_operations_data, core_operations_provenance, core_operations_complete")
          .eq("id", productId)
          .single(),
        supabase
          .from("facilities")
          .select("id, name, location")
          .eq("organization_id", currentOrganization.id)
          .order("name"),
      ]);

      if (productResult.error) throw productResult.error;
      if (facilitiesResult.error) throw facilitiesResult.error;

      setProduct(productResult.data);
      setFacilities(facilitiesResult.data || []);

      if (productResult.data.core_operations_data) {
        setAllocatedImpacts(productResult.data.core_operations_data);
        setProvenance(productResult.data.core_operations_provenance);
      }
    } catch (err: any) {
      console.error("Error loading data:", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCalculate = async () => {
    try {
      setIsCalculating(true);
      setError(null);

      if (!selectedFacilityId) {
        toast.error("Please select a manufacturing facility");
        return;
      }

      const totalVol = parseFloat(totalProductionVolume);
      const productVol = parseFloat(productProductionVolume);

      if (isNaN(totalVol) || totalVol <= 0) {
        toast.error("Please enter a valid total production volume");
        return;
      }

      if (isNaN(productVol) || productVol <= 0) {
        toast.error("Please enter a valid product production volume");
        return;
      }

      if (productVol > totalVol) {
        toast.error("Product volume cannot exceed total facility volume");
        return;
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/allocate-facility-impacts`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            product_id: parseInt(productId),
            facility_id: selectedFacilityId,
            total_production_volume: totalVol,
            product_production_volume: productVol,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to allocate impacts");
      }

      setAllocatedImpacts(result.allocated_impacts);
      setProvenance(result.provenance);
      toast.success("Impacts calculated and allocated successfully");

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
        <Button onClick={() => router.push(`/products/${productId}/hub`)} className="mt-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Hub
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
        <Button variant="outline" onClick={() => router.push(`/products/${productId}/hub`)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Hub
        </Button>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Allocate facility-level environmental impacts to this product based on production volume.
          This uses actual measured data from your facilities for accurate LCA calculations.
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
            Select a facility and enter production volumes to calculate per-unit impacts
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="facility">Select Manufacturing Facility *</Label>
            <Select value={selectedFacilityId} onValueChange={setSelectedFacilityId}>
              <SelectTrigger id="facility" className="mt-1">
                <SelectValue placeholder="Choose a facility" />
              </SelectTrigger>
              <SelectContent>
                {facilities.map((facility) => (
                  <SelectItem key={facility.id} value={facility.id}>
                    {facility.name}
                    {facility.location && ` - ${facility.location}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="total_volume">
              Total Annual Production Volume at this Facility (All Products) *
            </Label>
            <Input
              id="total_volume"
              type="number"
              step="0.01"
              min="0"
              value={totalProductionVolume}
              onChange={(e) => setTotalProductionVolume(e.target.value)}
              placeholder="e.g., 1000000"
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Total units produced at this facility annually
            </p>
          </div>

          <div>
            <Label htmlFor="product_volume">
              Annual Production Volume for this Product *
            </Label>
            <Input
              id="product_volume"
              type="number"
              step="0.01"
              min="0"
              value={productProductionVolume}
              onChange={(e) => setProductProductionVolume(e.target.value)}
              placeholder="e.g., 125000"
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Units of this specific product produced annually
            </p>
          </div>

          <Button
            onClick={handleCalculate}
            disabled={isCalculating || facilities.length === 0}
            className="w-full"
          >
            <Calculator className="mr-2 h-4 w-4" />
            {isCalculating ? "Calculating..." : "Calculate & Allocate Impacts"}
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
                    {allocatedImpacts.co2e_per_unit.toFixed(4)}
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
                    {allocatedImpacts.water_per_unit.toFixed(4)}
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
                    {allocatedImpacts.waste_per_unit.toFixed(4)}
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
                {(allocatedImpacts.allocation_ratio * 100).toFixed(2)}%
              </p>
              <p>
                <strong>Facility:</strong> {allocatedImpacts.facility_name}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
