"use client"

import {
  GettingStartedWidget,
  RecentActivityWidget,
  ActionItemsWidget,
  SupplierEngagementWidget,
} from "@/components/dashboard/widgets"

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl lg:text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Dashboard
        </h1>
        <p className="text-sm text-muted-foreground">
          Welcome to your carbon management platform
        </p>
      </div>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-4">
        <GettingStartedWidget />

        <SupplierEngagementWidget />

        <RecentActivityWidget />

        <ActionItemsWidget />
      </div>
    </div>
  )
}
