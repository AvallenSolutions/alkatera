"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertCircle,
  Building2,
  Calendar,
  CheckCircle2,
  Circle,
  Factory,
  Link as LinkIcon,
  Loader2,
  Plus,
  Search,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { ReportingPeriodTimeline } from "@/components/shared/ReportingPeriodTimeline";
import { AllocationSankeyDiagram } from "@/components/shared/AllocationSankeyDiagram";
import { AllocationOnboardingGuide } from "@/components/shared/AllocationOnboardingGuide";

interface MatrixCell {
  assignmentId: string | null;
  facilityId: string;
  productId: number;
  hasAllocations: boolean;
  latestAllocation: {
    allocated_emissions: number;
    reporting_period_start: string;
    reporting_period_end: string;
    status: string;
    attribution_ratio: number;
  } | null;
  assignmentStatus: string | null;
}

interface Facility {
  id: string;
  name: string;
  city: string | null;
  country: string | null;
  operationalControl: string;
}

interface Product {
  id: number;
  name: string;
  sku: string | null;
}

interface AllocationHealth {
  totalFacilities: number;
  facilitiesWithAllocations: number;
  totalProducts: number;
  productsWithAllocations: number;
  unallocatedCapacity: number;
}

export default function ProductionAllocationPage() {
  const router = useRouter();
  const supabase = getSupabaseBrowserClient();

  const [loading, setLoading] = useState(true);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [matrixData, setMatrixData] = useState<Map<string, MatrixCell>>(new Map());
  const [allocationHealth, setAllocationHealth] = useState<AllocationHealth | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("matrix");

  useEffect(() => {
    loadOrganizationAndData();
  }, []);

  const loadOrganizationAndData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("default_organization_id")
        .eq("id", user.id)
        .single();

      if (!profile?.default_organization_id) {
        toast.error("No organization found");
        return;
      }

      setOrganizationId(profile.default_organization_id);
      await loadAllData(profile.default_organization_id);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Failed to load allocation data");
    } finally {
      setLoading(false);
    }
  };

  const loadAllData = async (orgId: string) => {
    const [facilitiesRes, productsRes, matrixRes, capacityRes] = await Promise.all([
      supabase
        .from("facilities")
        .select("id, name, address_city, address_country, operational_control")
        .eq("organization_id", orgId)
        .order("name"),

      supabase
        .from("products")
        .select("id, name, sku")
        .eq("organization_id", orgId)
        .eq("is_draft", false)
        .order("name"),

      supabase
        .from("facility_product_allocation_matrix")
        .select("*")
        .eq("organization_id", orgId),

      supabase.rpc("get_facility_unallocated_capacity", { p_organization_id: orgId }),
    ]);

    if (facilitiesRes.error) {
      console.error("Error loading facilities:", facilitiesRes.error);
    }
    if (productsRes.error) {
      console.error("Error loading products:", productsRes.error);
    }
    if (matrixRes.error) {
      console.error("Error loading allocation matrix:", matrixRes.error);
    }
    if (capacityRes.error) {
      console.error("Error loading capacity data:", capacityRes.error);
    }

    const facilitiesData = facilitiesRes.data || [];
    const productsData = productsRes.data || [];
    const matrixItems = matrixRes.data || [];
    const capacityData = capacityRes.data || [];

    setFacilities(facilitiesData.map(f => ({
      id: f.id,
      name: f.name,
      city: f.address_city,
      country: f.address_country,
      operationalControl: f.operational_control,
    })));

    setProducts(productsData);

    // Build matrix map from fresh data
    const matrix = new Map<string, MatrixCell>();
    matrixItems.forEach((item: any) => {
      const key = `${item.facility_id}-${item.product_id}`;
      matrix.set(key, {
        assignmentId: item.assignment_id,
        facilityId: item.facility_id,
        productId: item.product_id,
        hasAllocations: item.has_allocations,
        latestAllocation: item.latest_allocation,
        assignmentStatus: item.assignment_status,
      });
    });
    setMatrixData(matrix);

    // Calculate allocation health using fresh data (not stale state)
    const facilitiesWithAllocations = new Set(
      Array.from(matrix.values())
        .filter(cell => cell.hasAllocations)
        .map(cell => cell.facilityId)
    ).size;

    const productsWithAllocations = new Set(
      Array.from(matrix.values())
        .filter(cell => cell.hasAllocations)
        .map(cell => cell.productId)
    ).size;

    const totalUnallocated = capacityData.reduce(
      (sum: number, f: any) => sum + (f.unallocated_emissions_kg_co2e || 0),
      0
    );

    setAllocationHealth({
      totalFacilities: facilitiesData.length,
      facilitiesWithAllocations,
      totalProducts: productsData.length,
      productsWithAllocations,
      unallocatedCapacity: totalUnallocated,
    });
  };

  const getCellStatus = (facilityId: string, productId: number) => {
    const key = `${facilityId}-${productId}`;
    const cell = matrixData.get(key);

    if (!cell || !cell.assignmentId) {
      return { status: "unassigned", color: "bg-slate-700", icon: Circle };
    }

    if (cell.hasAllocations && cell.latestAllocation) {
      if (cell.latestAllocation.status === "verified") {
        return { status: "allocated", color: "bg-green-500/20 border-green-500/50", icon: CheckCircle2 };
      }
      return { status: "partial", color: "bg-amber-500/20 border-amber-500/50", icon: AlertCircle };
    }

    return { status: "assigned", color: "bg-blue-500/20 border-blue-500/50", icon: LinkIcon };
  };

  const handleCellClick = (facilityId: string, productId: number) => {
    router.push(`/products/${productId}?tab=production-sites&facility=${facilityId}`);
  };

  const handleToggleAssignment = async (facilityId: string, productId: number) => {
    if (!organizationId) return;

    const key = `${facilityId}-${productId}`;
    const cell = matrixData.get(key);

    try {
      if (cell?.assignmentId) {
        const { error } = await supabase
          .from("facility_product_assignments")
          .delete()
          .eq("id", cell.assignmentId);

        if (error) throw error;
        toast.success("Assignment removed");
      } else {
        const { error } = await supabase
          .from("facility_product_assignments")
          .insert({
            organization_id: organizationId,
            facility_id: facilityId,
            product_id: productId,
            assignment_status: "active",
          });

        if (error) throw error;
        toast.success("Assignment created");
      }

      await loadAllData(organizationId);
    } catch (error: any) {
      console.error("Error toggling assignment:", error);
      toast.error(error.message || "Failed to update assignment");
    }
  };

  const filteredFacilities = facilities.filter(f =>
    f.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.sku?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-lime-400" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Production Allocation Hub</h1>
          <p className="text-slate-400 mt-1">
            Visual overview of facility-product relationships and allocation status
          </p>
        </div>
        <Button
          onClick={() => router.push("/company/facilities")}
          variant="outline"
        >
          <Building2 className="mr-2 h-4 w-4" />
          Manage Facilities
        </Button>
      </div>

      {organizationId && <AllocationOnboardingGuide organizationId={organizationId} />}

      {allocationHealth && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-slate-900/50 border-slate-800">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-400 uppercase">Facilities</p>
                  <p className="text-2xl font-bold text-white mt-1">
                    {allocationHealth.facilitiesWithAllocations}/{allocationHealth.totalFacilities}
                  </p>
                  <p className="text-xs text-slate-500">with allocations</p>
                </div>
                <Factory className="h-8 w-8 text-blue-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/50 border-slate-800">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-400 uppercase">Products</p>
                  <p className="text-2xl font-bold text-white mt-1">
                    {allocationHealth.productsWithAllocations}/{allocationHealth.totalProducts}
                  </p>
                  <p className="text-xs text-slate-500">with production sites</p>
                </div>
                <TrendingUp className="h-8 w-8 text-lime-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/50 border-slate-800">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-400 uppercase">Completion</p>
                  <p className="text-2xl font-bold text-white mt-1">
                    {allocationHealth.totalFacilities > 0
                      ? Math.round((allocationHealth.facilitiesWithAllocations / allocationHealth.totalFacilities) * 100)
                      : 0}%
                  </p>
                  <p className="text-xs text-slate-500">facility coverage</p>
                </div>
                <CheckCircle2 className="h-8 w-8 text-green-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/50 border-slate-800">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-400 uppercase">Unallocated</p>
                  <p className="text-2xl font-bold text-amber-400 mt-1">
                    {allocationHealth.unallocatedCapacity.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </p>
                  <p className="text-xs text-slate-500">kg CO₂e</p>
                </div>
                <AlertCircle className="h-8 w-8 text-amber-400" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="matrix">
            <Building2 className="mr-2 h-4 w-4" />
            Allocation Matrix
          </TabsTrigger>
          <TabsTrigger value="timeline">
            <Calendar className="mr-2 h-4 w-4" />
            Timeline View
          </TabsTrigger>
          <TabsTrigger value="flow">
            <TrendingUp className="mr-2 h-4 w-4" />
            Flow Diagram
          </TabsTrigger>
        </TabsList>

        <TabsContent value="matrix" className="space-y-6 mt-6">
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-white">Allocation Matrix</CardTitle>
                  <CardDescription>
                    Click cells to view/edit allocations. Right-click to toggle assignments.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder="Search facilities or products..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 w-[300px]"
                    />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Alert className="mb-4 bg-blue-500/10 border-blue-500/20">
                <AlertCircle className="h-4 w-4 text-blue-400" />
                <AlertDescription className="text-blue-200">
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded bg-slate-700"></div>
                      <span className="text-xs">Unassigned</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded bg-blue-500/20 border border-blue-500/50"></div>
                      <span className="text-xs">Assigned (no data)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded bg-amber-500/20 border border-amber-500/50"></div>
                      <span className="text-xs">Partial/Pending</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded bg-green-500/20 border border-green-500/50"></div>
                      <span className="text-xs">Verified</span>
                    </div>
                  </div>
                </AlertDescription>
              </Alert>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-700">
                      <TableHead className="text-slate-400 sticky left-0 bg-slate-900 z-10">
                        Facility / Product
                      </TableHead>
                      {filteredProducts.map((product) => (
                        <TableHead key={product.id} className="text-slate-400 text-center min-w-[120px]">
                          <div className="flex flex-col items-center">
                            <span className="text-xs font-medium">{product.name}</span>
                            {product.sku && (
                              <span className="text-xs text-slate-500 font-mono">{product.sku}</span>
                            )}
                          </div>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredFacilities.map((facility) => (
                      <TableRow key={facility.id} className="border-slate-700">
                        <TableCell className="sticky left-0 bg-slate-900 z-10">
                          <div>
                            <p className="font-medium text-white">{facility.name}</p>
                            {facility.city && (
                              <p className="text-xs text-slate-400">
                                {facility.city}, {facility.country}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        {filteredProducts.map((product) => {
                          const cellStatus = getCellStatus(facility.id, product.id);
                          const key = `${facility.id}-${product.id}`;
                          const cell = matrixData.get(key);

                          return (
                            <TableCell
                              key={`${facility.id}-${product.id}`}
                              className="text-center p-2"
                            >
                              <div
                                className={`
                                  h-16 rounded-md border-2 flex items-center justify-center cursor-pointer
                                  transition-all hover:scale-105 hover:shadow-lg
                                  ${cellStatus.color}
                                `}
                                onClick={() => handleCellClick(facility.id, product.id)}
                                onContextMenu={(e) => {
                                  e.preventDefault();
                                  handleToggleAssignment(facility.id, product.id);
                                }}
                              >
                                <cellStatus.icon className="h-6 w-6 text-slate-300" />
                              </div>
                              {cell?.latestAllocation && (
                                <div className="text-xs text-slate-400 mt-1">
                                  {cell.latestAllocation.allocated_emissions.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg
                                </div>
                              )}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {facilities.length === 0 && products.length === 0 && (
                <div className="text-center py-12">
                  <Factory className="h-12 w-12 mx-auto mb-4 text-slate-600" />
                  <h4 className="text-lg font-medium text-white mb-2">Get Started</h4>
                  <p className="text-slate-400 mb-4">
                    Add facilities and products to start tracking production allocations
                  </p>
                  <div className="flex items-center justify-center gap-3">
                    <Button onClick={() => router.push("/company/facilities")} variant="outline">
                      <Building2 className="mr-2 h-4 w-4" />
                      Add Facility
                    </Button>
                    <Button onClick={() => router.push("/products")} variant="outline">
                      <Plus className="mr-2 h-4 w-4" />
                      Add Product
                    </Button>
                  </div>
                </div>
              )}

              {facilities.length === 0 && products.length > 0 && (
                <div className="text-center py-12">
                  <Factory className="h-12 w-12 mx-auto mb-4 text-slate-600" />
                  <h4 className="text-lg font-medium text-white mb-2">No Facilities Yet</h4>
                  <p className="text-slate-400 mb-4">
                    You have {products.length} product{products.length !== 1 ? "s" : ""} but no facilities.
                    Add facilities to start allocating production.
                  </p>
                  <Button onClick={() => router.push("/company/facilities")} variant="outline">
                    <Building2 className="mr-2 h-4 w-4" />
                    Add Your First Facility
                  </Button>
                </div>
              )}

              {facilities.length > 0 && products.length === 0 && (
                <div className="text-center py-12">
                  <Factory className="h-12 w-12 mx-auto mb-4 text-slate-600" />
                  <h4 className="text-lg font-medium text-white mb-2">No Products Yet</h4>
                  <p className="text-slate-400 mb-4">
                    You have {facilities.length} facilit{facilities.length !== 1 ? "ies" : "y"} but no products.
                    Add products to start allocating production.
                  </p>
                  <Button onClick={() => router.push("/products")} variant="outline">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Your First Product
                  </Button>
                </div>
              )}

              {facilities.length > 0 && products.length > 0 && filteredFacilities.length === 0 && (
                <div className="text-center py-12">
                  <Search className="h-12 w-12 mx-auto mb-4 text-slate-600" />
                  <p className="text-slate-400">No facilities found matching "{searchTerm}"</p>
                  <Button variant="ghost" className="mt-2" onClick={() => setSearchTerm("")}>
                    Clear Search
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timeline" className="space-y-6 mt-6">
          {organizationId ? (
            <ReportingPeriodTimeline organizationId={organizationId} viewType="all" />
          ) : (
            <Card className="bg-slate-900/50 border-slate-800">
              <CardContent className="py-12 text-center">
                <Calendar className="h-12 w-12 mx-auto mb-4 text-slate-600" />
                <p className="text-slate-400">Loading organization data...</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="flow" className="space-y-6 mt-6">
          {organizationId ? (
            <AllocationSankeyDiagram organizationId={organizationId} />
          ) : (
            <Card className="bg-slate-900/50 border-slate-800">
              <CardContent className="py-12 text-center">
                <TrendingUp className="h-12 w-12 mx-auto mb-4 text-slate-600" />
                <p className="text-slate-400">Loading organization data...</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
