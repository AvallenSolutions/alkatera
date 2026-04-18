"use client";

import { useCallback, useEffect, useState } from "react";
import { useOrganization } from "@/lib/organizationContext";

// Stored values:
//   "permanent"    — never show again until user restores
//   "YYYY-MM-DD"   — hidden for that local date only; reappears the next day
//   null / missing — visible
function storageKey(orgId: string) {
  return `alkatera_three_things_hidden_${orgId}`;
}

function todayISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export type HeroDismissalState = "visible" | "hidden-today" | "hidden-permanent";

export interface HeroDismissal {
  state: HeroDismissalState;
  isVisible: boolean;
  hideForToday: () => void;
  hidePermanently: () => void;
  restore: () => void;
}

export function useHeroDismissal(): HeroDismissal {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;
  const [state, setState] = useState<HeroDismissalState>("visible");

  useEffect(() => {
    if (!orgId) {
      setState("visible");
      return;
    }
    try {
      const raw = localStorage.getItem(storageKey(orgId));
      if (raw === "permanent") setState("hidden-permanent");
      else if (raw && raw === todayISO()) setState("hidden-today");
      else setState("visible");
    } catch {
      setState("visible");
    }
  }, [orgId]);

  const hideForToday = useCallback(() => {
    if (!orgId) return;
    try {
      localStorage.setItem(storageKey(orgId), todayISO());
    } catch { /* best-effort */ }
    setState("hidden-today");
  }, [orgId]);

  const hidePermanently = useCallback(() => {
    if (!orgId) return;
    try {
      localStorage.setItem(storageKey(orgId), "permanent");
    } catch { /* best-effort */ }
    setState("hidden-permanent");
  }, [orgId]);

  const restore = useCallback(() => {
    if (!orgId) return;
    try {
      localStorage.removeItem(storageKey(orgId));
    } catch { /* best-effort */ }
    setState("visible");
  }, [orgId]);

  return {
    state,
    isVisible: state === "visible",
    hideForToday,
    hidePermanently,
    restore,
  };
}
