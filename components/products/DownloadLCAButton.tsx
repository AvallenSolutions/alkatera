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
        .select("*")
        .eq("id", lcaId)
        .single();

      if (lcaError) throw lcaError;

      // Increment report count
      if (lca.organization_id) {
        await supabase.rpc("increment_report_count", {
          p_organization_id: lca.organization_id,
        });
      }

      // Open the beautiful PDF report page
      const pdfUrl = `/products/${productId}/lca-pdf`;
      window.open(pdfUrl, '_blank');

      toast.success("Report opened - use your browser's print function to save as PDF", {
        duration: 5000,
      });
    } catch (error: any) {
      console.error("Error opening PDF:", error);
      toast.error("Failed to open PDF report");
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
        {isGenerating ? "Opening..." : "Download PDF"}
      </Button>
    </>
  );
}
