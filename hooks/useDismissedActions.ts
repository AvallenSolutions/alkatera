"use client";

import { useCallback, useEffect, useState } from "react";
import { useOrganization } from "@/lib/organizationContext";

// Per-org localStorage key — dismissals follow the org, not the browser user.
function storageKey(orgId: string) {
  return `alkatera_dismissed_actions_${orgId}`;
}

function readDismissed(orgId: string): Set<string> {
  try {
    const raw = localStorage.getItem(storageKey(orgId));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return new Set(parsed.filter((v) => typeof v === "string"));
    return new Set();
  } catch {
    return new Set();
  }
}

function writeDismissed(orgId: string, ids: Set<string>) {
  try {
    localStorage.setItem(storageKey(orgId), JSON.stringify(Array.from(ids)));
  } catch {
    // storage quota or private-mode: dismissal is best-effort
  }
}

export interface DismissedActions {
  dismissed: Set<string>;
  isDismissed: (id: string) => boolean;
  dismiss: (id: string) => void;
  restore: (id: string) => void;
  clearAll: () => void;
}

export function useDismissedActions(): DismissedActions {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!orgId) {
      setDismissed(new Set());
      return;
    }
    setDismissed(readDismissed(orgId));
  }, [orgId]);

  const dismiss = useCallback(
    (id: string) => {
      if (!orgId) return;
      setDismissed((prev) => {
        if (prev.has(id)) return prev;
        const next = new Set(prev);
        next.add(id);
        writeDismissed(orgId, next);
        return next;
      });
    },
    [orgId]
  );

  const restore = useCallback(
    (id: string) => {
      if (!orgId) return;
      setDismissed((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        writeDismissed(orgId, next);
        return next;
      });
    },
    [orgId]
  );

  const clearAll = useCallback(() => {
    if (!orgId) return;
    setDismissed(new Set());
    writeDismissed(orgId, new Set());
  }, [orgId]);

  const isDismissed = useCallback((id: string) => dismissed.has(id), [dismissed]);

  return { dismissed, isDismissed, dismiss, restore, clearAll };
}
