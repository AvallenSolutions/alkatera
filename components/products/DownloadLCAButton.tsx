"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";

interface DownloadLCAButtonProps {
  lcaId: string;
  productName: string;
  size?: "default" | "sm" | "lg" | "icon";
  variant?: "default" | "outline" | "ghost";
}

export function DownloadLCAButton({
  lcaId,
  productName,
  size = "sm",
  variant = "outline",
}: DownloadLCAButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleDownload = async () => {
    try {
      setIsGenerating(true);

      const { data: lca, error: lcaError } = await supabase
        .from("product_lcas")
        .select(`
          *,
          product_lca_materials(
            material_name,
            quantity,
            unit,
            origin_country,
            is_organic_certified
          )
        `)
        .eq("id", lcaId)
        .single();

      if (lcaError) throw lcaError;

      const { data: calculationLog, error: logError } = await supabase
        .from("product_lca_calculation_logs")
        .select("response_data, created_at")
        .eq("product_lca_id", lcaId)
        .eq("status", "success")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (logError) throw logError;

      const reportData = {
        product: {
          name: lca.product_name,
          functional_unit: lca.functional_unit,
          system_boundary: lca.system_boundary,
        },
        results: calculationLog?.response_data || null,
        materials: lca.product_lca_materials || [],
        calculatedAt: calculationLog?.created_at || null,
        createdAt: lca.created_at,
      };

      const jsonBlob = new Blob([JSON.stringify(reportData, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(jsonBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${productName.replace(/[^a-z0-9]/gi, "_")}_LCA_${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success("LCA report downloaded");
    } catch (error: any) {
      console.error("Error downloading LCA:", error);
      toast.error("Failed to download LCA report");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleDownload}
      disabled={isGenerating}
    >
      <Download className="h-4 w-4 mr-2" />
      {isGenerating ? "Generating..." : "Download"}
    </Button>
  );
}
