"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Edit2,
  Factory,
  Loader2,
  MapPin,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";

interface FacilitiesTabProps {
  productId: number;
  organizationId: string;
}

interface Facility {
  id: string;
  name: string;
  operational_control: "owned" | "third_party";
  address_city: string | null;
  address_country: string | null;
}

interface ReportingSession {
  id: string;
  facility_id: string;
  reporting_period_start: string;
  reporting_period_end: string;
  total_production_volume: number;
  volume_unit: string;
  emission_intensity?: number;
}

interface FacilityAssignment {
  id: string;
  facility_id: string;
  facility: Facility;
  is_primary_facility: boolean;
  production_volume: number | null;
  production_volume_unit: string | null;
  reporting_session_id: string | null;
  // Computed from facility emissions
  allocated_emissions?: number;
  allocation_status: "pending" | "calculated" | "verified";
}

const VOLUME_UNITS = [
  { value: "units", label: "Units" },
  { value: "litres", label: "Litres" },
  { value: "kg", label: "Kilograms" },
  { value: "tonnes", label: "Tonnes" },
  { value: "bottles", label: "Bottles" },
  { value: "cases", label: "Cases" },
];

export function FacilitiesTab({ productId, organizationId }: FacilitiesTabProps) {
  const supabase = getSupabaseBrowserClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [assignments, setAssignments] = useState<FacilityAssignment[]>([]);
  const [reportingSessions, setReportingSessions] = useState<Record<string, ReportingSession[]>>({});

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedFacilityIds, setSelectedFacilityIds] = useState<string[]>([]);

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editVolume, setEditVolume] = useState<string>("");
  const [editUnit, setEditUnit] = useState<string>("units");
  const [editSessionId, setEditSessionId] = useState<string>("");

  useEffect(() => {
    loadData();
  }, [productId, organizationId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [facilitiesRes, assignmentsRes] = await Promise.all([
        // All facilities in the organization
        supabase
          .from("facilities")
          .select("id, name, operational_control, address_city, address_country")
          .eq("organization_id", organizationId),
        // Current facility assignments for this product
        supabase
          .from("facility_product_assignments")
          .select(`
            id,
            facility_id,
            is_primary_facility,
            production_volume,
            production_volume_unit,
            reporting_session_id,
            facilities (
              id,
              name,
              operational_control,
              address_city,
              address_country
            )
          `)
          .eq("product_id", productId)
          .eq("assignment_status", "active"),
      ]);

      if (facilitiesRes.data) setFacilities(facilitiesRes.data);

      if (assignmentsRes.data) {
        const assignmentsList: FacilityAssignment[] = assignmentsRes.data.map((a: any) => ({
          id: a.id,
          facility_id: a.facility_id,
          facility: a.facilities,
          is_primary_facility: a.is_primary_facility,
          production_volume: a.production_volume,
          production_volume_unit: a.production_volume_unit || "units",
          reporting_session_id: a.reporting_session_id,
          allocation_status: a.production_volume ? "calculated" as const : "pending" as const,
        }));
        setAssignments(assignmentsList);

        // Load reporting sessions for each assigned facility
        const facilityIds = assignmentsList.map((a: FacilityAssignment) => a.facility_id);
        if (facilityIds.length > 0) {
          const { data: sessions } = await supabase
            .from("facility_reporting_sessions")
            .select("id, facility_id, reporting_period_start, reporting_period_end, total_production_volume, volume_unit")
            .in("facility_id", facilityIds)
            .eq("status", "completed")
            .order("reporting_period_end", { ascending: false });

          if (sessions) {
            const sessionsByFacility: Record<string, ReportingSession[]> = {};
            for (const session of sessions) {
              if (!sessionsByFacility[session.facility_id]) {
                sessionsByFacility[session.facility_id] = [];
              }
              sessionsByFacility[session.facility_id].push(session);
            }
            setReportingSessions(sessionsByFacility);

            // Load emission intensities for each session
            await loadEmissionIntensities(assignmentsList, sessionsByFacility);
          }
        }
      }
    } catch (error) {
      console.error("Error loading facilities data:", error);
      toast.error("Failed to load facilities");
    } finally {
      setLoading(false);
    }
  };

  const loadEmissionIntensities = async (
    assignmentsList: FacilityAssignment[],
    sessionsByFacility: Record<string, ReportingSession[]>
  ) => {
    // Get emission data for facilities with reporting sessions
    const facilityIds = Object.keys(sessionsByFacility);
    if (facilityIds.length === 0) return;

    const { data: emissions } = await supabase
      .from("facility_emissions_aggregated")
      .select("facility_id, reporting_session_id, calculated_intensity")
      .in("facility_id", facilityIds);

    if (!emissions) return;

    // Map intensities to sessions
    const intensityMap: Record<string, number> = {};
    for (const e of emissions) {
      if (e.reporting_session_id && e.calculated_intensity) {
        intensityMap[e.reporting_session_id] = e.calculated_intensity;
      }
    }

    // Update sessions with intensities
    const updatedSessions = { ...sessionsByFacility };
    for (const facilityId of Object.keys(updatedSessions)) {
      updatedSessions[facilityId] = updatedSessions[facilityId].map((s) => ({
        ...s,
        emission_intensity: intensityMap[s.id] || 0,
      }));
    }
    setReportingSessions(updatedSessions);

    // Calculate allocated emissions for each assignment
    const updatedAssignments = assignmentsList.map((a) => {
      if (a.reporting_session_id && a.production_volume) {
        const session = updatedSessions[a.facility_id]?.find((s) => s.id === a.reporting_session_id);
        const intensity = session?.emission_intensity || 0;
        return {
          ...a,
          allocated_emissions: intensity * a.production_volume,
          allocation_status: intensity > 0 ? "verified" as const : "calculated" as const,
        };
      }
      return a;
    });
    setAssignments(updatedAssignments);
  };

  const handleAddFacilities = () => {
    setSelectedFacilityIds(assignments.map((a) => a.facility_id));
    setDialogOpen(true);
  };

  const handleToggleFacility = (facilityId: string) => {
    setSelectedFacilityIds((prev) =>
      prev.includes(facilityId)
        ? prev.filter((id) => id !== facilityId)
        : [...prev, facilityId]
    );
  };

  const handleSaveAssignments = async () => {
    setSaving(true);
    try {
      const currentAssignedIds = assignments.map((a) => a.facility_id);

      const response = await fetch("/api/facility-assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          productId,
          selectedFacilityIds,
          currentAssignedIds,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to save facility assignments");
      }

      toast.success("Facilities updated");
      setDialogOpen(false);
      loadData();
    } catch (error: any) {
      console.error("Error saving facility assignments:", error);
      toast.error(error.message || "Failed to update facilities");
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveFacility = async (assignmentId: string) => {
    try {
      const { error } = await supabase
        .from("facility_product_assignments")
        .update({ assignment_status: "archived" })
        .eq("id", assignmentId);

      if (error) throw new Error(error.message || "Database error");

      toast.success("Facility removed");
      loadData();
    } catch (error: any) {
      console.error("Error removing facility:", error);
      toast.error(error.message || "Failed to remove facility");
    }
  };

  const handleStartEdit = (assignment: FacilityAssignment) => {
    setEditingId(assignment.id);
    setEditVolume(assignment.production_volume?.toString() || "");
    setEditUnit(assignment.production_volume_unit || "units");
    setEditSessionId(assignment.reporting_session_id || "");
  };

  const handleSaveVolume = async (assignmentId: string) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("facility_product_assignments")
        .update({
          production_volume: editVolume ? parseFloat(editVolume) : null,
          production_volume_unit: editUnit,
          reporting_session_id: editSessionId || null,
        })
        .eq("id", assignmentId);

      if (error) throw error;

      toast.success("Production volume saved");
      setEditingId(null);
      loadData();
    } catch (error) {
      console.error("Error saving volume:", error);
      toast.error("Failed to save production volume");
    } finally {
      setSaving(false);
    }
  };

  const totalAllocatedEmissions = assignments.reduce(
    (sum, a) => sum + (a.allocated_emissions || 0),
    0
  );

  const allHaveVolumes = assignments.every((a) => a.production_volume && a.production_volume > 0);
  const allVerified = assignments.every((a) => a.allocation_status === "verified");

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-lime-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Manufacturing Facilities</h3>
          <p className="text-sm text-slate-400">
            Facilities where this product is manufactured
          </p>
        </div>
        <Button onClick={handleAddFacilities} className="bg-lime-500 hover:bg-lime-600 text-black">
          <Plus className="mr-2 h-4 w-4" />
          {assignments.length > 0 ? "Edit Facilities" : "Add Facility"}
        </Button>
      </div>

      {/* Empty State */}
      {assignments.length === 0 ? (
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="py-12 text-center">
            <Factory className="h-12 w-12 mx-auto mb-4 text-slate-600" />
            <h4 className="text-lg font-medium text-white mb-2">No Facilities Assigned</h4>
            <p className="text-sm text-slate-400 mb-4">
              Link facilities to this product to track manufacturing emissions
            </p>
            <Button onClick={handleAddFacilities} variant="outline">
              <Plus className="mr-2 h-4 w-4" />
              Add First Facility
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-slate-900/50 border-slate-800">
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-xs text-slate-400 uppercase tracking-wider">Allocations</p>
                  <p className="text-3xl font-bold text-white mt-1">{assignments.length}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-slate-900/50 border-slate-800">
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-xs text-slate-400 uppercase tracking-wider">Allocated CO₂e</p>
                  <p className="text-3xl font-bold text-lime-400 mt-1">
                    {totalAllocatedEmissions > 0
                      ? totalAllocatedEmissions.toLocaleString(undefined, { maximumFractionDigits: 0 })
                      : "—"}
                  </p>
                  <p className="text-xs text-slate-500">kg CO₂e</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-slate-900/50 border-slate-800">
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-xs text-slate-400 uppercase tracking-wider">Status</p>
                  <div className="mt-2">
                    {!allHaveVolumes ? (
                      <Badge className="bg-amber-500/20 text-amber-300">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Missing Data
                      </Badge>
                    ) : allVerified ? (
                      <Badge className="bg-lime-500/20 text-lime-300">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        All Verified
                      </Badge>
                    ) : (
                      <Badge className="bg-blue-500/20 text-blue-300">Calculated</Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Facility List */}
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white">Linked Facilities</CardTitle>
              <CardDescription>
                Enter production volume for each facility to calculate allocated emissions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {assignments.map((assignment) => {
                const isEditing = editingId === assignment.id;
                const sessions = reportingSessions[assignment.facility_id] || [];

                return (
                  <div
                    key={assignment.id}
                    className="p-4 rounded-lg bg-slate-800/50 border border-slate-700"
                  >
                    {/* Facility Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        {assignment.facility.operational_control === "owned" ? (
                          <div className="h-10 w-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                            <Building2 className="h-5 w-5 text-blue-400" />
                          </div>
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                            <Users className="h-5 w-5 text-amber-400" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-white">{assignment.facility.name}</p>
                          {assignment.facility.address_city && (
                            <p className="text-sm text-slate-400 flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {assignment.facility.address_city}, {assignment.facility.address_country}
                            </p>
                          )}
                        </div>
                        <Badge variant="outline" className="ml-2">
                          {assignment.facility.operational_control === "owned" ? "Owned" : "Third Party"}
                        </Badge>
                        {assignment.is_primary_facility && (
                          <Badge className="bg-lime-500/20 text-lime-300">Primary</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {!isEditing && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleStartEdit(assignment)}
                            className="text-slate-400 hover:text-white"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveFacility(assignment.id)}
                          className="text-slate-400 hover:text-red-400"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Production Volume Entry */}
                    {isEditing ? (
                      <div className="space-y-4 bg-slate-900/50 p-4 rounded-lg">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <Label className="text-slate-300">Production Volume</Label>
                            <Input
                              type="number"
                              value={editVolume}
                              onChange={(e) => setEditVolume(e.target.value)}
                              placeholder="Enter volume"
                              className="bg-slate-800 border-slate-700"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-slate-300">Unit</Label>
                            <Select value={editUnit} onValueChange={setEditUnit}>
                              <SelectTrigger className="bg-slate-800 border-slate-700">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {VOLUME_UNITS.map((unit) => (
                                  <SelectItem key={unit.value} value={unit.value}>
                                    {unit.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-slate-300">Reporting Period</Label>
                            <Select value={editSessionId} onValueChange={setEditSessionId}>
                              <SelectTrigger className="bg-slate-800 border-slate-700">
                                <SelectValue placeholder="Select period" />
                              </SelectTrigger>
                              <SelectContent>
                                {sessions.length === 0 ? (
                                  <SelectItem value="none" disabled>
                                    No reporting sessions available
                                  </SelectItem>
                                ) : (
                                  sessions.map((session) => (
                                    <SelectItem key={session.id} value={session.id}>
                                      {new Date(session.reporting_period_start).getFullYear()} -{" "}
                                      {new Date(session.reporting_period_end).getFullYear()}
                                      {session.emission_intensity
                                        ? ` (${session.emission_intensity.toFixed(2)} kg/unit)`
                                        : ""}
                                    </SelectItem>
                                  ))
                                )}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingId(null)}
                            disabled={saving}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleSaveVolume(assignment.id)}
                            disabled={saving}
                            className="bg-lime-500 hover:bg-lime-600 text-black"
                          >
                            {saving ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              "Save"
                            )}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-slate-400">Production</p>
                          <p className="text-white font-medium">
                            {assignment.production_volume
                              ? `${assignment.production_volume.toLocaleString()} ${assignment.production_volume_unit}`
                              : "—"}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-400">Period</p>
                          <p className="text-white font-medium">
                            {assignment.reporting_session_id
                              ? sessions.find((s) => s.id === assignment.reporting_session_id)
                                ? `${new Date(
                                    sessions.find((s) => s.id === assignment.reporting_session_id)!
                                      .reporting_period_start
                                  ).getFullYear()}`
                                : "Selected"
                              : "—"}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-400">Allocated CO₂e</p>
                          <p className="text-lime-400 font-medium">
                            {assignment.allocated_emissions
                              ? `${assignment.allocated_emissions.toLocaleString(undefined, {
                                  maximumFractionDigits: 0,
                                })} kg`
                              : "—"}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-400">Status</p>
                          {!assignment.production_volume ? (
                            <Badge className="bg-amber-500/20 text-amber-300">Missing</Badge>
                          ) : assignment.allocation_status === "verified" ? (
                            <Badge className="bg-lime-500/20 text-lime-300">Verified</Badge>
                          ) : (
                            <Badge className="bg-blue-500/20 text-blue-300">Calculated</Badge>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </>
      )}

      {/* Facility Selection Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Select Facilities</DialogTitle>
            <DialogDescription>
              Choose which facilities manufacture this product.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4 max-h-96 overflow-y-auto">
            {facilities.length === 0 ? (
              <div className="text-center py-8">
                <Factory className="h-12 w-12 mx-auto mb-4 text-slate-600" />
                <p className="text-sm text-slate-400">
                  No facilities found. Add facilities in Company &gt; Facilities first.
                </p>
              </div>
            ) : (
              facilities.map((facility) => (
                <div
                  key={facility.id}
                  className={`flex items-center gap-4 p-4 rounded-lg border cursor-pointer transition-all ${
                    selectedFacilityIds.includes(facility.id)
                      ? "bg-lime-500/10 border-lime-500/50"
                      : "bg-slate-800/50 border-slate-700 hover:border-slate-600"
                  }`}
                  onClick={() => handleToggleFacility(facility.id)}
                >
                  <Checkbox
                    checked={selectedFacilityIds.includes(facility.id)}
                    onCheckedChange={() => handleToggleFacility(facility.id)}
                  />
                  <div className="flex items-center gap-3 flex-1">
                    {facility.operational_control === "owned" ? (
                      <Building2 className="h-5 w-5 text-blue-400" />
                    ) : (
                      <Users className="h-5 w-5 text-amber-400" />
                    )}
                    <div>
                      <p className="font-medium text-white">{facility.name}</p>
                      <div className="flex items-center gap-2 text-sm text-slate-400">
                        {facility.address_city && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {facility.address_city}
                          </span>
                        )}
                        <Badge variant="outline" className="text-xs">
                          {facility.operational_control === "owned" ? "Owned" : "Third Party"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
            <Button variant="ghost" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveAssignments}
              disabled={saving || facilities.length === 0}
              className="bg-lime-500 hover:bg-lime-600 text-black"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>Save ({selectedFacilityIds.length} selected)</>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
