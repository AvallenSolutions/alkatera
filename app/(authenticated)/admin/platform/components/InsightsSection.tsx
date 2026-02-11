"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquare, ShieldCheck, Building2 } from "lucide-react";
import type { PlatformInsights } from "../types";

interface InsightsSectionProps {
  data: PlatformInsights | null;
  loading: boolean;
}

export function InsightsSection({ data, loading }: InsightsSectionProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Skeleton className="h-56" />
        <Skeleton className="h-56" />
        <Skeleton className="h-56" />
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const { ai_usage, data_quality, supplier_engagement } = data;

  // Data quality stacked bar widths
  const totalDocs = data_quality.total_documents || 1;
  const verifiedPct = Math.round((data_quality.verified / totalDocs) * 100);
  const unverifiedPct = Math.round((data_quality.unverified / totalDocs) * 100);
  const rejectedPct = Math.max(100 - verifiedPct - unverifiedPct, 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Gaia AI Usage */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="h-4 w-4 text-violet-500" />
            Rosa AI Usage
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Total Conversations</span>
            <span className="text-sm font-semibold">{ai_usage.total_conversations}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Active This Week</span>
            <Badge variant="secondary" className="font-mono">
              {ai_usage.active_this_week}
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Avg. Messages</span>
            <span className="text-sm font-semibold">{ai_usage.avg_messages_per_conversation}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Total Messages</span>
            <span className="text-sm font-semibold">
              {ai_usage.total_messages.toLocaleString()}
            </span>
          </div>
          <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Orgs Using AI</span>
              <span className="text-sm font-semibold">{ai_usage.organizations_using}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Quality */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            Data Quality
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-center py-2">
            <div className="text-3xl font-bold">
              {data_quality.verification_rate}%
            </div>
            <p className="text-xs text-gray-500">Verification Rate</p>
          </div>

          {/* Stacked bar */}
          {data_quality.total_documents > 0 && (
            <div className="h-3 flex rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800">
              {verifiedPct > 0 && (
                <div
                  className="bg-emerald-500 transition-all duration-500"
                  style={{ width: `${verifiedPct}%` }}
                />
              )}
              {unverifiedPct > 0 && (
                <div
                  className="bg-amber-400 transition-all duration-500"
                  style={{ width: `${unverifiedPct}%` }}
                />
              )}
              {rejectedPct > 0 && (
                <div
                  className="bg-red-400 transition-all duration-500"
                  style={{ width: `${rejectedPct}%` }}
                />
              )}
            </div>
          )}

          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div>
              <Badge variant="outline" className="border-emerald-500 text-emerald-600 font-mono text-xs">
                {data_quality.verified}
              </Badge>
              <p className="text-gray-500 mt-1">Verified</p>
            </div>
            <div>
              <Badge variant="outline" className="border-amber-500 text-amber-600 font-mono text-xs">
                {data_quality.unverified}
              </Badge>
              <p className="text-gray-500 mt-1">Pending</p>
            </div>
            <div>
              <Badge variant="outline" className="border-red-500 text-red-600 font-mono text-xs">
                {data_quality.rejected}
              </Badge>
              <p className="text-gray-500 mt-1">Rejected</p>
            </div>
          </div>

          <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Total Documents</span>
              <span className="text-sm font-semibold">{data_quality.total_documents}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Supplier Engagement */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-4 w-4 text-blue-500" />
            Supplier Engagement
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Org-level Suppliers</span>
            <span className="text-sm font-semibold">{supplier_engagement.total_org_suppliers}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Orgs with Suppliers</span>
            <span className="text-sm font-semibold">{supplier_engagement.organizations_with_suppliers}</span>
          </div>
          <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Platform Suppliers</span>
              <span className="text-sm font-semibold">{supplier_engagement.platform_suppliers_total}</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Verified</span>
            <Badge variant="outline" className="border-emerald-500 text-emerald-600 font-mono text-xs">
              {supplier_engagement.platform_suppliers_verified}
            </Badge>
          </div>
          {supplier_engagement.platform_suppliers_total > 0 && (
            <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                style={{
                  width: `${Math.round(
                    (supplier_engagement.platform_suppliers_verified /
                      supplier_engagement.platform_suppliers_total) *
                      100
                  )}%`,
                }}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
