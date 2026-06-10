"use client";

// "Apply + flag" badge for emission factor provenance on a material row.
// Auto-matched factors are already used in calculations; the badge makes
// that visible and offers a one-click confirmation. Plain language only.

import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Search, ShieldQuestion } from "lucide-react";
import type { MatchStatus } from "@/lib/types/lca";

interface MatchStatusBadgeProps {
  status?: MatchStatus | null;
  /** One-click "Looks right" confirmation; only shown for auto_matched */
  onConfirm?: () => void;
}

export function MatchStatusBadge({ status, onConfirm }: MatchStatusBadgeProps) {
  if (!status) return null; // legacy row, unknown provenance: no badge

  if (status === 'verified') {
    return (
      <Badge variant="outline" className="text-[10px] h-5 gap-1 border-green-300 text-green-700 dark:border-green-800 dark:text-green-400">
        <CheckCircle2 className="h-3 w-3" />
        Checked
      </Badge>
    );
  }

  if (status === 'auto_matched') {
    return (
      <span className="inline-flex items-center gap-1">
        <Badge variant="outline" className="text-[10px] h-5 gap-1 border-amber-300 text-amber-700 dark:border-amber-800 dark:text-amber-400">
          <ShieldQuestion className="h-3 w-3" />
          Matched, please check
        </Badge>
        {onConfirm && (
          // span with role=button: this badge often renders inside the row's
          // expand/collapse <button>, where a nested <button> is invalid HTML.
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onConfirm();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                onConfirm();
              }
            }}
            className="inline-flex items-center h-5 px-1.5 rounded text-[10px] font-medium text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/30 cursor-pointer"
          >
            Looks right
          </span>
        )}
      </span>
    );
  }

  // needs_review
  return (
    <Badge variant="outline" className="text-[10px] h-5 gap-1 border-muted-foreground/30 text-muted-foreground">
      <Search className="h-3 w-3" />
      Pick an emission factor
    </Badge>
  );
}
