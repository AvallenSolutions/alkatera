'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Loader2, Play, CheckCircle2, XCircle, AlertCircle, Building2, Zap, ShoppingBag } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import LogExplorer from './LogExplorer'

interface ScopeResult {
  scope: string
  category: string
  activityType: string
  quantity: number
  unit: string
  emissionFactor: number
  emissions: number
  formula: string
}

interface TestState {
  status: 'idle' | 'running' | 'success' | 'error'
  message: string
  data?: {
    facility: any
    activityData: any[]
    calculations: ScopeResult[]
    totals: {
      scope1: number
      scope2: number
      scope3: number
      total: number
    }
    logs: any[]
  }
}

export default function CompanyFootprintTest() {
  const [testState, setTestState] = useState<TestState>({
    status: 'idle',
    message: '',
  })

  const runTest = async () => {
    setTestState({ status: 'running', message: 'Initialising company footprint test...' })

    try {
      setTestState({ status: 'running', message: 'Fetching facility data...' })

      const { data: facilities, error: facilityError } = await supabase
        .from('facilities')
        .select('*')
        .limit(1)
        .single()

      if (facilityError || !facilities) {
        throw new Error('No facilities found. Please create a test facility first.')
      }

      setTestState({ status: 'running', message: 'Fetching activity data with emission factors...' })

      const { data: activityData, error: activityError } = await supabase
        .from('facility_activity_data')
        .select(`
          *,
          emission_source:scope_1_2_emission_sources(
            scope,
            category,
            source_name,
            emission_factor_co2e,
            unit
          )
        `)
        .eq('facility_id', facilities.id)
        .limit(50)

      if (activityError) {
        console.warn('No facility activity data found, will check corporate overheads:', activityError.message)
      }

      setTestState({ status: 'running', message: 'Fetching corporate overhead data (Scope 3)...' })

      const { data: corporateData, error: corporateError } = await supabase
        .from('corporate_overheads')
        .select('*')
        .eq('organization_id', facilities.organization_id)
        .limit(50)

      if (corporateError) {
        console.warn('No corporate overhead data found:', corporateError.message)
      }

      setTestState({ status: 'running', message: 'Calculating Scope 1, 2, and 3 emissions...' })

      const calculations: ScopeResult[] = []
      let scope1Total = 0
      let scope2Total = 0
      let scope3Total = 0

      if (activityData && activityData.length > 0) {
        activityData.forEach((activity: any) => {
          const quantity = parseFloat(activity.quantity || '0')
          const emissionFactor = parseFloat(activity.emission_source?.emission_factor_co2e || '0')
          const emissions = quantity * emissionFactor

          const scope = activity.emission_source?.scope === 'scope_1' ? 'Scope 1' : 'Scope 2'
          const category = activity.emission_source?.source_name || 'Unknown'

          if (scope === 'Scope 1') {
            scope1Total += emissions
          } else {
            scope2Total += emissions
          }

          calculations.push({
            scope,
            category,
            activityType: activity.emission_source?.source_name || 'N/A',
            quantity,
            unit: activity.unit || 'unit',
            emissionFactor,
            emissions,
            formula: `${quantity.toLocaleString()} ${activity.unit} × ${emissionFactor.toFixed(5)} kg CO₂e/${activity.unit} = ${emissions.toFixed(2)} kg CO₂e`,
          })
        })
      }

      if (corporateData && corporateData.length > 0) {
        const scope3FactorMap: Record<string, number> = {
          'landfill': 0.54,
          'recycling': 0.021,
          'flights_short_haul_economy': 0.24587,
          'flights_long_haul_economy': 0.19085,
          'rail_national': 0.03549,
          'car_average': 0.17078,
          'car_diesel': 0.17078,
          'car_petrol': 0.18254,
        }

        corporateData.forEach((overhead: any) => {
          const quantity = parseFloat(overhead.quantity || '0')
          const emissionFactor = scope3FactorMap[overhead.sub_category] || 0.1
          const emissions = quantity * emissionFactor

          scope3Total += emissions

          const categoryName = overhead.category
            .replace('scope_3_cat_', 'Category ')
            .replace('_', ' ')
            .split(' ')
            .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ')

          calculations.push({
            scope: 'Scope 3',
            category: categoryName,
            activityType: overhead.description || overhead.sub_category,
            quantity,
            unit: overhead.unit || 'unit',
            emissionFactor,
            emissions,
            formula: `${quantity.toLocaleString()} ${overhead.unit} × ${emissionFactor.toFixed(5)} kg CO₂e/${overhead.unit} = ${emissions.toFixed(2)} kg CO₂e`,
          })
        })
      }

      if (calculations.length === 0) {
        throw new Error(
          'No activity data or corporate overhead data found. Please run the seed-calculation-verifier-test-data.sql script first.'
        )
      }

      const totals = {
        scope1: scope1Total,
        scope2: scope2Total,
        scope3: scope3Total,
        total: scope1Total + scope2Total + scope3Total,
      }

      setTestState({ status: 'running', message: 'Fetching calculation logs...' })

      let logs: any[] = []
      try {
        const { data: logsData, error: logsError } = await supabase
          .from('calculation_logs')
          .select('*')
          .eq('organization_id', facilities.organization_id)
          .order('created_at', { ascending: false })
          .limit(10)

        if (!logsError && logsData) {
          logs = logsData
        } else {
          console.warn('Could not fetch calculation logs:', logsError?.message)
        }
      } catch (logError) {
        console.warn('Error fetching logs, continuing without them:', logError)
      }

      setTestState({
        status: 'success',
        message: 'Company footprint test completed successfully!',
        data: {
          facility: facilities,
          activityData: activityData || [],
          calculations,
          totals,
          logs,
        },
      })
    } catch (error: any) {
      setTestState({
        status: 'error',
        message: error.message || 'An unexpected error occurred',
      })
    }
  }

  const getStatusIcon = () => {
    switch (testState.status) {
      case 'running':
        return <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
      case 'success':
        return <CheckCircle2 className="h-5 w-5 text-green-600" />
      case 'error':
        return <XCircle className="h-5 w-5 text-red-600" />
      default:
        return <AlertCircle className="h-5 w-5 text-slate-400" />
    }
  }

  const getStatusColor = () => {
    switch (testState.status) {
      case 'running':
        return 'border-blue-200 bg-blue-50'
      case 'success':
        return 'border-green-200 bg-green-50'
      case 'error':
        return 'border-red-200 bg-red-50'
      default:
        return 'border-slate-200 bg-slate-50'
    }
  }

  const scope1Calcs = testState.data?.calculations.filter(c => c.scope === 'Scope 1') || []
  const scope2Calcs = testState.data?.calculations.filter(c => c.scope === 'Scope 2') || []
  const scope3Calcs = testState.data?.calculations.filter(c => c.scope === 'Scope 3') || []

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Company Carbon Footprint Test</CardTitle>
          <CardDescription>
            Tests complete corporate GHG inventory calculations across Scope 1, 2, and 3 emissions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium">Test Scenario</p>
              <p className="text-sm text-muted-foreground">
                Calculates emissions from facility operations, energy use, and value chain activities
              </p>
            </div>
            <Button
              onClick={runTest}
              disabled={testState.status === 'running'}
              size="lg"
              className="gap-2"
            >
              {testState.status === 'running' ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Running Test...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Run Test
                </>
              )}
            </Button>
          </div>

          {testState.message && (
            <Alert className={getStatusColor()}>
              {getStatusIcon()}
              <AlertDescription className="ml-2">
                {testState.message}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {testState.data && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Test Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Facility</dt>
                  <dd className="text-sm font-mono mt-1">{testState.data.facility.name}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Location</dt>
                  <dd className="text-sm font-mono mt-1">
                    {testState.data.facility.location_city}, {testState.data.facility.location_country_code}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Activity Records</dt>
                  <dd className="text-sm font-mono mt-1">{testState.data.calculations.length}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Total Emissions</dt>
                  <dd className="text-sm font-mono mt-1">{testState.data.totals.total.toFixed(2)} kg CO₂e</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>GHG Protocol Scope Breakdown</CardTitle>
              <CardDescription>
                Emissions categorised by scope according to the GHG Protocol Corporate Standard
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <Card className="border-2 border-red-200 bg-red-50">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Building2 className="h-4 w-4 text-red-700" />
                      <p className="text-xs font-medium text-red-700">Scope 1</p>
                    </div>
                    <p className="text-2xl font-bold text-red-900">
                      {testState.data.totals.scope1.toFixed(2)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">kg CO₂e</p>
                    <Badge variant="outline" className="mt-2 text-xs">
                      {scope1Calcs.length} activities
                    </Badge>
                  </CardContent>
                </Card>

                <Card className="border-2 border-orange-200 bg-orange-50">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Zap className="h-4 w-4 text-orange-700" />
                      <p className="text-xs font-medium text-orange-700">Scope 2</p>
                    </div>
                    <p className="text-2xl font-bold text-orange-900">
                      {testState.data.totals.scope2.toFixed(2)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">kg CO₂e</p>
                    <Badge variant="outline" className="mt-2 text-xs">
                      {scope2Calcs.length} activities
                    </Badge>
                  </CardContent>
                </Card>

                <Card className="border-2 border-blue-200 bg-blue-50">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <ShoppingBag className="h-4 w-4 text-blue-700" />
                      <p className="text-xs font-medium text-blue-700">Scope 3</p>
                    </div>
                    <p className="text-2xl font-bold text-blue-900">
                      {testState.data.totals.scope3.toFixed(2)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">kg CO₂e</p>
                    <Badge variant="outline" className="mt-2 text-xs">
                      {scope3Calcs.length} activities
                    </Badge>
                  </CardContent>
                </Card>
              </div>

              <Card className="border-slate-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Total Company Emissions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold">{testState.data.totals.total.toFixed(2)}</span>
                    <span className="text-lg text-muted-foreground">kg CO₂e</span>
                  </div>
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Scope 1 ({((testState.data.totals.scope1 / testState.data.totals.total) * 100).toFixed(1)}%)</span>
                      <span className="font-mono">{testState.data.totals.scope1.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span>Scope 2 ({((testState.data.totals.scope2 / testState.data.totals.total) * 100).toFixed(1)}%)</span>
                      <span className="font-mono">{testState.data.totals.scope2.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span>Scope 3 ({((testState.data.totals.scope3 / testState.data.totals.total) * 100).toFixed(1)}%)</span>
                      <span className="font-mono">{testState.data.totals.scope3.toFixed(2)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Detailed Calculations by Scope</CardTitle>
              <CardDescription>
                Step-by-step breakdown showing emission factors and formulas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Scope</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Activity</TableHead>
                      <TableHead className="text-right">Factor</TableHead>
                      <TableHead className="text-right">Emissions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {testState.data.calculations.map((calc, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <Badge variant={calc.scope === 'Scope 1' ? 'destructive' : calc.scope === 'Scope 2' ? 'default' : 'secondary'}>
                            {calc.scope}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{calc.category}</TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {calc.quantity} {calc.unit}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {calc.emissionFactor} kg CO₂e/{calc.unit}
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold">
                          {calc.emissions.toFixed(2)} kg CO₂e
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="mt-4 text-sm text-muted-foreground bg-slate-50 border border-slate-200 p-3 rounded">
                <p className="font-semibold mb-2">Calculation Formula:</p>
                <p className="font-mono text-xs">
                  Emissions = Activity Data × Emission Factor
                </p>
                <p className="mt-2 text-xs">
                  Each emission source is multiplied by its relevant emission factor from DEFRA 2025 or EPA databases.
                  Results are aggregated by scope to provide the complete corporate carbon footprint.
                </p>
              </div>
            </CardContent>
          </Card>

          <LogExplorer logs={testState.data.logs} type="corporate" />
        </div>
      )}
    </div>
  )
}
