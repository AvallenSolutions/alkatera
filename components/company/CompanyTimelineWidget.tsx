'use client'

import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Building2, Package, Users, Calendar } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useOrganization } from '@/lib/organizationContext'
import { format } from 'date-fns'

interface TimelineEvent {
  id: string
  type: 'organization' | 'facility' | 'product' | 'supplier'
  title: string
  description: string
  date: Date
  icon: React.ComponentType<{ className?: string }>
}

export function CompanyTimelineWidget() {
  const { currentOrganization } = useOrganization()
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!currentOrganization) return

    const fetchTimelineEvents = async () => {
      setIsLoading(true)
      const timelineEvents: TimelineEvent[] = []

      timelineEvents.push({
        id: 'org-created',
        type: 'organization',
        title: 'Company Founded',
        description: `${currentOrganization.name} was established`,
        date: new Date(currentOrganization.created_at),
        icon: Building2,
      })

      const { data: facilities } = await supabase
        .from('facilities')
        .select('id, name, created_at')
        .eq('organization_id', currentOrganization.id)
        .order('created_at', { ascending: true })
        .limit(1)

      if (facilities && facilities.length > 0) {
        const firstFacility = facilities[0]
        timelineEvents.push({
          id: `facility-${firstFacility.id}`,
          type: 'facility',
          title: 'First Facility Added',
          description: firstFacility.name,
          date: new Date(firstFacility.created_at),
          icon: Building2,
        })
      }

      const { data: products } = await supabase
        .from('products')
        .select('id, name, created_at')
        .eq('organization_id', currentOrganization.id)
        .order('created_at', { ascending: true })
        .limit(1)

      if (products && products.length > 0) {
        const firstProduct = products[0]
        timelineEvents.push({
          id: `product-${firstProduct.id}`,
          type: 'product',
          title: 'First Product Created',
          description: firstProduct.name,
          date: new Date(firstProduct.created_at),
          icon: Package,
        })
      }

      const { data: suppliers } = await supabase
        .from('suppliers')
        .select('id, name, created_at')
        .eq('organization_id', currentOrganization.id)
        .order('created_at', { ascending: true })
        .limit(1)

      if (suppliers && suppliers.length > 0) {
        const firstSupplier = suppliers[0]
        timelineEvents.push({
          id: `supplier-${firstSupplier.id}`,
          type: 'supplier',
          title: 'First Supplier Connected',
          description: firstSupplier.name,
          date: new Date(firstSupplier.created_at),
          icon: Users,
        })
      }

      timelineEvents.sort((a, b) => b.date.getTime() - a.date.getTime())

      setEvents(timelineEvents)
      setIsLoading(false)
    }

    fetchTimelineEvents()
  }, [currentOrganization])

  const getEventColor = (type: string) => {
    switch (type) {
      case 'organization':
        return 'bg-blue-500'
      case 'facility':
        return 'bg-green-500'
      case 'product':
        return 'bg-orange-500'
      case 'supplier':
        return 'bg-purple-500'
      default:
        return 'bg-gray-500'
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Company Timeline
          </CardTitle>
          <CardDescription>Key milestones in your journey</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-4 animate-pulse">
                <div className="h-10 w-10 rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-3/4 rounded bg-muted" />
                  <div className="h-3 w-1/2 rounded bg-muted" />
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
          <Calendar className="h-5 w-5" />
          Company Timeline
        </CardTitle>
        <CardDescription>Key milestones in your journey</CardDescription>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No milestones yet. Start by adding facilities, products, or suppliers.</p>
        ) : (
          <div className="relative space-y-6">
            <div className="absolute left-5 top-2 bottom-2 w-0.5 bg-border" />
            {events.map((event, index) => {
              const Icon = event.icon
              return (
                <div key={event.id} className="relative flex gap-4">
                  <div className={`relative z-10 flex h-10 w-10 items-center justify-center rounded-full ${getEventColor(event.type)}`}>
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1 pt-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold">{event.title}</h4>
                      <Badge variant="outline" className="text-xs">
                        {format(event.date, 'MMM d, yyyy')}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">{event.description}</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
