"use client";

import { useSubscription } from "@/hooks/useSubscription";

export interface ExportGate {
  /** True when the org may not download/export (trial or expired/read-only). */
  exportsLocked: boolean;
  /** Why exports are locked, for tailoring the upgrade copy. */
  reason: "trial" | "read_only" | null;
  /** Friendly message to show in the upgrade prompt / tooltip. */
  message: string;
  isLoading: boolean;
}

/**
 * Single source of truth for "can this org download things right now?".
 *
 * Downloads are a paid feature: trial orgs can build and explore but cannot
 * export; expired trials ('cancelled') are read-only and equally blocked. Mirrors
 * the server-side `enforceExportAllowed` guard so the UI and API agree.
 */
export function useExportGate(): ExportGate {
  const { subscriptionStatus, isLoading } = useSubscription();

  if (subscriptionStatus === "trial") {
    return {
      exportsLocked: true,
      reason: "trial",
      message: "Subscribe to download reports, PDFs and data exports.",
      isLoading,
    };
  }

  if (subscriptionStatus === "cancelled") {
    return {
      exportsLocked: true,
      reason: "read_only",
      message: "Your trial has ended. Subscribe to download reports and exports.",
      isLoading,
    };
  }

  return { exportsLocked: false, reason: null, message: "", isLoading };
}
