"use client";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import {
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Scale,
  Lightbulb,
} from "lucide-react";
import { StateChip } from "@/components/studio/state-chip";
import type { WorkingTone } from "@/components/studio/theme";
import { getJurisdictionLabel, riskTone } from "@/lib/greenwash";
import type { GreenwashAssessmentClaim } from "@/lib/types/greenwash";

const TONE_TEXT: Record<WorkingTone, string> = {
  good: "text-studio-good",
  attention: "text-studio-attention",
  stale: "text-studio-stale",
  hold: "text-studio-hold",
  quiet: "text-studio-dim",
};

interface ClaimCardProps {
  claim: GreenwashAssessmentClaim;
  isExpanded: boolean;
  onToggle: () => void;
}

/** One environmental claim, its risk tone, and the guidance behind it. */
export function ClaimCard({ claim, isExpanded, onToggle }: ClaimCardProps) {
  const tone = riskTone(claim.risk_level);
  const toneText = TONE_TEXT[tone];

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <div className="rounded-[6px] border border-border bg-card">
        <CollapsibleTrigger asChild>
          <button className="w-full p-4 flex items-start gap-4 text-left hover:bg-secondary transition-colors rounded-[6px]">
            <div className="flex-shrink-0 pt-0.5">
              {claim.risk_level === "high" ? (
                <AlertTriangle className={`h-4 w-4 ${toneText}`} />
              ) : claim.risk_level === "medium" ? (
                <AlertCircle className={`h-4 w-4 ${toneText}`} />
              ) : (
                <CheckCircle2 className={`h-4 w-4 ${toneText}`} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-foreground font-medium">&quot;{claim.claim_text}&quot;</p>
              <p className="text-muted-foreground text-sm mt-1 truncate">
                {claim.issue_description}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <StateChip tone={tone}>{claim.risk_level}</StateChip>
              {isExpanded ? (
                <ChevronUp className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 pb-4 pt-0 space-y-4">
            <Separator />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h5 className="text-sm font-medium text-muted-foreground mb-1">Issue Type</h5>
                <p className="text-foreground">{claim.issue_type?.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</p>
              </div>
              <div>
                <h5 className="text-sm font-medium text-muted-foreground mb-1">Risk Score</h5>
                <p className="text-foreground tabular-nums">{claim.risk_score}/100</p>
              </div>
            </div>

            <div>
              <h5 className="text-sm font-medium text-muted-foreground mb-1">Issue Description</h5>
              <p className="text-foreground">{claim.issue_description}</p>
            </div>

            <div className="flex items-center gap-2">
              <Scale className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Legislation:</span>
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-studio-dim">
                {getJurisdictionLabel(claim.legislation_jurisdiction)} · {claim.legislation_name}
                {claim.legislation_article && ` (${claim.legislation_article})`}
              </span>
            </div>

            <div className="bg-secondary border border-border rounded-[6px] p-4">
              <h5 className="text-sm font-medium text-studio-good mb-2 flex items-center gap-2">
                <Lightbulb className="h-4 w-4" />
                Suggestion
              </h5>
              <p className="text-foreground">{claim.suggestion}</p>
              {claim.suggested_revision && (
                <div className="mt-3 p-3 bg-card border border-border rounded-[6px]">
                  <h6 className="text-xs font-medium text-muted-foreground mb-1">Suggested Revision:</h6>
                  <p className="text-foreground italic">&quot;{claim.suggested_revision}&quot;</p>
                </div>
              )}
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
