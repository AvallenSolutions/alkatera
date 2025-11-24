'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ClipboardList, Plus } from 'lucide-react'

export default function ProductionPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl lg:text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Production
          </h1>
          <p className="text-sm text-muted-foreground">
            Track volumes to allocate impact
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Log Production
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Volume Logs
          </CardTitle>
          <CardDescription>Record production volumes for impact allocation</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <ClipboardList className="h-12 w-12 text-slate-300 dark:text-slate-700 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Production Logs</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Start tracking production volumes to allocate environmental impact across your products
            </p>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Log
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
