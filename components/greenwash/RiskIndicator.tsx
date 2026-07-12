"use client";

import { AlertTriangle, AlertCircle, CheckCircle } from "lucide-react";
import { StateChip } from "@/components/studio/state-chip";
import type { WorkingTone } from "@/components/studio/theme";
import { getRiskLevelLabel, riskTone } from "@/lib/greenwash";

const TONE_TEXT: Record<WorkingTone, string> = {
  good: "text-studio-good",
  attention: "text-studio-attention",
  stale: "text-studio-stale",
  hold: "text-studio-hold",
  quiet: "text-studio-dim",
};

interface RiskIndicatorProps {
  level: string | null;
}

/** An icon plus a typographic chip in the risk's working tone. */
export function RiskIndicator({ level }: RiskIndicatorProps) {
  const tone = riskTone(level);
  const Icon = level === "high" ? AlertTriangle : level === "medium" ? AlertCircle : CheckCircle;

  return (
    <div className="flex items-center gap-2">
      <Icon className={`h-4 w-4 ${TONE_TEXT[tone]}`} />
      <StateChip tone={tone}>{getRiskLevelLabel(level || "low")}</StateChip>
    </div>
  );
}
