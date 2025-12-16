import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

export interface ReportingSession {
  id: string;
  facility_id: string;
  organization_id: string;
  reporting_period_start: string;
  reporting_period_end: string;
  total_production_volume: number;
  volume_unit: string;
  data_source_type: string;
  facility_activity_type: string | null;
  fallback_intensity_factor: number | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export function useReportingSession(facilityId: string) {
  const [sessions, setSessions] = useState<ReportingSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSessions = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from("facility_reporting_sessions")
        .select("*")
        .eq("facility_id", facilityId)
        .order("created_at", { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      setSessions(data || []);
    } catch (err: any) {
      const errorMessage = err.message || "Failed to load reporting sessions";
      setError(errorMessage);
      setSessions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (facilityId) {
      loadSessions();
    }
  }, [facilityId]);

  return {
    sessions,
    loading,
    error,
    refetch: loadSessions,
  };
}
