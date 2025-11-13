'use client'

import { useOrganization } from '@/lib/organizationContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Building2, Users, Calendar, Globe } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'

export default function CompanyOverviewPage() {
  const { currentOrganization, isLoading } = useOrganization()

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    )
  }

  if (!currentOrganization) {
    return null
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Company Overview</h1>
        <p className="text-muted-foreground mt-2">
          View and manage your organisation details
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-centre justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Organisation Name</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{currentOrganization.name}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Slug: {currentOrganization.slug}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-centre justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Created</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Date(currentOrganization.created_at).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Organisation established
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-centre justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Quick Links</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <a
                href="/dashboard/settings/team"
                className="block text-sm text-blue-600 hover:underline"
              >
                Manage Team
              </a>
              <a
                href="/company/facilities"
                className="block text-sm text-blue-600 hover:underline"
              >
                View Facilities
              </a>
              <a
                href="/dashboard/settings/profile"
                className="block text-sm text-blue-600 hover:underline"
              >
                Profile Settings
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
