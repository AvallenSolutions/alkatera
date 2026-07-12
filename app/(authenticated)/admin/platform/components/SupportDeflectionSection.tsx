"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { LifeBuoy, Search, Compass, Ticket } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

interface SupportStats {
  window_days: number;
  knowledge_searches: number;
  next_step_asks: number;
  tickets_filed: number;
  resolved_in_place: number;
}

/**
 * Support-deflection measurement (Phase 4, see
 * tasks/onboarding-support-plan.md): how much of Rosa's support load
 * resolves in place versus escalating to a human ticket, over the last 30
 * days. Reads /api/admin/support-stats, which counts rosa_telemetry rows
 * written by lib/rosa/tools.ts (searches, next-step asks) and
 * lib/rosa/actions.ts (tickets actually filed).
 */
export function SupportDeflectionSection() {
  const [stats, setStats] = useState<SupportStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) return;
        const res = await fetch("/api/admin/support-stats", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled) setStats(json);
      } catch {
        // The card simply stays quiet if this fails.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <Skeleton className="h-48" />;
  }

  if (!stats) {
    return null;
  }

  const deflectionLabel =
    stats.tickets_filed > 0
      ? `${(stats.resolved_in_place / stats.tickets_filed).toFixed(1)} : 1`
      : stats.resolved_in_place > 0
        ? "All resolved in place"
        : "No data yet";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LifeBuoy className="h-5 w-5 text-emerald-500" />
          Support
        </CardTitle>
        <CardDescription>
          Rosa&apos;s support tools over the last {stats.window_days} days: questions answered in
          place versus tickets that needed a human.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-gray-100 p-3 text-center dark:border-gray-800">
            <Search className="mx-auto mb-1 h-4 w-4 text-blue-500" />
            <div className="text-lg font-semibold">{stats.knowledge_searches}</div>
            <p className="text-xs text-gray-500">Knowledge searches</p>
          </div>
          <div className="rounded-lg border border-gray-100 p-3 text-center dark:border-gray-800">
            <Compass className="mx-auto mb-1 h-4 w-4 text-purple-500" />
            <div className="text-lg font-semibold">{stats.next_step_asks}</div>
            <p className="text-xs text-gray-500">&quot;What&apos;s next&quot; asks</p>
          </div>
          <div className="rounded-lg border border-gray-100 p-3 text-center dark:border-gray-800">
            <Ticket className="mx-auto mb-1 h-4 w-4 text-amber-500" />
            <div className="text-lg font-semibold">{stats.tickets_filed}</div>
            <p className="text-xs text-gray-500">Tickets filed</p>
          </div>
          <div className="rounded-lg bg-emerald-50 p-3 text-center dark:bg-emerald-950/30">
            <div className="text-lg font-semibold">{deflectionLabel}</div>
            <p className="text-xs text-gray-500">Deflection ratio</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
