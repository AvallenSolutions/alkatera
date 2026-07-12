"use client";

import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { WorkingTone } from "@/components/studio/theme";
import { riskTone } from "@/lib/greenwash";
import type { GreenwashAssessment } from "@/lib/types/greenwash";
import { format } from "date-fns";

const TONE_BG: Record<WorkingTone, string> = {
  good: "bg-studio-good",
  attention: "bg-studio-attention",
  stale: "bg-studio-stale",
  hold: "bg-studio-hold",
  quiet: "bg-studio-dim",
};

interface TrendVisualizationProps {
  assessments: GreenwashAssessment[];
}

/** How the org's risk profile has moved over its completed assessments. */
export function TrendVisualization({ assessments }: TrendVisualizationProps) {
  // Sort by date ascending
  const sorted = [...assessments]
    .filter((a) => a.status === "completed" && a.overall_risk_score !== null)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  if (sorted.length < 2) {
    return (
      <p className="text-muted-foreground text-sm">Need at least 2 completed assessments to show trends.</p>
    );
  }

  // Calculate average risk score
  const avgRiskScore = sorted.reduce((sum, a) => sum + (a.overall_risk_score || 0), 0) / sorted.length;

  // Calculate trend (comparing first half to second half)
  const midpoint = Math.floor(sorted.length / 2);
  const firstHalf = sorted.slice(0, midpoint);
  const secondHalf = sorted.slice(midpoint);

  const firstHalfAvg = firstHalf.reduce((sum, a) => sum + (a.overall_risk_score || 0), 0) / firstHalf.length;
  const secondHalfAvg = secondHalf.reduce((sum, a) => sum + (a.overall_risk_score || 0), 0) / secondHalf.length;

  const trendDirection = secondHalfAvg < firstHalfAvg ? "improving" : secondHalfAvg > firstHalfAvg ? "worsening" : "stable";
  const trendPercent = Math.abs(((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100).toFixed(1);

  // Get recent assessments for the timeline
  const recentAssessments = sorted.slice(-10);
  const maxScore = 100;

  return (
    <div className="space-y-6">
      {/* Trend Summary */}
      <div className="flex items-center gap-4">
        <div className={`flex items-center gap-2 ${
          trendDirection === "improving" ? "text-studio-good" :
          trendDirection === "worsening" ? "text-studio-stale" :
          "text-studio-dim"
        }`}>
          {trendDirection === "improving" ? (
            <TrendingDown className="h-5 w-5" />
          ) : trendDirection === "worsening" ? (
            <TrendingUp className="h-5 w-5" />
          ) : (
            <Minus className="h-5 w-5" />
          )}
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em]">
            {trendDirection === "improving" ? "Risk Improving" :
             trendDirection === "worsening" ? "Risk Increasing" : "Risk Stable"}
          </span>
          {trendDirection !== "stable" && (
            <span className="font-mono text-[10px] tabular-nums">({trendPercent}%)</span>
          )}
        </div>
        <div className="text-muted-foreground text-sm">
          Average Risk Score: <span className="text-foreground font-medium tabular-nums">{avgRiskScore.toFixed(0)}/100</span>
        </div>
      </div>

      {/* Simple Visual Timeline */}
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Recent Assessment Risk Scores</p>
        <div className="flex items-end gap-1 h-32">
          {recentAssessments.map((assessment) => {
            const score = assessment.overall_risk_score || 0;
            const height = (score / maxScore) * 100;
            const bar = TONE_BG[riskTone(assessment.overall_risk_level)];

            return (
              <div key={assessment.id} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className={`w-full ${bar} rounded-t transition-all hover:opacity-80`}
                  style={{ height: `${Math.max(height, 5)}%` }}
                  title={`${assessment.title}: ${score}/100`}
                />
                <span className="text-[10px] font-mono text-muted-foreground truncate max-w-full">
                  {format(new Date(assessment.created_at), "MMM d")}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
