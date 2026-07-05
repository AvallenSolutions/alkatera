"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StateChip } from "@/components/studio";
import {
  Sparkles,
  TrendingDown,
  TrendingUp,
  Lock,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import type { KeyFinding } from "@/lib/claude/key-findings-assistant";

// ============================================================================
// Types
// ============================================================================

interface KeyFindingsPanelProps {
  organizationId: string;
  year: number;
  hasPreviousYearData: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const SCOPE_LABELS: Record<string, string> = {
  scope1: "Scope 1",
  scope2: "Scope 2",
  scope3: "Scope 3",
};

const CONFIDENCE_DOTS: Record<string, { colour: string; label: string }> = {
  high: { colour: "bg-studio-good", label: "Matched to logged event" },
  medium: { colour: "bg-studio-attention", label: "Pattern detected in data" },
  low: { colour: "bg-studio-dim", label: "Inferred from emission delta" },
};

// ============================================================================
// Component
// ============================================================================

export function KeyFindingsPanel({
  organizationId,
  year,
  hasPreviousYearData,
}: KeyFindingsPanelProps) {
  const [findings, setFindings] = useState<KeyFinding[] | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isGated, setIsGated] = useState(false);
  const [meta, setMeta] = useState<{
    totalChange: number;
    totalChangePct: number;
    cached: boolean;
  } | null>(null);

  // Don't render if no previous year data
  if (!hasPreviousYearData) return null;

  async function handleGenerate() {
    setIsGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/key-findings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, force: findings !== null }),
      });

      if (res.status === 403) {
        setIsGated(true);
        return;
      }

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to generate key findings");
      }

      const data = await res.json();
      setFindings(data.findings || []);
      setMeta({
        totalChange: data.totalChange,
        totalChangePct: data.totalChangePct,
        cached: data.cached,
      });

      if (data.cached) {
        toast.info("Showing cached findings");
      }
    } catch (err: any) {
      console.error("[KeyFindings] Error:", err);
      setError(err.message || "Failed to generate key findings");
      toast.error(err.message || "Failed to generate key findings");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <Card className="relative overflow-hidden rounded-[6px] border border-border bg-card">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-[6px] bg-secondary flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-studio-brick" />
            </div>
            <div>
              <CardTitle className="text-lg">Key Findings</CardTitle>
              <CardDescription>
                AI-generated insights explaining your year-on-year emission
                changes
              </CardDescription>
            </div>
          </div>

          {meta && (
            <StateChip tone={meta.totalChangePct <= 0 ? "good" : "stale"}>
              {meta.totalChangePct <= 0 ? "↓" : "↑"}{" "}
              {Math.abs(meta.totalChangePct).toFixed(1)}% YoY
            </StateChip>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Subscription gate */}
        {isGated && (
          <div className="flex items-center gap-3 p-4 rounded-[6px] border border-border bg-secondary">
            <Lock className="h-5 w-5 text-muted-foreground shrink-0" />
            <div>
              <div className="font-medium text-sm">
                Available on Blossom and Canopy plans
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Upgrade to unlock AI-powered key findings for your
                sustainability reports
              </div>
            </div>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-[6px] border border-border bg-card text-sm text-studio-stale">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Findings list */}
        {findings && findings.length > 0 && (
          <div className="space-y-3">
            {findings.map((finding, i) => {
              const DirIcon =
                finding.direction === "decrease" ? TrendingDown : TrendingUp;
              const dirColour =
                finding.direction === "decrease"
                  ? "text-studio-good"
                  : "text-studio-stale";
              const conf = CONFIDENCE_DOTS[finding.confidence] || CONFIDENCE_DOTS.low;

              return (
                <div
                  key={i}
                  className="flex gap-3 p-4 rounded-[6px] border border-border bg-secondary"
                >
                  <DirIcon
                    className={`h-5 w-5 mt-0.5 shrink-0 ${dirColour}`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm mb-1">
                      {finding.title}
                    </div>
                    <div className="text-sm text-muted-foreground leading-relaxed">
                      {finding.narrative}
                    </div>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-studio-dim">
                        {SCOPE_LABELS[finding.scope] || finding.scope}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {finding.magnitude_pct >= 0 ? "+" : ""}
                        {finding.magnitude_pct.toFixed(0)}%
                      </Badge>
                      <div className="flex items-center gap-1.5" title={conf.label}>
                        <div
                          className={`h-2 w-2 rounded-full ${conf.colour}`}
                        />
                        <span className="text-xs text-muted-foreground">
                          {conf.label}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Empty state after generation */}
        {findings && findings.length === 0 && (
          <div className="py-6 text-center text-sm text-muted-foreground">
            No significant findings detected. Try logging operational changes
            to provide more context.
          </div>
        )}

        {/* Generate button */}
        {!isGated && (
          <Button
            onClick={handleGenerate}
            disabled={isGenerating}
            variant={findings ? "outline" : "default"}
            className="w-full"
            size="sm"
          >
            {isGenerating ? (
              <>Analysing changes...</>
            ) : findings ? (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Regenerate Findings
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Key Findings
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
