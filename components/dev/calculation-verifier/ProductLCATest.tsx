'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Play, CheckCircle2, XCircle, AlertCircle } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import DataInputsTable from './DataInputsTable'
import CalculationSteps from './CalculationSteps'
import TestResults from './TestResults'
import LogExplorer from './LogExplorer'

interface Material {
  name: string
  quantity: number
  unit: string
  impact_climate: number
  impact_water: number
  impact_land: number
  impact_waste: number
  packaging_category?: string
  lca_sub_stage_id?: string
}

interface TestState {
  status: 'idle' | 'running' | 'success' | 'error'
  message: string
  data?: {
    productLca: any
    materials: Material[]
    calculations: any[]
    results: any
    logs: any[]
  }
}

export default function ProductLCATest() {
  const [testState, setTestState] = useState<TestState>({
    status: 'idle',
    message: '',
  })

  const runTest = async () => {
    setTestState({ status: 'running', message: 'Initialising test...' })

    try {
      setTestState({ status: 'running', message: 'Fetching test product LCA data...' })

      const { data: productLcas, error: lcaError } = await supabase
        .from('product_lcas')
        .select('*')
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (lcaError || !productLcas) {
        throw new Error('No completed product LCAs found. Please create a test LCA first.')
      }

      setTestState({ status: 'running', message: 'Fetching materials and impact data...' })

      const { data: materials, error: materialsError } = await supabase
        .from('product_lca_materials')
        .select('*')
        .eq('product_lca_id', productLcas.id)

      if (materialsError) {
        throw new Error(`Failed to fetch materials: ${materialsError.message}`)
      }

      if (!materials || materials.length === 0) {
        throw new Error('No materials found for this product LCA.')
      }

      setTestState({ status: 'running', message: 'Calculating impacts step-by-step...' })

      const calculations: any[] = []
      let totalClimate = 0
      let totalWater = 0
      let totalLand = 0
      let totalWaste = 0

      materials.forEach((material: any) => {
        const climateImpact = parseFloat(material.impact_climate || '0')
        const waterImpact = parseFloat(material.impact_water || '0')
        const landImpact = parseFloat(material.impact_land || '0')
        const wasteImpact = parseFloat(material.impact_waste || '0')

        totalClimate += climateImpact
        totalWater += waterImpact
        totalLand += landImpact
        totalWaste += wasteImpact

        calculations.push({
          material: material.name,
          quantity: material.quantity,
          unit: material.unit,
          formula: `${material.quantity} ${material.unit} × emission factor`,
          climate: climateImpact,
          water: waterImpact,
          land: landImpact,
          waste: wasteImpact,
          category: material.packaging_category || 'ingredient',
        })
      })

      const results = {
        totalClimate: totalClimate.toFixed(6),
        totalWater: totalWater.toFixed(6),
        totalLand: totalLand.toFixed(6),
        totalWaste: totalWaste.toFixed(6),
        materialCount: materials.length,
        breakdown: {
          ingredients: calculations.filter(c => !c.category || c.category === 'ingredient'),
          packaging: calculations.filter(c => c.category !== 'ingredient'),
        },
      }

      setTestState({ status: 'running', message: 'Fetching calculation logs...' })

      const { data: logs, error: logsError } = await supabase
        .from('product_lca_calculation_logs')
        .select('*')
        .eq('product_lca_id', productLcas.id)
        .order('created_at', { ascending: false })
        .limit(10)

      setTestState({
        status: 'success',
        message: 'Test completed successfully!',
        data: {
          productLca: productLcas,
          materials,
          calculations,
          results,
          logs: logs || [],
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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Product LCA Calculation Test</CardTitle>
          <CardDescription>
            Tests the complete product lifecycle assessment calculation flow from materials to final impacts
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium">Test Scenario</p>
              <p className="text-sm text-muted-foreground">
                Uses the most recent completed product LCA with all materials and impact calculations
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
                  <dt className="text-sm font-medium text-muted-foreground">Product LCA ID</dt>
                  <dd className="text-sm font-mono mt-1">{testState.data.productLca.id}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Status</dt>
                  <dd className="text-sm font-mono mt-1">{testState.data.productLca.status}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Materials Count</dt>
                  <dd className="text-sm font-mono mt-1">{testState.data.materials.length}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Created</dt>
                  <dd className="text-sm font-mono mt-1">
                    {new Date(testState.data.productLca.created_at).toLocaleDateString()}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <DataInputsTable materials={testState.data.materials} />

          <CalculationSteps calculations={testState.data.calculations} />

          <TestResults results={testState.data.results} />

          <LogExplorer logs={testState.data.logs} type="product_lca" />
        </div>
      )}
    </div>
  )
}
