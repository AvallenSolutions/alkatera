"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Sparkles, X } from "lucide-react";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";

/**
 * One-time coachmark pointing at the first ⓘ icon in the search results,
 * teaching users that hovering it surfaces a plain-English explanation.
 *
 * Only shows when:
 *  - the user has not yet dismissed it (`factorInfoHintCompleted` is false)
 *  - the search results dropdown is open and contains at least one result
 *  - the [data-tour-anchor="factor-info-icon"] element is mounted
 *
 * Dismissal is per-USER, not per-org: `factorInfoHintCompleted` lives in
 * onboarding_state which is keyed (organization_id, user_id), so on its own
 * the hint would reappear in every other organisation the user opens. The
 * localStorage flag makes one "Got it" stick across org switches; the
 * onboarding-state write keeps it hidden on other devices for orgs where it
 * was dismissed.
 */
const HINT_DISMISSED_LS_KEY = "alkatera-factor-info-hint-dismissed";

function readLocalDismissed(): boolean {
  try {
    return typeof window !== "undefined" && window.localStorage.getItem(HINT_DISMISSED_LS_KEY) === "1";
  } catch {
    return false;
  }
}

export function FactorInfoHint({ active }: { active: boolean }) {
  const { state, isLoading, markFactorInfoHintCompleted } = useOnboarding();
  const [localDismissed, setLocalDismissed] = useState(readLocalDismissed);
  const alreadyDone = !!state.factorInfoHintCompleted || localDismissed;

  const dismiss = () => {
    try {
      window.localStorage.setItem(HINT_DISMISSED_LS_KEY, "1");
    } catch {
      // localStorage unavailable (private mode) — org-level persistence still applies
    }
    setLocalDismissed(true);
    markFactorInfoHintCompleted();
  };

  const [rect, setRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useLayoutEffect(() => {
    if (!active || alreadyDone) {
      setRect(null);
      return;
    }
    const update = () => {
      const el = document.querySelector<HTMLElement>('[data-tour-anchor="factor-info-icon"]');
      if (!el) {
        setRect(null);
        return;
      }
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };
    update();
    const interval = window.setInterval(update, 250);
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [active, alreadyDone]);

  if (!mounted) return null;
  if (!active) return null;
  if (isLoading) return null;
  if (alreadyDone) return null;
  if (!rect) return null;

  const POPOVER_WIDTH = 260;
  const GAP = 10;
  const left = Math.max(
    8,
    Math.min(rect.left + rect.width / 2 - POPOVER_WIDTH / 2, window.innerWidth - POPOVER_WIDTH - 8),
  );
  const top = rect.top + rect.height + GAP + window.scrollY;

  return createPortal(
    <>
      <div
        className="fixed z-[60] pointer-events-none rounded-full ring-2 ring-primary ring-offset-2 ring-offset-background animate-pulse"
        style={{
          top: rect.top - 4 + window.scrollY,
          left: rect.left - 4,
          width: rect.width + 8,
          height: rect.height + 8,
        }}
        aria-hidden
      />
      <div
        role="dialog"
        aria-label="Tip: hover the info icon"
        className="fixed z-[61] rounded-md border bg-popover text-popover-foreground shadow-lg p-3"
        style={{ top, left, width: POPOVER_WIDTH }}
      >
        <div className="flex items-start gap-2 mb-1">
          <Sparkles className="h-3.5 w-3.5 mt-0.5 text-primary flex-shrink-0" />
          <h3 className="flex-1 text-xs font-semibold leading-snug">
            New: plain-English factor explanations
          </h3>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss tip"
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed mb-2">
          Hover the ⓘ on any result for a quick summary, or click it to see what the factor covers, when it&apos;s a good match, and a glossary for any jargon.
        </p>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={dismiss}
            className="text-[11px] text-primary hover:underline"
          >
            Got it
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}
