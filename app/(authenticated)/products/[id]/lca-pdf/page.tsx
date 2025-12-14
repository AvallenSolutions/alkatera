"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import { AlkaTeraProductLCA } from "@/components/lca-report";
import { transformLCADataForReport } from "@/lib/utils/lca-report-transformer";
import type { LCAReportData } from "@/components/lca-report/types";

export default function LCAPDFPage() {
  const params = useParams();
  const productId = params.id as string;
  const [reportData, setReportData] = useState<LCAReportData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchLCAData() {
      try {
        const supabase = getSupabaseBrowserClient();

        // Fetch the latest completed LCA for this product
        const { data: lca, error: lcaError } = await supabase
          .from('product_lcas')
          .select('*')
          .eq('product_id', productId)
          .eq('status', 'completed')
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (lcaError || !lca) {
          setError("LCA not found");
          return;
        }

        // Fetch materials for this LCA
        const { data: materials } = await supabase
          .from('product_lca_materials')
          .select('*')
          .eq('product_lca_id', lca.id);

        if (materials) {
          lca.materials = materials;
        }

        // Fetch organization
        const { data: organization } = await supabase
          .from('organizations')
          .select('name')
          .eq('id', lca.organization_id)
          .maybeSingle();

        const transformed = transformLCADataForReport(
          lca,
          null,
          organization
        );

        setReportData(transformed);
      } catch (err) {
        console.error("Error loading report data:", err);
        setError("Failed to load report data");
      }
    }

    if (productId) {
      fetchLCAData();
    }
  }, [productId]);

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
