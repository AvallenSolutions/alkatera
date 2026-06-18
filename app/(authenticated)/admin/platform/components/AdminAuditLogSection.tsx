"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollText, RefreshCw } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { supabase } from "@/lib/supabaseClient";
import type { AdminAuditEntry, AdminAuditLog } from "../types";

const PAGE_SIZE = 25;

// Known actions -> human label + badge tone. Unknown actions fall back gracefully.
const ACTION_META: Record<string, { label: string; tone: string }> = {
  "org.subscription_update": {
    label: "Subscription changed",
    tone: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
  },
};

const ACTION_FILTERS = [
  { value: "all", label: "All actions" },
  { value: "org.subscription_update", label: "Subscription changed" },
];

function actionMeta(action: string) {
  return (
    ACTION_META[action] ?? {
      label: action,
      tone: "bg-muted text-muted-foreground border-border",
    }
  );
}

/** Render a {field: {from, to}} change map compactly, else stringify. */
function describeChange(metadata: Record<string, unknown> | null): string {
  if (!metadata || Object.keys(metadata).length === 0) return "";
  const parts: string[] = [];
  for (const [key, val] of Object.entries(metadata)) {
    if (val && typeof val === "object" && "from" in val && "to" in val) {
      const v = val as { from: unknown; to: unknown };
      parts.push(`${key}: ${v.from ?? "—"} → ${v.to ?? "—"}`);
    } else {
      parts.push(`${key}: ${String(val)}`);
    }
  }
  return parts.join(", ");
}

export function AdminAuditLogSection() {
  const [entries, setEntries] = useState<AdminAuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [actionFilter, setActionFilter] = useState("all");

  const fetchPage = useCallback(
    async (offset: number, append: boolean) => {
      if (append) setLoadingMore(true);
      else setLoading(true);
      try {
        const { data, error } = await (supabase.rpc as any)("get_admin_audit_log", {
          p_limit: PAGE_SIZE,
          p_offset: offset,
          p_action: actionFilter === "all" ? null : actionFilter,
        });
        if (!error && data) {
          const log = data as AdminAuditLog;
          setTotal(log.total ?? 0);
          setEntries((prev) => (append ? [...prev, ...(log.entries ?? [])] : log.entries ?? []));
        }
      } finally {
        if (append) setLoadingMore(false);
        else setLoading(false);
      }
    },
    [actionFilter]
  );

  useEffect(() => {
    fetchPage(0, false);
  }, [fetchPage]);

  const hasMore = entries.length < total;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2">
          <ScrollText className="h-5 w-5 text-muted-foreground" />
          <CardTitle>Admin audit trail</CardTitle>
          {!loading && (
            <Badge variant="secondary" className="ml-1">
              {total}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="h-8 w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ACTION_FILTERS.map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => fetchPage(0, false)}
            aria-label="Refresh audit log"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground mb-3">
          Who changed what, and when. Records identifiable platform-admin actions for accountability.
        </p>

        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
        ) : entries.length === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center">
            No admin actions recorded yet.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {entries.map((e) => {
              const meta = actionMeta(e.action);
              const change = describeChange(e.metadata);
              return (
                <div key={e.id} className="flex items-start justify-between gap-4 py-2.5">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${meta.tone}`}>
                        {meta.label}
                      </span>
                      {e.target_label && (
                        <span className="text-sm font-medium truncate">{e.target_label}</span>
                      )}
                    </div>
                    {change && (
                      <p className="text-xs text-muted-foreground mt-1 truncate">{change}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {e.actor_email ?? "Unknown actor"}
                    </p>
                  </div>
                  <div
                    className="text-xs text-muted-foreground whitespace-nowrap shrink-0"
                    title={format(new Date(e.created_at), "PPpp")}
                  >
                    {formatDistanceToNow(new Date(e.created_at), { addSuffix: true })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {hasMore && (
          <div className="pt-3 flex justify-center">
            <Button
              variant="outline"
              size="sm"
              disabled={loadingMore}
              onClick={() => fetchPage(entries.length, true)}
            >
              {loadingMore ? "Loading…" : `Load more (${total - entries.length} older)`}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
