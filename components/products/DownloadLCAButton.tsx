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

      const { data: org } = await supabase
        .from("organizations")
        .select("name")
        .eq("id", lca.organization_id)
        .maybeSingle();

      const reportData = {
        lca,
        calculationLog,
        organization: org,
      };

      const dataStr = encodeURIComponent(JSON.stringify(reportData));
      const newWindow = window.open(
        `/products/${productId}/lca-pdf?data=${dataStr}`,
        '_blank',
        'width=1200,height=800'
      );

      if (!newWindow) {
        toast.error("Please allow pop-ups to view the PDF report");
        return;
      }

      if (lca.organization_id) {
        await supabase.rpc("increment_report_count", {
          p_organization_id: lca.organization_id,
        });
      }

      toast.success("Opening PDF report in new window. Use Cmd+P or Ctrl+P to print/save as PDF.");
    } catch (error: any) {
      console.error("Error downloading LCA:", error);
      toast.error("Failed to download LCA report");
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
