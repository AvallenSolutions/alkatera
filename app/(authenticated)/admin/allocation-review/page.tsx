"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Factory,
  FileText,
  MapPin,
  RefreshCw,
  ShieldCheck,
  X,
  Zap,
} from "lucide-react";
import { Eyebrow } from "@/components/studio/eyebrow";
import { BigNumber } from "@/components/studio/big-number";
import { StateChip } from "@/components/studio/state-chip";
import { toast } from "sonner";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import { useOrganization } from "@/lib/organizationContext";
import { format, formatDistanceToNow } from "date-fns";

interface Allocation {
  id: string;
  organization_id: string;
  product_id: number;
  product_name: string;
  facility_id: string;
  facility_name: string;
  facility_city: string | null;
  facility_country: string | null;
  supplier_id: string | null;
  supplier_name: string | null;
  reporting_period_start: string;
  reporting_period_end: string;
  total_facility_production_volume: number;
  production_volume_unit: string;
  total_facility_co2e_kg: number;
  co2e_entry_method: string;
  client_production_volume: number;
  attribution_ratio: number;
  allocated_emissions_kg_co2e: number;
  emission_intensity_kg_co2e_per_unit: number;
  status: string;
  is_energy_intensive_process: boolean;
  energy_intensive_notes?: string;
  data_source_tag: string;
  data_quality_score: number | null;
  created_at: string;
  days_pending: number | null;
}

interface EnergyInput {
  id: string;
  fuel_type: string;
  consumption_value: number;
  consumption_unit: string;
  emission_factor_used: number;
  emission_factor_year: number;
  emission_factor_source: string;
  calculated_co2e_kg: number;
}

