'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowRight, Calculator } from 'lucide-react'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'

interface Calculation {
  material: string
  quantity: number
  unit: string
  formula: string
  climate: number
  water: number
  land: number
  waste: number
  category: string
}

interface CalculationStepsProps {
  calculations: Calculation[]
}

export default function CalculationSteps({ calculations }: CalculationStepsProps) {
  const ingredientCalcs = calculations.filter(c => c.category === 'ingredient' || !c.category)
  const packagingCalcs = calculations.filter(c => c.category !== 'ingredient' && c.category)

  const ingredientTotals = ingredientCalcs.reduce(
    (acc, calc) => ({
      climate: acc.climate + calc.climate,
      water: acc.water + calc.water,
      land: acc.land + calc.land,
      waste: acc.waste + calc.waste,
    }),
    { climate: 0, water: 0, land: 0, waste: 0 }
  )

  const packagingTotals = packagingCalcs.reduce(
    (acc, calc) => ({
      climate: acc.climate + calc.climate,
      water: acc.water + calc.water,
      land: acc.land + calc.land,
      waste: acc.waste + calc.waste,
    }),
    { climate: 0, water: 0, land: 0, waste: 0 }
  )

  const renderCalculationRow = (calc: Calculation, index: number) => (
    <div key={index} className="space-y-3 pb-4 border-b border-slate-200 last:border-0">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="font-semibold text-sm">{calc.material}</p>
          <p className="text-xs text-muted-foreground font-mono">{calc.formula}</p>
        </div>
        <Badge variant="outline" className="text-xs">
          {calc.category === 'ingredient' ? 'Ingredient' : 'Packaging'}
        </Badge>
      </div>

      <div className="grid grid-cols-4 gap-3 text-sm">
        <div className="bg-red-50 p-2 rounded">
          <p className="text-xs text-muted-foreground">Climate</p>
          <p className="font-mono font-semibold text-red-900">
            {calc.climate.toFixed(6)} kg CO₂e
          </p>
        </div>
        <div className="bg-blue-50 p-2 rounded">
          <p className="text-xs text-muted-foreground">Water</p>
          <p className="font-mono font-semibold text-blue-900">
            {calc.water.toFixed(6)} L
          </p>
        </div>
        <div className="bg-green-50 p-2 rounded">
          <p className="text-xs text-muted-foreground">Land</p>
          <p className="font-mono font-semibold text-green-900">
            {calc.land.toFixed(6)} m²
          </p>
        </div>
        <div className="bg-amber-50 p-2 rounded">
          <p className="text-xs text-muted-foreground">Waste</p>
          <p className="font-mono font-semibold text-amber-900">
            {calc.waste.toFixed(6)} kg
          </p>
        </div>
      </div>
    </div>
  )

  const renderSubtotal = (totals: any, label: string) => (
    <div className="bg-slate-100 p-4 rounded-lg">
      <p className="font-semibold text-sm mb-3">{label} Subtotal</p>
      <div className="grid grid-cols-4 gap-3 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Climate</p>
          <p className="font-mono font-bold text-red-700">
            {totals.climate.toFixed(6)} kg CO₂e
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Water</p>
          <p className="font-mono font-bold text-blue-700">
            {totals.water.toFixed(6)} L
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Land</p>
          <p className="font-mono font-bold text-green-700">
            {totals.land.toFixed(6)} m²
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Waste</p>
          <p className="font-mono font-bold text-amber-700">
            {totals.waste.toFixed(6)} kg
          </p>
        </div>
      </div>
    </div>
  )

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Calculator className="h-5 w-5 text-blue-600" />
          <CardTitle>Calculation Steps</CardTitle>
        </div>
        <CardDescription>
          Step-by-step breakdown of impact calculations for each material
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Accordion type="multiple" className="w-full">
          {ingredientCalcs.length > 0 && (
            <AccordionItem value="ingredients">
              <AccordionTrigger className="text-base font-semibold">
                <div className="flex items-center gap-2">
                  <span>Ingredients</span>
                  <Badge variant="secondary">{ingredientCalcs.length} materials</Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 pt-2">
                  {ingredientCalcs.map((calc, index) => renderCalculationRow(calc, index))}
                  {renderSubtotal(ingredientTotals, 'Ingredients')}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          {packagingCalcs.length > 0 && (
            <AccordionItem value="packaging">
              <AccordionTrigger className="text-base font-semibold">
                <div className="flex items-center gap-2">
                  <span>Packaging</span>
                  <Badge variant="secondary">{packagingCalcs.length} materials</Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 pt-2">
                  {packagingCalcs.map((calc, index) => renderCalculationRow(calc, index))}
                  {renderSubtotal(packagingTotals, 'Packaging')}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          <AccordionItem value="aggregation">
            <AccordionTrigger className="text-base font-semibold">
              <div className="flex items-center gap-2">
                <ArrowRight className="h-4 w-4" />
                <span>Final Aggregation</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4 pt-2">
                <div className="bg-blue-50 border-2 border-blue-200 p-4 rounded-lg">
                  <p className="font-semibold text-sm mb-3 text-blue-900">Total Product Impact</p>
                  <div className="grid grid-cols-4 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-blue-700">Climate</p>
                      <p className="font-mono font-bold text-blue-900 text-base">
                        {(ingredientTotals.climate + packagingTotals.climate).toFixed(6)} kg CO₂e
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-blue-700">Water</p>
                      <p className="font-mono font-bold text-blue-900 text-base">
                        {(ingredientTotals.water + packagingTotals.water).toFixed(6)} L
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-blue-700">Land</p>
                      <p className="font-mono font-bold text-blue-900 text-base">
                        {(ingredientTotals.land + packagingTotals.land).toFixed(6)} m²
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-blue-700">Waste</p>
                      <p className="font-mono font-bold text-blue-900 text-base">
                        {(ingredientTotals.waste + packagingTotals.waste).toFixed(6)} kg
                      </p>
                    </div>
                  </div>
                </div>

                <div className="text-sm text-muted-foreground bg-slate-50 p-3 rounded">
                  <p className="font-semibold mb-2">Calculation Formula:</p>
                  <p className="font-mono text-xs">
                    Total Impact = Σ (Material Quantity × Emission Factor)
                  </p>
                  <p className="mt-2 text-xs">
                    Each material's impact is calculated by multiplying its quantity by the relevant
                    emission factor. The total is the sum of all material-level impacts.
                  </p>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  )
}
