"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Plus } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ActivityDataTable } from "@/components/facilities/ActivityDataTable";
import { AddActivityDataModal } from "@/components/facilities/AddActivityDataModal";

interface Facility {
  id: string;
  name: string;
  location: string;
  facility_type: string;
  organization_id: string;
}

interface EmissionSource {
  id: string;
  source_name: string;
  scope: string;
  category: string;
  default_unit: string;
}

interface ActivityData {
  id: string;
  emission_source_id: string;
  quantity: number;
  unit: string;
  reporting_period_start: string;
  reporting_period_end: string;
  created_at: string;
  scope_1_2_emission_sources: {
    source_name: string;
    scope: string;
    category: string;
  };
}

export default function FacilityDetailPage() {
  const params = useParams();
  const facilityId = params.facilityId as string;

  const [facility, setFacility] = useState<Facility | null>(null);
  const [scope1Sources, setScope1Sources] = useState<EmissionSource[]>([]);
  const [scope2Sources, setScope2Sources] = useState<EmissionSource[]>([]);
  const [scope1Data, setScope1Data] = useState<ActivityData[]>([]);
  const [scope2Data, setScope2Data] = useState<ActivityData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isScope1ModalOpen, setIsScope1ModalOpen] = useState(false);
  const [isScope2ModalOpen, setIsScope2ModalOpen] = useState(false);

  useEffect(() => {
    fetchFacilityData();
    fetchEmissionSources();
  }, [facilityId]);

  useEffect(() => {
    if (facilityId) {
      fetchActivityData();
    }
  }, [facilityId]);

  const fetchFacilityData = async () => {
    try {
      const { data, error } = await supabase
        .from("facilities")
        .select("*")
        .eq("id", facilityId)
        .single();

      if (error) throw error;
      setFacility(data);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const fetchEmissionSources = async () => {
    try {
      const { data, error } = await supabase
        .from("scope_1_2_emission_sources")
        .select("*")
        .order("scope", { ascending: true })
        .order("category", { ascending: true });

      if (error) throw error;

      const scope1 = data.filter((s) => s.scope === "Scope 1");
      const scope2 = data.filter((s) => s.scope === "Scope 2");

      setScope1Sources(scope1);
      setScope2Sources(scope2);
    } catch (err: any) {
      console.error("Error fetching emission sources:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchActivityData = async () => {
    try {
      const { data, error } = await supabase
        .from("facility_activity_data")
        .select(`
          *,
          scope_1_2_emission_sources (
            source_name,
            scope,
            category
          )
        `)
        .eq("facility_id", facilityId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const scope1 = data.filter((d) => d.scope_1_2_emission_sources.scope === "Scope 1");
      const scope2 = data.filter((d) => d.scope_1_2_emission_sources.scope === "Scope 2");

      setScope1Data(scope1);
      setScope2Data(scope2);
    } catch (err: any) {
      console.error("Error fetching activity data:", err);
    }
  };

  const handleDataAdded = () => {
    fetchActivityData();
    setIsScope1ModalOpen(false);
    setIsScope2ModalOpen(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!facility) {
    return (
      <div className="container mx-auto p-6">
        <Alert>
          <AlertDescription>Facility not found</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{facility.name}</h1>
        <p className="text-muted-foreground mt-1">
          {facility.location} • {facility.facility_type}
        </p>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="scope1">Scope 1 Emissions</TabsTrigger>
          <TabsTrigger value="scope2">Scope 2 Emissions</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Facility Information</CardTitle>
              <CardDescription>Basic details about this facility</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Name</label>
                <p className="text-sm text-muted-foreground">{facility.name}</p>
              </div>
              <div>
                <label className="text-sm font-medium">Location</label>
                <p className="text-sm text-muted-foreground">{facility.location}</p>
              </div>
              <div>
                <label className="text-sm font-medium">Type</label>
                <p className="text-sm text-muted-foreground">{facility.facility_type}</p>
              </div>
              <div>
                <label className="text-sm font-medium">Data Points</label>
                <p className="text-sm text-muted-foreground">
                  Scope 1: {scope1Data.length} entries • Scope 2: {scope2Data.length} entries
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scope1" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Scope 1 Emissions Data</CardTitle>
                  <CardDescription>
                    Direct emissions from sources owned or controlled by your organisation
                  </CardDescription>
                </div>
                <Button onClick={() => setIsScope1ModalOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Data
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <ActivityDataTable data={scope1Data} onRefresh={fetchActivityData} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scope2" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Scope 2 Emissions Data</CardTitle>
                  <CardDescription>
                    Indirect emissions from purchased energy
                  </CardDescription>
                </div>
                <Button onClick={() => setIsScope2ModalOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Data
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <ActivityDataTable data={scope2Data} onRefresh={fetchActivityData} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AddActivityDataModal
        open={isScope1ModalOpen}
        onOpenChange={setIsScope1ModalOpen}
        facilityId={facilityId}
        scope="Scope 1"
        emissionSources={scope1Sources}
        onSuccess={handleDataAdded}
      />

      <AddActivityDataModal
        open={isScope2ModalOpen}
        onOpenChange={setIsScope2ModalOpen}
        facilityId={facilityId}
        scope="Scope 2"
        emissionSources={scope2Sources}
        onSuccess={handleDataAdded}
      />
    </div>
  );
}
