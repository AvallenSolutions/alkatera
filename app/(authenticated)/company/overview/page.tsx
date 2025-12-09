'use client'

import { useEffect, useState } from 'react'
import { useOrganization } from '@/lib/organizationContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Building2, Users, Package, TruckIcon, MapPin, Calendar, Briefcase, FileText, Plus } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { CompanyTimelineWidget } from '@/components/company/CompanyTimelineWidget'
import { TeamDirectory } from '@/components/company/TeamDirectory'
import { IntegrationStatusDashboard } from '@/components/company/IntegrationStatusDashboard'
import { supabase } from '@/lib/supabaseClient'
import Link from 'next/link'

interface CompanyMetrics {
  facilitiesCount: number
  productsCount: number
  suppliersCount: number
  teamCount: number
}

export default function CompanyOverviewPage() {
  const { currentOrganization, isLoading } = useOrganization()
  const [metrics, setMetrics] = useState<CompanyMetrics>({
    facilitiesCount: 0,
    productsCount: 0,
    suppliersCount: 0,
    teamCount: 0,
  })
  const [metricsLoading, setMetricsLoading] = useState(true)

  useEffect(() => {
    if (!currentOrganization) return

    const fetchMetrics = async () => {
      setMetricsLoading(true)

      const [facilities, products, suppliers, team] = await Promise.all([
        supabase
          .from('facilities')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', currentOrganization.id),
        supabase
          .from('products')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', currentOrganization.id),
        supabase
          .from('suppliers')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', currentOrganization.id),
        supabase
          .from('organization_members')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', currentOrganization.id),
      ])

      setMetrics({
        facilitiesCount: facilities.count || 0,
        productsCount: products.count || 0,
        suppliersCount: suppliers.count || 0,
        teamCount: team.count || 0,
      })

      setMetricsLoading(false)
    }

    fetchMetrics()
  }, [currentOrganization])

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-48" />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    )
  }

  if (!currentOrganization) {
    return null
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <div className="space-y-6">
      <Card className="border-2">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-6">
            <Avatar className="h-24 w-24 rounded-lg">
              <AvatarImage src={currentOrganization.logo_url || undefined} alt={currentOrganization.name} />
              <AvatarFallback className="rounded-lg text-2xl">
                {getInitials(currentOrganization.name)}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-3xl font-bold tracking-tight">{currentOrganization.name}</h1>
                  <div className="flex items-center gap-2 mt-2">
                    {currentOrganization.industry_sector && (
                      <Badge variant="secondary">{currentOrganization.industry_sector}</Badge>
                    )}
                    {currentOrganization.company_size && (
                      <Badge variant="outline">{currentOrganization.company_size} employees</Badge>
                    )}
                  </div>
                </div>
              </div>

              {currentOrganization.description && (
                <p className="text-muted-foreground mt-4">{currentOrganization.description}</p>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4 text-sm">
                {currentOrganization.address && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    <span>
                      {currentOrganization.address}
                      {currentOrganization.city && `, ${currentOrganization.city}`}
                      {currentOrganization.country && `, ${currentOrganization.country}`}
                    </span>
                  </div>
                )}
                {currentOrganization.founding_year && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>Founded in {currentOrganization.founding_year}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Building2 className="h-4 w-4" />
                  <span>
                    Established {new Date(currentOrganization.created_at).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Facilities</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {metricsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold">{metrics.facilitiesCount}</div>
                <p className="text-xs text-muted-foreground mt-1">Production sites</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Products</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {metricsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold">{metrics.productsCount}</div>
                <p className="text-xs text-muted-foreground mt-1">Active products</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Suppliers</CardTitle>
            <TruckIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {metricsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold">{metrics.suppliersCount}</div>
                <p className="text-xs text-muted-foreground mt-1">Supply chain partners</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Team Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {metricsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold">{metrics.teamCount}</div>
                <p className="text-xs text-muted-foreground mt-1">People in organisation</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <CompanyTimelineWidget />

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="h-5 w-5" />
                Quick Actions
              </CardTitle>
              <CardDescription>Common tasks and shortcuts</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link href="/company/facilities">
                <Button variant="outline" className="w-full justify-start" size="lg">
                  <Building2 className="mr-2 h-4 w-4" />
                  Manage Facilities
                </Button>
              </Link>
              <Link href="/products/new">
                <Button variant="outline" className="w-full justify-start" size="lg">
                  <Plus className="mr-2 h-4 w-4" />
                  Create New Product
                </Button>
              </Link>
              <Link href="/suppliers/new">
                <Button variant="outline" className="w-full justify-start" size="lg">
                  <TruckIcon className="mr-2 h-4 w-4" />
                  Add Supplier
                </Button>
              </Link>
              <Link href="/reports/company-footprint">
                <Button variant="outline" className="w-full justify-start" size="lg">
                  <FileText className="mr-2 h-4 w-4" />
                  View Reports
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <TeamDirectory />
          <IntegrationStatusDashboard />
        </div>
      </div>
    </div>
  )
}