export default function AllocationReviewPage() {
  const router = useRouter();
  const { currentOrganization } = useOrganization();
  const supabase = getSupabaseBrowserClient();

  const [loading, setLoading] = useState(true);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("provisional");

  const [selectedAllocation, setSelectedAllocation] = useState<Allocation | null>(null);
  const [energyInputs, setEnergyInputs] = useState<EnergyInput[]>([]);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showApproveDialog, setShowApproveDialog] = useState(false);

  const [verificationNotes, setVerificationNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (currentOrganization?.id) {
      loadAllocations();
    }
  }, [currentOrganization?.id, statusFilter]);

  const loadAllocations = async () => {
    if (!currentOrganization?.id) return;

    setLoading(true);
    try {
      let query = supabase
        .from("contract_manufacturer_allocation_summary")
        .select("*")
        .eq("organization_id", currentOrganization.id)
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setAllocations(data || []);
    } catch (error) {
      console.error("Error loading allocations:", error);
      toast.error("Failed to load allocations");
    } finally {
      setLoading(false);
    }
  };

  const loadAllocationDetails = async (allocation: Allocation) => {
    setSelectedAllocation(allocation);

    if (allocation.co2e_entry_method === "calculated_from_energy") {
      const { data } = await supabase
        .from("contract_manufacturer_energy_inputs")
        .select("*")
        .eq("allocation_id", allocation.id);

      setEnergyInputs(data || []);
    } else {
      setEnergyInputs([]);
    }

    setShowDetailDialog(true);
  };

  const handleApprove = async () => {
    if (!selectedAllocation) return;

    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await (supabase
        .from("contract_manufacturer_allocations") as any)
        .update({
          status: "verified",
          verified_by: user?.id ?? null,
          verified_at: new Date().toISOString(),
          verification_notes: verificationNotes || null,
        })
        .eq("id", selectedAllocation.id);

      if (error) throw error;

      toast.success("Allocation verified successfully");
      setShowApproveDialog(false);
      setShowDetailDialog(false);
      setVerificationNotes("");
      loadAllocations();
    } catch (error: any) {
      console.error("Error verifying allocation:", error);
      toast.error(error.message || "Failed to verify allocation");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!selectedAllocation || !verificationNotes.trim()) {
      toast.error("Please provide a reason for rejection");
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await (supabase
        .from("contract_manufacturer_allocations") as any)
        .update({
          status: "draft",
          verified_by: user?.id ?? null,
          verified_at: new Date().toISOString(),
          verification_notes: `REJECTED: ${verificationNotes}`,
        })
        .eq("id", selectedAllocation.id);

      if (error) throw error;

      toast.success("Allocation returned for revision");
      setShowApproveDialog(false);
      setShowDetailDialog(false);
      setVerificationNotes("");
      loadAllocations();
    } catch (error: any) {
      console.error("Error rejecting allocation:", error);
      toast.error(error.message || "Failed to reject allocation");
    } finally {
      setIsSubmitting(false);
    }
  };

  const provisionalCount = allocations.filter((a) => a.status === "provisional").length;

  return (
    <div className="min-h-screen">
      <div className="container mx-auto px-6 py-6">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => router.back()}
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </div>

        <div className="flex items-center justify-between mb-8">
          <div>
            <Eyebrow tone="dim" className="mb-3">THE WIRING · ADMIN</Eyebrow>
            <h1 className="font-display text-3xl font-bold tracking-[-0.035em] text-foreground">
              Allocation review.
            </h1>
            <p className="text-muted-foreground mt-2">
              Review and verify contract manufacturer emissions allocations
            </p>
          </div>
          <Button variant="outline" onClick={loadAllocations} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <BigNumber value={provisionalCount} label="Pending review" tone="attention" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <BigNumber
                value={allocations.filter((a) => a.status === "verified").length}
                label="Verified"
                tone="good"
              />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <BigNumber
                value={allocations.filter((a) => a.status === "approved").length}
                label="Approved"
              />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <BigNumber value={allocations.length} label="Total allocations" />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Allocations</CardTitle>
                <CardDescription>
                  Contract manufacturer emissions allocations requiring review
                </CardDescription>
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="provisional">Provisional</SelectItem>
                  <SelectItem value="verified">Verified</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="all">All</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <p className="text-sm text-muted-foreground">Loading…</p>
              </div>
            ) : allocations.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p>No allocations found with the selected status</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Facility</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead className="text-right">Allocated CO2e</TableHead>
                    <TableHead>Flags</TableHead>
                    <TableHead>Days Pending</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allocations.map((allocation) => (
                    <TableRow key={allocation.id}>
                      <TableCell>
                        <p className="font-medium text-foreground">{allocation.product_name}</p>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Factory className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-foreground">{allocation.facility_name}</p>
                            {allocation.facility_city && (
                              <p className="text-xs text-muted-foreground">
                                {allocation.facility_city}, {allocation.facility_country}
                              </p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {format(new Date(allocation.reporting_period_start), "MMM yyyy")} -{" "}
                          {format(new Date(allocation.reporting_period_end), "MMM yyyy")}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-mono text-foreground tabular-nums">
                          {allocation.allocated_emissions_kg_co2e?.toLocaleString(undefined, {
                            maximumFractionDigits: 0,
                          })}{" "}
                          kg
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {allocation.is_energy_intensive_process && (
                            <StateChip tone="attention">Energy intensive</StateChip>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {allocation.days_pending !== null && allocation.status === "provisional" ? (
                          <span className={`text-sm ${allocation.days_pending > 14 ? "text-studio-stale" : "text-muted-foreground"}`}>
                            {allocation.days_pending} days
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => loadAllocationDetails(allocation)}
                        >
                          Review
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Allocation Details</DialogTitle>
            <DialogDescription>
              Review the calculation methodology and data inputs
            </DialogDescription>
          </DialogHeader>

          {selectedAllocation && (
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-xs text-muted-foreground">Product</p>
                    <p className="text-lg font-semibold text-foreground">{selectedAllocation.product_name}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-xs text-muted-foreground">Facility</p>
                    <p className="text-lg font-semibold text-foreground">{selectedAllocation.facility_name}</p>
                    {selectedAllocation.facility_city && (
                      <p className="text-sm text-muted-foreground">
                        {selectedAllocation.facility_city}, {selectedAllocation.facility_country}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">Calculation Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-4 gap-4">
                    <BigNumber
                      value={`${selectedAllocation.total_facility_co2e_kg?.toLocaleString()} kg`}
                      label="Total facility CO2e"
                    />
                    <BigNumber
                      value={`${(selectedAllocation.attribution_ratio * 100).toFixed(2)}%`}
                      label="Attribution ratio"
                    />
                    <BigNumber
                      value={`${selectedAllocation.allocated_emissions_kg_co2e?.toLocaleString()} kg`}
                      label="Allocated emissions"
                    />
                    <BigNumber
                      value={selectedAllocation.emission_intensity_kg_co2e_per_unit?.toFixed(4)}
                      label="Intensity"
                    />
                  </div>
                </CardContent>
              </Card>

              {selectedAllocation.is_energy_intensive_process && (
                <Alert>
                  <Zap className="h-4 w-4 text-studio-attention" />
                  <AlertDescription>
                    <strong>Energy Intensive Process Flagged</strong>
                    <p className="mt-1">{selectedAllocation.energy_intensive_notes || "No additional notes provided"}</p>
                  </AlertDescription>
                </Alert>
              )}

              {energyInputs.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Energy Inputs (Raw Data)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Fuel Type</TableHead>
                          <TableHead className="text-right">Consumption</TableHead>
                          <TableHead className="text-right">Factor</TableHead>
                          <TableHead className="text-right">CO2e</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {energyInputs.map((input) => (
                          <TableRow key={input.id}>
                            <TableCell className="text-foreground">{input.fuel_type}</TableCell>
                            <TableCell className="text-right font-mono text-muted-foreground">
                              {input.consumption_value.toLocaleString()} {input.consumption_unit}
                            </TableCell>
                            <TableCell className="text-right font-mono text-muted-foreground">
                              {input.emission_factor_used} ({input.emission_factor_source} {input.emission_factor_year})
                            </TableCell>
                            <TableCell className="text-right font-mono text-foreground">
                              {input.calculated_co2e_kg.toLocaleString()} kg
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

              {selectedAllocation.status === "provisional" && (
                <div className="flex justify-end gap-3 pt-4 border-t border-border">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowApproveDialog(true);
                    }}
                  >
                    Review & Verify
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Verify Allocation</DialogTitle>
            <DialogDescription>
              Confirm this allocation is valid and accurate
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label>Verification Notes (Optional)</Label>
              <Textarea
                placeholder="Add any notes about this verification..."
                value={verificationNotes}
                onChange={(e) => setVerificationNotes(e.target.value)}
                className="mt-2"
              />
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={isSubmitting}
            >
              <X className="mr-2 h-4 w-4" />
              Return for Revision
            </Button>
            <Button onClick={handleApprove} disabled={isSubmitting}>
              {!isSubmitting && <Check className="mr-2 h-4 w-4" />}
              {isSubmitting ? "Verifying…" : "Verify Allocation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
