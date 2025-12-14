"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Download, ShieldAlert, Lock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import { useAllocationStatus } from "@/hooks/data/useAllocationStatus";
import { useReportLimit } from "@/hooks/useSubscription";
import { UpgradePromptModal } from "@/components/subscription";
import { generateEnhancedLcaPdf } from "@/lib/enhanced-pdf-generator";

interface DownloadLCAButtonProps {
  lcaId: string;
  productName: string;
  productId?: number;
  size?: "default" | "sm" | "lg" | "icon";
  variant?: "default" | "outline" | "ghost";
  allowProvisional?: boolean;
}

export function DownloadLCAButton({
  lcaId,
  productName,
  productId,
  size = "sm",
  variant = "outline",
  allowProvisional = false,
}: DownloadLCAButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const allocationStatus = useAllocationStatus(productId || null);
  const { currentCount, maxCount, isUnlimited, checkLimit } = useReportLimit();

  const isBlocked = !allowProvisional && allocationStatus.hasProvisionalAllocations;
  const isAtReportLimit = !isUnlimited && maxCount !== null && maxCount !== undefined && currentCount >= maxCount;

  const handleDownload = async () => {
    if (isBlocked) {
      toast.error(
        "Cannot generate final report: This product has provisional allocations pending verification"
      );
      return;
    }

    const limitCheck = await checkLimit();
    if (!limitCheck.allowed) {
      setShowUpgradeModal(true);
      toast.error(limitCheck.reason || "Monthly report limit reached");
      return;
    }

    try {
      setIsGenerating(true);
      toast.info("Generating PDF report...");

      const { data: lca, error: lcaError } = await supabase
        .from("product_lcas")
        .select("*")
        .eq("id", lcaId)
        .single();

      if (lcaError) throw lcaError;

      const { data: org } = await supabase
        .from("organizations")
        .select("name")
        .eq("id", lca.organization_id)
        .maybeSingle();

      // Extract aggregated impacts
      const impacts = lca.aggregated_impacts || {};
      const dataQuality = impacts.data_quality || {};
      const dataProvenance = impacts.data_provenance || {};
      const breakdown = impacts.breakdown || {};

      // Transform to PDF format
      const pdfData = {
        productName: lca.product_name || productName,
        version: lca.lca_version || "1.0",
        assessmentPeriod: `${lca.reference_year || new Date().getFullYear()}`,
        publishedDate: new Date(lca.updated_at || lca.created_at).toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        }),
        functionalUnit: lca.functional_unit || `1 unit of ${productName}`,
        systemBoundary: lca.system_boundary || "cradle-to-gate",
        metrics: {
          climate_change_gwp100: impacts.climate_change_gwp100 || 0,
          water_consumption: impacts.water_consumption || 0,
          land_use: impacts.land_use || 0,
          circularity_percentage: impacts.circularity_percentage || 0,
        },
        dataQuality: {
          averageConfidence: dataQuality.score || 0,
          rating: dataQuality.rating || "Unknown",
          highQualityCount: dataQuality.breakdown?.primary_verified_count || 0,
          mediumQualityCount: dataQuality.breakdown?.regional_standard_count || 0,
          lowQualityCount: dataQuality.breakdown?.secondary_modelled_count || 0,
          totalMaterialsCount: dataQuality.total_materials || 0,
        },
        dataProvenance: {
          hybridSourcesCount: dataProvenance.hybrid_sources_count || 0,
          defraGwpCount: dataProvenance.defra_gwp_count || 0,
          supplierVerifiedCount: dataProvenance.supplier_verified_count || 0,
          ecoinventOnlyCount: dataProvenance.ecoinvent_only_count || 0,
          methodologySummary: dataProvenance.methodology_summary || "Mixed sources",
        },
        ghgBreakdown: {
          co2Fossil: impacts.climate_fossil || 0,
          co2Biogenic: impacts.climate_biogenic || 0,
          co2Dluc: impacts.climate_dluc || 0,
        },
        complianceFramework: {
          standards: ["ISO 14044", "ISO 14067", "GHG Protocol Product Standard"],
          certifications: [],
        },
      };

      // Generate and download PDF
      await generateEnhancedLcaPdf(pdfData);

      // Increment report count
      if (lca.organization_id) {
        await supabase.rpc("increment_report_count", {
          p_organization_id: lca.organization_id,
        });
      }

      toast.success("PDF report downloaded successfully");
    } catch (error: any) {
      console.error("Error generating PDF:", error);
      toast.error("Failed to generate PDF report");
    } finally {
      setIsGenerating(false);
    }
  };

  if (isBlocked) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button
                variant={variant}
                size={size}
                disabled
                className="opacity-50 cursor-not-allowed"
              >
                <ShieldAlert className="h-4 w-4 mr-2 text-amber-400" />
                Blocked
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <p>
              Final report generation is blocked because this product has{" "}
              <strong>{allocationStatus.provisionalCount}</strong> provisional
              allocation(s) pending verification.
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (isAtReportLimit) {
    return (
      <>
        <UpgradePromptModal
          open={showUpgradeModal}
          onOpenChange={setShowUpgradeModal}
          limitType="reports"
        />
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button
                  variant={variant}
                  size={size}
                  onClick={() => setShowUpgradeModal(true)}
                  className="border-amber-500/50"
                >
                  <Lock className="h-4 w-4 mr-2 text-amber-500" />
                  Upgrade
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p>
                Monthly report limit reached ({currentCount}/{maxCount}).
                Upgrade to generate more reports.
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </>
    );
  }

  return (
    <>
      <UpgradePromptModal
        open={showUpgradeModal}
        onOpenChange={setShowUpgradeModal}
        limitType="reports"
      />
      <Button
        variant={variant}
        size={size}
        onClick={handleDownload}
        disabled={isGenerating || allocationStatus.loading}
      >
        <Download className="h-4 w-4 mr-2" />
        {isGenerating ? "Generating..." : "Download"}
      </Button>
    </>
  );
}
