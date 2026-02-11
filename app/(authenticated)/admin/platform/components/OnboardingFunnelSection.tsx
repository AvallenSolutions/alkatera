"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Rocket, CheckCircle, XCircle, Clock, ArrowRight } from "lucide-react";
import type { OnboardingAnalytics } from "../types";

interface OnboardingFunnelSectionProps {
  data: OnboardingAnalytics | null;
  loading: boolean;
}

const PHASES = [
  { key: "welcome" as const, label: "Welcome", color: "bg-lime-500" },
  { key: "quick_wins" as const, label: "Quick Wins", color: "bg-cyan-500" },
  { key: "core_setup" as const, label: "Core Setup", color: "bg-purple-500" },
  { key: "first_insights" as const, label: "Insights", color: "bg-emerald-500" },
  { key: "power_features" as const, label: "Power Features", color: "bg-lime-500" },
];

export function OnboardingFunnelSection({ data, loading }: OnboardingFunnelSectionProps) {
  if (loading) {
    return <Skeleton className="h-80" />;
  }

  if (!data) {
    return null;
  }

  const maxPhaseCount = Math.max(
    data.phases.welcome,
    data.phases.quick_wins,
    data.phases.core_setup,
    data.phases.first_insights,
    data.phases.power_features,
    1
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Rocket className="h-5 w-5 text-purple-500" />
          Onboarding Funnel
        </CardTitle>
        <CardDescription>
          {data.with_onboarding} of {data.total_orgs} organisations started onboarding
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Funnel bars */}
          <div className="space-y-3">
            {PHASES.map((phase, i) => {
              const count = data.phases[phase.key];
              const pct = maxPhaseCount > 0
                ? Math.round((count / maxPhaseCount) * 100)
                : 0;
              const dropOff = i > 0
                ? data.phases[PHASES[i - 1].key] - count
                : 0;

              return (
                <div key={phase.key}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">{phase.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600 dark:text-gray-400">{count}</span>
                      {dropOff > 0 && (
                        <span className="text-xs text-red-500">-{dropOff}</span>
                      )}
                    </div>
                  </div>
                  <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${phase.color} rounded-full transition-all duration-700`}
                      style={{ width: `${Math.max(pct, 2)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right: Key metrics */}
          <div className="space-y-4">
            {/* Completion rate */}
            <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
              <div className="text-3xl font-bold text-center">
                {data.completion_rate}%
              </div>
              <p className="text-xs text-center text-gray-500 mt-1">Completion Rate</p>
            </div>

            {/* Status breakdown */}
            <div className="grid grid-cols-3 gap-2">
              <div className="text-center p-2 rounded-lg bg-green-50 dark:bg-green-950/30">
                <CheckCircle className="h-4 w-4 text-green-500 mx-auto mb-1" />
                <div className="text-lg font-semibold">{data.completed}</div>
                <p className="text-xs text-gray-500">Completed</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-blue-50 dark:bg-blue-950/30">
                <Clock className="h-4 w-4 text-blue-500 mx-auto mb-1" />
                <div className="text-lg font-semibold">{data.in_progress}</div>
                <p className="text-xs text-gray-500">In Progress</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-gray-50 dark:bg-gray-800">
                <XCircle className="h-4 w-4 text-gray-400 mx-auto mb-1" />
                <div className="text-lg font-semibold">{data.dismissed}</div>
                <p className="text-xs text-gray-500">Dismissed</p>
              </div>
            </div>

            {/* Conversion + time */}
            <div className="grid grid-cols-2 gap-2">
              <div className="p-3 rounded-lg border border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-1 mb-1">
                  <ArrowRight className="h-3 w-3 text-emerald-500" />
                  <span className="text-xs text-gray-500">Trial → Paid</span>
                </div>
                <div className="text-lg font-semibold">
                  {data.conversion.conversion_rate}%
                </div>
                <p className="text-xs text-gray-500">
                  {data.conversion.paid_count} of {data.conversion.trial_count + data.conversion.paid_count}
                </p>
              </div>
              <div className="p-3 rounded-lg border border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-1 mb-1">
                  <Clock className="h-3 w-3 text-blue-500" />
                  <span className="text-xs text-gray-500">Avg. Time</span>
                </div>
                <div className="text-lg font-semibold">
                  {data.avg_completion_days != null
                    ? `${data.avg_completion_days}d`
                    : "—"}
                </div>
                <p className="text-xs text-gray-500">to complete</p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
