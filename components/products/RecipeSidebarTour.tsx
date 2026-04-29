"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Sparkles, X } from "lucide-react";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";

export type TourStep = "basics" | "source" | "logistics" | "save" | "done";

interface RecipeSidebarTourProps {
  /** Whether the tour is allowed to render at all (e.g. only on the Ingredients tab). */
  active: boolean;
  /** The current step. Lifted to the parent so it can also drive the editor tab. */
  step: TourStep;
  onStepChange: (next: TourStep) => void;
}

const STEP_CONTENT: Record<
  Exclude<TourStep, "done">,
  { title: string; body: string; anchor: string; ctaPrimary: string; ctaNext: TourStep }
> = {
  basics: {
    title: "Start here",
    body:
      "Tell us what the ingredient is, how much you use, and the unit. We will pull the emission factor from our database or your supplier records.",
    anchor: "basics",
    ctaPrimary: "Next",
    ctaNext: "source",
  },
  source: {
    title: "Where does it come from?",
    body:
      "Pick a supplier, search the global database, or flag it as self-grown. This drives the data quality grade in your audit trail.",
    anchor: "source",
    ctaPrimary: "Next",
    ctaNext: "logistics",
  },
  logistics: {
    title: "How does it get to you?",
    body:
      "Add the origin and one or more transport legs. Freight emissions ride on this, so the more accurate, the better.",
    anchor: "logistics",
    ctaPrimary: "Next",
    ctaNext: "save",
  },
  save: {
    title: "Save and we will calculate",
    body:
      "Hit Save Ingredients. We will calculate the per-bottle CO₂e and feed it into your LCA report. The dots on each tab show what's done and what's still missing.",
    anchor: "save",
    ctaPrimary: "Got it",
    ctaNext: "done",
  },
};

interface AnchorRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function useAnchorRect(anchorKey: string): AnchorRect | null {
  const [rect, setRect] = useState<AnchorRect | null>(null);

  useLayoutEffect(() => {
    const update = () => {
      const el = document.querySelector<HTMLElement>(`[data-tour-anchor="${anchorKey}"]`);
      if (!el) {
        setRect(null);
        return;
      }
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };
    update();
    const ro = new ResizeObserver(update);
    document.body && ro.observe(document.body);
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    const interval = window.setInterval(update, 250); // catch async DOM mutations
    return () => {
      ro.disconnect();
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
      window.clearInterval(interval);
    };
  }, [anchorKey]);

  return rect;
}

export function RecipeSidebarTour({ active, step, onStepChange }: RecipeSidebarTourProps) {
  const { state, isLoading, markRecipeSidebarTourCompleted } = useOnboarding();
  const alreadyDone = !!state.recipeSidebarTourCompleted;

  const isInteractiveStep = step !== "done";
  const content = isInteractiveStep ? STEP_CONTENT[step] : null;
  const anchorRect = useAnchorRect(content?.anchor ?? "");

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Fire the persistence write the moment the tour ends.
  useEffect(() => {
    if (step === "done" && active && !alreadyDone && !isLoading) {
      markRecipeSidebarTourCompleted();
    }
  }, [step, active, alreadyDone, isLoading, markRecipeSidebarTourCompleted]);

  if (!mounted) return null;
  if (!active) return null;
  if (isLoading) return null;
  if (alreadyDone) return null;
  if (!isInteractiveStep) return null;
  if (!content) return null;
  if (!anchorRect) return null;

  const handleSkip = () => onStepChange("done");
  const handleNext = () => onStepChange(content.ctaNext);

  // Position: below the anchor, left-aligned. Keep within the viewport horizontally.
  const POPOVER_WIDTH = 320;
  const GAP = 8;
  const left = Math.max(
    8,
    Math.min(anchorRect.left, window.innerWidth - POPOVER_WIDTH - 8),
  );
  const top = anchorRect.top + anchorRect.height + GAP + window.scrollY;

  return createPortal(
    <>
      {/* Subtle full-screen scrim so the popover stands out without blocking clicks. */}
      <div
        className="fixed inset-0 z-40 bg-black/30 pointer-events-none"
        aria-hidden
      />

      {/* Highlight ring on the anchor */}
      <div
        className="fixed z-40 pointer-events-none rounded-md ring-2 ring-primary ring-offset-2 ring-offset-background animate-pulse"
        style={{
          top: anchorRect.top - 4 + window.scrollY,
          left: anchorRect.left - 4,
          width: anchorRect.width + 8,
          height: anchorRect.height + 8,
        }}
        aria-hidden
      />

      {/* Popover card */}
      <div
        role="dialog"
        aria-label={content.title}
        className="fixed z-50 rounded-md border bg-popover text-popover-foreground shadow-lg p-4"
        style={{ top, left, width: POPOVER_WIDTH }}
      >
        <div className="flex items-start gap-2 mb-2">
          <Sparkles className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold">{content.title}</h3>
          </div>
          <button
            type="button"
            onClick={handleSkip}
            aria-label="Close tour"
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed mb-3">{content.body}</p>
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={handleSkip}
            className="text-xs text-muted-foreground underline-offset-2 hover:underline"
          >
            Skip tour
          </button>
          <Button size="sm" onClick={handleNext}>
            {content.ctaPrimary}
          </Button>
        </div>
      </div>
    </>,
    document.body,
  );
}
