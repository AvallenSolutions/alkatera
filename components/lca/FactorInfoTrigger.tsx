"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import {
  HoverCard,
  HoverCardTrigger,
  HoverCardContent,
} from "@/components/ui/hover-card";
import { EmissionFactorDetailPopover } from "./EmissionFactorDetailPopover";
import type { SearchResult } from "./InlineIngredientSearch";
import { getMatchSuitability } from "@/lib/factor-suitability";
import { cleanFactorDisplayName } from "@/lib/factor-display-name";

interface FactorInfoTriggerProps {
  result: SearchResult;
  materialType?: "ingredient" | "packaging";
}

/**
 * The ⓘ button on each search result row. Coordinates two overlays:
 *  - HoverCard preview (auto-opens on hover, ~150ms delay)
 *  - Click popover with full details
 *
 * The two are mutually exclusive — when the click popover opens, the hover
 * preview is forced closed so they never stack on top of each other.
 */
export function FactorInfoTrigger({ result, materialType }: FactorInfoTriggerProps) {
  const [hoverOpen, setHoverOpen] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);

  // The hover preview is suppressed whenever the click popover is open.
  const effectiveHoverOpen = hoverOpen && !popoverOpen;

  const handlePopoverOpenChange = (next: boolean) => {
    setPopoverOpen(next);
    if (next) {
      // When the popover opens, immediately drop the hover state so it
      // can't reappear until the user hovers fresh.
      setHoverOpen(false);
    }
  };

  return (
    <HoverCard
      open={effectiveHoverOpen}
      onOpenChange={setHoverOpen}
      openDelay={150}
      closeDelay={120}
    >
      <HoverCardTrigger asChild>
        <span
          className="inline-flex"
          data-tour-anchor="factor-info-icon"
          onPointerDown={() => setHoverOpen(false)}
        >
          <EmissionFactorDetailPopover
            result={result}
            materialType={materialType}
            open={popoverOpen}
            onOpenChange={handlePopoverOpenChange}
          >
            <button
              type="button"
              className="inline-flex items-center justify-center h-6 w-6 rounded-full hover:bg-accent shrink-0 text-muted-foreground hover:text-foreground transition-colors"
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              aria-label="View factor details — what it covers, when it's a good match"
            >
              <Info className="h-4 w-4" />
            </button>
          </EmissionFactorDetailPopover>
        </span>
      </HoverCardTrigger>
      <HoverCardContent
        side="left"
        align="center"
        sideOffset={8}
        collisionPadding={16}
        avoidCollisions
        sticky="always"
        style={{ width: "288px", maxWidth: "min(288px, calc(100vw - 3rem))" }}
        className="p-3 text-[11px] leading-snug break-words whitespace-normal"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {(() => {
          const suitability = getMatchSuitability(result, { materialType });
          return (
            <div className="space-y-2 min-w-0">
              <p className="font-medium text-xs leading-snug break-words">
                {result.friendly_name || cleanFactorDisplayName(result.name)}
              </p>
              <p className="text-muted-foreground break-words">
                {suitability.whatItCovers}
              </p>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground/70">
                {result.location && <span>Region: {result.location}</span>}
                {(result.data_quality_grade ||
                  result.metadata?.data_quality_grade) && (
                  <span>
                    Quality:{" "}
                    {
                      (result.data_quality_grade ||
                        result.metadata?.data_quality_grade) as string
                    }
                  </span>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground/60 italic">
                Click the ⓘ for full details, plain-English boundary, and
                suitability checks.
              </p>
            </div>
          );
        })()}
      </HoverCardContent>
    </HoverCard>
  );
}
