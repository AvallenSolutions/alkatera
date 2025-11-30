'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Calculator, Info } from 'lucide-react'
import ProductLCATest from '@/components/dev/calculation-verifier/ProductLCATest'
import CompanyFootprintTest from '@/components/dev/calculation-verifier/CompanyFootprintTest'

export default function CalculationVerifierPage() {
  const [activeTab, setActiveTab] = useState('product-lca')

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-7xl">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Calculator className="h-8 w-8 text-blue-600" />
            <h1 className="text-3xl font-bold tracking-tight">Calculation Verifier</h1>
          </div>
          <p className="text-muted-foreground text-lg">
            Run comprehensive tests on calculation engines with full transparency
          </p>
        </div>
      </div>

      <Alert className="border-blue-200 bg-blue-50">
        <Info className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-900">
          This tool executes standardised calculation tests and displays all inputs, calculation steps,
          and results for complete verification and audit compliance.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Test Suites</CardTitle>
          <CardDescription>
            Select a test type to run comprehensive calculations with detailed breakdowns
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="product-lca" className="text-base">
                Product LCA Test
              </TabsTrigger>
              <TabsTrigger value="company-footprint" className="text-base">
                Company Footprint Test
              </TabsTrigger>
            </TabsList>

            <TabsContent value="product-lca" className="space-y-4">
              <ProductLCATest />
            </TabsContent>

            <TabsContent value="company-footprint" className="space-y-4">
              <CompanyFootprintTest />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
