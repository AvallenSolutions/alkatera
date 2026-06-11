"use client";

// "Review your matches": a two-minute stepper through every auto-matched
// row, instead of row-by-row ambient guilt. Each step shows what the item
// was matched to, in plain language, with its implied impact; the user
// either confirms ("Looks right") or sends it back for a manual pick.

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Search, ShieldQuestion } from "lucide-react";
import { cleanFactorDisplayName } from "@/lib/factor-display-name";
import { friendlyNameFor } from "@/lib/factor-friendly-names";
import { formatPreviewKg, type ImpactPreview } from "@/lib/products/impact-preview";

export interface ReviewMatchItem {
  tempId: string;
  kind: 'ingredient' | 'packaging';
  /** The user's name for the row, e.g. "Hops" */
  name: string;
  /** The matched factor's technical name */
  matchedSourceName?: string;
  efSource?: string;
  efDataQualityGrade?: string;
  impactPreview?: ImpactPreview | null;
}

interface ReviewMatchesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: ReviewMatchItem[];
  /** Confirm: sets the row's match_status to verified */
  onConfirm: (item: ReviewMatchItem) => void;
  /** Reject: clears the match so the user picks manually */
  onPickDifferent: (item: ReviewMatchItem) => void;
}

export function ReviewMatchesDialog({
  open,
  onOpenChange,
  items,
  onConfirm,
  onPickDifferent,
}: ReviewMatchesDialogProps) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (open) setIndex(0);
  }, [open]);

  const item = items[index];
  const done = !item;

  const advance = () => {
    if (index + 1 >= items.length) {
      onOpenChange(false);
    } else {
      setIndex((i) => i + 1);
    }
  };

  if (!open) return null;

  const friendly = item?.matchedSourceName
    ? friendlyNameFor(item.matchedSourceName) || cleanFactorDisplayName(item.matchedSourceName)
    : null;
  const technical = item?.matchedSourceName ? cleanFactorDisplayName(item.matchedSourceName) : null;
  const grade = item?.efDataQualityGrade;
  const gradeLabel = grade === 'HIGH' ? 'High quality data'
    : grade === 'MEDIUM' ? 'Good quality data'
    : grade === 'LOW' ? 'Estimated data'
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldQuestion className="h-4 w-4 text-amber-600" />
            Review your matches
          </DialogTitle>
          <DialogDescription>
            {done
              ? 'All done.'
              : `${index + 1} of ${items.length}: we matched each item to the closest emission factor. Confirm it looks right, or pick a different one.`}
          </DialogDescription>
        </DialogHeader>

        {!done && (
          <>
            <Progress value={((index) / Math.max(items.length, 1)) * 100} className="h-1" />

            <div className="rounded-md border p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{item.name}</span>
                <Badge variant="outline" className="text-xs capitalize">{item.kind}</Badge>
              </div>

              <div className="text-sm">
                <span className="text-muted-foreground">Matched to: </span>
                <span className="font-medium">{friendly}</span>
                {technical && friendly !== technical && (
                  <p className="text-[11px] text-muted-foreground mt-0.5" title={technical}>
                    {technical}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                {item.efSource && <span>{item.efSource}</span>}
                {gradeLabel && <Badge variant="secondary" className="text-[10px] h-5">{gradeLabel}</Badge>}
              </div>

              {item.impactPreview && (
                <p className="text-xs text-muted-foreground">
                  Adds ≈ {formatPreviewKg(item.impactPreview.perUnitKgCo2e)} kg CO₂e per unit
                  {item.impactPreview.shareOfBenchmark != null && item.impactPreview.shareOfBenchmark >= 0.01 && (
                    <> · about {Math.round(item.impactPreview.shareOfBenchmark * 100)}% of a typical {item.impactPreview.benchmarkLabel || 'product'} footprint</>
                  )}
                </p>
              )}
            </div>

            <DialogFooter className="gap-2 sm:gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  onPickDifferent(item);
                  advance();
                }}
              >
                <Search className="h-4 w-4 mr-2" />
                Pick a different one
              </Button>
              <Button
                type="button"
                onClick={() => {
                  onConfirm(item);
                  advance();
                }}
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Looks right
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
