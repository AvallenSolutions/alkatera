'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FileText, Download } from 'lucide-react'
import Link from 'next/link'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl lg:text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Reports
          </h1>
          <p className="text-sm text-muted-foreground">
            View and download sustainability and product reports
          </p>
        </div>
      </div>

      <Tabs defaultValue="corporate" className="space-y-4">
        <TabsList>
          <TabsTrigger value="corporate">Corporate</TabsTrigger>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="supply-chain">Supply Chain</TabsTrigger>
        </TabsList>

        <TabsContent value="corporate" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Operations Reports
              </CardTitle>
              <CardDescription>
                Corporate carbon footprint and operational emissions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="h-12 w-12 text-slate-300 dark:text-slate-700 mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Reports Available</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Add operational data to generate your first corporate emissions report
                </p>
                <Button asChild>
                  <Link href="/operations">Go to Operations</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="products" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Product Environmental Impact Reports
              </CardTitle>
              <CardDescription>
                Environmental impact assessments for your products
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="h-12 w-12 text-slate-300 dark:text-slate-700 mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Product Reports</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Create products and complete LCAs to generate product reports
                </p>
                <Button asChild>
                  <Link href="/products">Go to Products</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="supply-chain" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Supply Chain Reports
              </CardTitle>
              <CardDescription>
                Value chain emissions and supplier engagement
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="h-12 w-12 text-slate-300 dark:text-slate-700 mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Supply Chain Data</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Add supplier data to track supply chain emissions
                </p>
                <Button asChild>
                  <Link href="/settings">Manage Suppliers</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
