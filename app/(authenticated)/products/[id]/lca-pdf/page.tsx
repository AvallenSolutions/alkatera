"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlkaTeraProductLCA } from "@/components/lca-report";
import { transformLCADataForReport } from "@/lib/utils/lca-report-transformer";
import type { LCAReportData } from "@/components/lca-report/types";

export default function LCAPDFPage() {
  const searchParams = useSearchParams();
  const [reportData, setReportData] = useState<LCAReportData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const dataParam = searchParams.get("data");
      if (!dataParam) {
        setError("No data provided");
        return;
      }

      const decoded = JSON.parse(decodeURIComponent(dataParam));
      const transformed = transformLCADataForReport(
        decoded.lca,
        decoded.calculationLog,
        decoded.organization
      );

      setReportData(transformed);
    } catch (err) {
      console.error("Error loading report data:", err);
      setError("Failed to load report data");
    }
  }, [searchParams]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-100">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-2">Error</h1>
          <p className="text-neutral-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!reportData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-neutral-900 mx-auto mb-4"></div>
          <p className="text-neutral-600">Loading report...</p>
        </div>
      </div>
    );
  }

  return <AlkaTeraProductLCA data={reportData} />;
}
