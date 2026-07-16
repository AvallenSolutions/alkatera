"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";
import { CoachmarkBody } from "@/components/studio/coachmark";

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
        className="fixed z-[60] pointer-events-none rounded-full ring-2 ring-studio-ink/50 ring-offset-2 ring-offset-background animate-pulse"
        style={{
          top: rect.top - 4 + window.scrollY,
          left: rect.left - 4,
          width: rect.width + 8,
          height: rect.height + 8,
        }}
        aria-hidden
      />
      <CoachmarkBody
        role="dialog"
        ariaLabel="Tip: hover the info icon"
        title="New"
        body="Hover the info icon on any result for a quick summary, or click it to see what the factor covers, when it's a good match, and a glossary for any jargon."
        onDismiss={dismiss}
        className="fixed z-[61]"
        style={{ top, left, width: POPOVER_WIDTH }}
      />
    </>,
    document.body,
  );
}
