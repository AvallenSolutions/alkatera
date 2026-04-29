"use client";

import type { SectionStatus } from "@/components/products/lib/section-completion";

interface SectionStatusDotProps {
  status: SectionStatus;
  className?: string;
}

const SIZE = "h-2 w-2";

/**
 * Tiny coloured dot used next to tab labels to telegraph completion state.
 * - empty       → grey ring (no input yet)
 * - incomplete  → solid amber (started, missing required fields)
 * - complete    → solid green (satisfies completion criteria)
 * - n/a         → renders nothing (the section doesn't apply to this row)
 */
export function SectionStatusDot({ status, className = "" }: SectionStatusDotProps) {
  if (status === "n/a") return null;

  if (status === "complete") {
    return (
      <span
        aria-label="Section complete"
        className={`inline-block rounded-full bg-emerald-500 ${SIZE} ${className}`}
      />
    );
  }

  if (status === "incomplete") {
    return (
      <span
        aria-label="Section incomplete"
        className={`inline-block rounded-full bg-amber-500 ${SIZE} ${className}`}
      />
    );
  }

  return (
    <span
      aria-label="Section empty"
      className={`inline-block rounded-full border border-muted-foreground/40 ${SIZE} ${className}`}
    />
  );
}
