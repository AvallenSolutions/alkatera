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
import { useExportGate } from "@/hooks/useExportGate";
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
  const { exportsLocked, reason: exportReason, message: exportMessage } = useExportGate();

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

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");

      // generate-pdf renders the real PDF and increments the report count
      // server-side (so we don't double-count here). It also enforces the
      // staleness guard: a recipe edited since the last calculation returns 409.
      const res = await fetch(`/api/lca/${lcaId}/generate-pdf`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ includeNarratives: false, inline: false }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (res.status === 409 && err.error === "stale_inputs") {
          toast.error("Recipe changed since the last calculation", {
            description: "Recalculate the LCA before downloading, so the report reflects your latest edits.",
          });
          return;
        }
        throw new Error(err.message || err.details || err.error || `Download failed (${res.status})`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const safeName = (productName || "Product").replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "");
      const date = new Date().toISOString().slice(0, 10);
      const a = document.createElement("a");
      a.href = url;
      a.download = `LCA_Report_${safeName}_${date}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      toast.success("LCA report downloaded");
    } catch (error: any) {
      console.error("Error downloading LCA PDF:", error);
      toast.error(error?.message || "Failed to download the LCA report");
    } finally {
      setIsGenerating(false);
    }
  };

  // Trial / read-only: downloads are a paid feature. Show a locked button that
  // opens the upgrade prompt rather than letting the request 403 silently.
  if (exportsLocked) {
    return (
      <>
        <UpgradePromptModal
          open={showUpgradeModal}
          onOpenChange={setShowUpgradeModal}
          reason={exportMessage}
        />
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button
                  variant={variant}
                  size={size}
                  onClick={() => setShowUpgradeModal(true)}
                  className="border-[#ccff00]/50"
                >
                  <Lock className="h-4 w-4 mr-2 text-[#ccff00]" />
                  {exportReason === "read_only" ? "Subscribe to download" : "Download (trial)"}
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p>{exportMessage}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </>
    );
  }

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
        {isGenerating ? "Preparing..." : "Download LCA"}
      </Button>
    </>
  );
}
