'use client'

import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CheckCircle2, XCircle, AlertCircle, Settings, ExternalLink } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useOrganization } from '@/lib/organizationContext'
import Link from 'next/link'

interface IntegrationStatus {
  id: string
  name: string
  description: string
  status: 'active' | 'inactive' | 'partial'
  count?: number
  href?: string
}

export function IntegrationStatusDashboard() {
  const { currentOrganization } = useOrganization()
  const [integrations, setIntegrations] = useState<IntegrationStatus[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!currentOrganization) return

    const fetchIntegrationStatus = async () => {
      setIsLoading(true)
      const statuses: IntegrationStatus[] = []

      const { data: facilities, error: facilitiesError } = await supabase
        .from('facilities')
        .select('id', { count: 'exact' })
        .eq('organization_id', currentOrganization.id)

      statuses.push({
        id: 'facilities',
        name: 'Facilities',
        description: 'Production and operational sites',
        status: facilities && facilities.length > 0 ? 'active' : 'inactive',
        count: facilities?.length || 0,
        href: '/company/facilities',
      })

      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('id', { count: 'exact' })
        .eq('organization_id', currentOrganization.id)

      statuses.push({
        id: 'products',
        name: 'Products',
        description: 'Product catalogue and LCAs',
        status: products && products.length > 0 ? 'active' : 'inactive',
        count: products?.length || 0,
        href: '/products',
      })

      const { data: suppliers, error: suppliersError } = await supabase
        .from('suppliers')
        .select('id', { count: 'exact' })
        .eq('organization_id', currentOrganization.id)

      statuses.push({
        id: 'suppliers',
        name: 'Suppliers',
        description: 'Supply chain network',
        status: suppliers && suppliers.length > 0 ? 'active' : 'inactive',
        count: suppliers?.length || 0,
        href: '/suppliers',
      })

      const { data: activityData, error: activityError } = await supabase
        .from('activity_data')
        .select('id', { count: 'exact' })
        .eq('organization_id', currentOrganization.id)

      statuses.push({
        id: 'emissions',
        name: 'Emissions Tracking',
        description: 'Scope 1, 2 & 3 data',
        status: activityData && activityData.length > 0 ? 'active' : 'inactive',
        count: activityData?.length || 0,
        href: '/data/scope-1-2',
      })

      const { data: openLCAConfig } = await supabase
        .from('openlca_configurations')
        .select('id')
        .eq('organization_id', currentOrganization.id)
        .maybeSingle()

      statuses.push({
        id: 'openlca',
        name: 'OpenLCA Integration',
        description: 'Life cycle assessment database',
        status: openLCAConfig ? 'active' : 'inactive',
        href: '/products',
      })

      const { data: productionLogs } = await supabase
        .from('production_logs')
        .select('id', { count: 'exact' })
        .eq('organization_id', currentOrganization.id)

      statuses.push({
        id: 'production',
        name: 'Production Tracking',
        description: 'Manufacturing output logs',
        status: productionLogs && productionLogs.length > 0 ? 'active' : 'inactive',
        count: productionLogs?.length || 0,
        href: '/production',
      })

      setIntegrations(statuses)
      setIsLoading(false)
    }

    fetchIntegrationStatus()
  }, [currentOrganization])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />
      case 'partial':
        return <AlertCircle className="h-4 w-4 text-amber-500" />
      case 'inactive':
        return <XCircle className="h-4 w-4 text-muted-foreground" />
      default:
        return null
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500/10 text-green-700 hover:bg-green-500/20">Active</Badge>
      case 'partial':
        return <Badge className="bg-amber-500/10 text-amber-700 hover:bg-amber-500/20">Partial</Badge>
      case 'inactive':
        return <Badge variant="outline" className="text-muted-foreground">Not Set Up</Badge>
      default:
        return null
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Integration Status
          </CardTitle>
          <CardDescription>System configuration overview</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <div className="h-10 w-10 rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-32 rounded bg-muted" />
                  <div className="h-3 w-48 rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Integration Status
        </CardTitle>
        <CardDescription>System configuration overview</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {integrations.map((integration) => (
            <div
              key={integration.id}
              className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                {getStatusIcon(integration.status)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-sm">{integration.name}</h4>
                  {getStatusBadge(integration.status)}
                  {integration.count !== undefined && integration.count > 0 && (
                    <span className="text-xs text-muted-foreground">({integration.count})</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{integration.description}</p>
              </div>
              {integration.href && (
                <Link href={integration.href}>
                  <Button variant="ghost" size="sm">
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </Link>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
