"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertTriangle,
  Bell,
  CheckCircle,
  Clock,
  Shield,
  TrendingUp,
  Package,
} from "lucide-react";
import type { PlatformAlerts, PlatformStats } from "../types";

interface AlertsPanelProps {
  alerts: PlatformAlerts | null;
  pendingApprovals: PlatformStats["pending_approvals"] | null;
  verificationBacklog: number;
  loading: boolean;
}

export function AlertsPanel({
  alerts,
  pendingApprovals,
  verificationBacklog,
  loading,
}: AlertsPanelProps) {
  if (loading) {
    return <Skeleton className="h-80" />;
  }

  const actionItemCount = alerts
    ? alerts.expiring_trials.length +
      alerts.approaching_limits.length +
      alerts.inactive_orgs.length
    : 0;

  const pendingCount = pendingApprovals
    ? pendingApprovals.activity_data +
      pendingApprovals.facilities +
      pendingApprovals.products +
      pendingApprovals.suppliers
    : 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-amber-500" />
          Alerts & Actions
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="actions">
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="actions" className="text-xs">
              Actions
              {actionItemCount > 0 && (
                <Badge variant="destructive" className="ml-1.5 h-5 min-w-5 text-[10px] px-1.5">
                  {actionItemCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="approvals" className="text-xs">
              Approvals
              {pendingCount > 0 && (
                <Badge variant="secondary" className="ml-1.5 h-5 min-w-5 text-[10px] px-1.5">
                  {pendingCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="verification" className="text-xs">
              Verification
              {verificationBacklog > 0 && (
                <Badge variant="secondary" className="ml-1.5 h-5 min-w-5 text-[10px] px-1.5">
                  {verificationBacklog}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Action Items */}
          <TabsContent value="actions" className="mt-4 space-y-3 max-h-[280px] overflow-y-auto">
            {actionItemCount === 0 ? (
              <div className="flex items-center justify-center py-8 text-gray-500">
                <CheckCircle className="h-5 w-5 mr-2 text-green-500" />
                All clear — no action items
              </div>
            ) : (
              <>
                {/* Expiring trials */}
                {alerts?.expiring_trials.map((trial) => (
                  <Alert key={trial.org_id} className="py-2">
                    <Clock className="h-4 w-4" />
                    <AlertDescription className="ml-2 text-sm">
                      <span className="font-medium">{trial.org_name}</span>
                      {" trial expires in "}
                      <Badge variant="outline" className="text-xs text-amber-600 border-amber-500">
                        {trial.days_remaining}d
                      </Badge>
                    </AlertDescription>
                  </Alert>
                ))}

                {/* Approaching limits */}
                {alerts?.approaching_limits.map((limit) => (
                  <Alert key={limit.org_id} className="py-2">
                    <TrendingUp className="h-4 w-4" />
                    <AlertDescription className="ml-2 text-sm">
                      <span className="font-medium">{limit.org_name}</span>
                      {" at "}
                      <Badge
                        variant="outline"
                        className={`text-xs ${
                          limit.usage_pct >= 100
                            ? "text-red-600 border-red-500"
                            : "text-orange-600 border-orange-500"
                        }`}
                      >
                        {limit.usage_pct}%
                      </Badge>
                      {" of product limit"}
                      <span className="text-gray-500 text-xs ml-1">
                        ({limit.current_products}/{limit.max_products})
                      </span>
                    </AlertDescription>
                  </Alert>
                ))}

                {/* Inactive orgs */}
                {alerts?.inactive_orgs.map((org) => (
                  <Alert key={org.org_id} className="py-2">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription className="ml-2 text-sm">
                      <span className="font-medium">{org.org_name}</span>
                      {" inactive for "}
                      <Badge variant="outline" className="text-xs text-gray-600 border-gray-400">
                        {org.days_inactive}d
                      </Badge>
                    </AlertDescription>
                  </Alert>
                ))}
              </>
            )}
          </TabsContent>

          {/* Pending Approvals */}
          <TabsContent value="approvals" className="mt-4">
            {pendingCount === 0 ? (
              <div className="flex items-center justify-center py-8 text-gray-500">
                <CheckCircle className="h-5 w-5 mr-2 text-green-500" />
                No pending approvals
              </div>
            ) : (
              <div className="space-y-3">
                {[
                  { label: "Activity Data", count: pendingApprovals?.activity_data || 0 },
                  { label: "Facilities", count: pendingApprovals?.facilities || 0 },
                  { label: "Products", count: pendingApprovals?.products || 0 },
                  { label: "Suppliers", count: pendingApprovals?.suppliers || 0 },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between">
                    <span className="text-sm">{item.label}</span>
                    <Badge variant={item.count ? "secondary" : "outline"}>
                      {item.count}
                    </Badge>
                  </div>
                ))}
                <div className="pt-2 border-t">
                  <div className="flex items-center justify-between font-medium">
                    <span>Total Pending</span>
                    <Badge>{pendingCount}</Badge>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          {/* Verification */}
          <TabsContent value="verification" className="mt-4">
            {verificationBacklog === 0 ? (
              <div className="flex items-center justify-center py-8 text-gray-500">
                <CheckCircle className="h-5 w-5 mr-2 text-green-500" />
                No verification backlog
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-amber-500" />
                    <span className="text-sm">Unverified Supplier Products</span>
                  </div>
                  <Badge variant="secondary">{verificationBacklog}</Badge>
                </div>
                <a
                  href="/admin/supplier-verification"
                  className="block text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 underline"
                >
                  Go to verification queue →
                </a>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
