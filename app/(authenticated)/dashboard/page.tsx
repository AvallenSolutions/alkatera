"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useOrganization } from "@/lib/organizationContext"
import {
  KPISnapshotWidget,
  GHGEmissionsSummaryWidget,
  RecentActivityWidget,
  ActionItemsWidget,
  SupplierEngagementWidget,
} from "@/components/dashboard/widgets"
import { PageLoader } from "@/components/ui/page-loader"

export default function DashboardPage() {
  const router = useRouter()
  const { organizations, isLoading } = useOrganization()

  useEffect(() => {
    if (!isLoading && organizations.length === 0) {
      router.push('/create-organization')
    }
  }, [organizations, isLoading, router])

  if (isLoading) {
    return <PageLoader />
  }

  if (organizations.length === 0) {
    return null
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl lg:text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Dashboard
        </h1>
        <p className="text-sm text-muted-foreground">
          Overview of your carbon management metrics
        </p>
      </div>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-4">
        <KPISnapshotWidget />

        <GHGEmissionsSummaryWidget />

        <SupplierEngagementWidget />

        <RecentActivityWidget />

        <ActionItemsWidget />
      </div>
    </div>
  )
}
