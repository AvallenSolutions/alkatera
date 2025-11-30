'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Database } from 'lucide-react'

interface Material {
  name: string
  quantity: number
  unit: string
  impact_climate: number
  impact_water: number
  impact_land: number
  impact_waste: number
  packaging_category?: string
  impact_source?: string
}

interface DataInputsTableProps {
  materials: Material[]
}

export default function DataInputsTable({ materials }: DataInputsTableProps) {
  const getDataSourceBadge = (source?: string) => {
    if (!source || source === 'secondary_modelled' || source === 'secondary') {
      return <Badge variant="secondary" className="bg-blue-100 text-blue-800">Secondary</Badge>
    }
    if (source === 'primary') {
      return <Badge variant="secondary" className="bg-green-100 text-green-800">Primary</Badge>
    }
    return <Badge variant="secondary" className="bg-amber-100 text-amber-800">Modelled</Badge>
  }

  const getCategoryBadge = (category?: string) => {
    if (!category) {
      return <Badge variant="outline">Ingredient</Badge>
    }
    if (category === 'container') {
      return <Badge variant="outline" className="bg-purple-50">Container</Badge>
    }
    if (category === 'closure') {
      return <Badge variant="outline" className="bg-orange-50">Closure</Badge>
    }
    if (category === 'label') {
      return <Badge variant="outline" className="bg-yellow-50">Label</Badge>
    }
    return <Badge variant="outline">{category}</Badge>
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5 text-blue-600" />
          <CardTitle>Input Data - Material Inventory</CardTitle>
        </div>
        <CardDescription>
          All materials and their associated emission factors used in the calculation
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Material Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead className="text-right">Climate<br />(kg CO₂e)</TableHead>
                <TableHead className="text-right">Water<br />(L)</TableHead>
                <TableHead className="text-right">Land<br />(m²)</TableHead>
                <TableHead className="text-right">Waste<br />(kg)</TableHead>
                <TableHead>Data Source</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {materials.map((material, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">{material.name}</TableCell>
                  <TableCell>{getCategoryBadge(material.packaging_category)}</TableCell>
                  <TableCell className="text-right font-mono">{material.quantity}</TableCell>
                  <TableCell className="font-mono">{material.unit}</TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {parseFloat(material.impact_climate?.toString() || '0').toFixed(6)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {parseFloat(material.impact_water?.toString() || '0').toFixed(6)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {parseFloat(material.impact_land?.toString() || '0').toFixed(6)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {parseFloat(material.impact_waste?.toString() || '0').toFixed(6)}
                  </TableCell>
                  <TableCell>{getDataSourceBadge(material.impact_source)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="bg-blue-100 text-blue-800">Secondary</Badge>
            <span>Database emission factors</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="bg-green-100 text-green-800">Primary</Badge>
            <span>Measured data</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
