"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AlertTriangle, CheckCircle2, Factory, Leaf, TreeDeciduous, Flame } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import type { GHGBreakdown, GHGBreakdownValidation } from "@/lib/types/lca";

interface GHGInventoryBreakdownProps {
  ghgBreakdown: GHGBreakdown | null;
  totalClimate: number;
  validation?: GHGBreakdownValidation;
}

export function GHGInventoryBreakdown({ ghgBreakdown, totalClimate, validation }: GHGInventoryBreakdownProps) {
  if (!ghgBreakdown) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Flame className="h-5 w-5" />
            GHG Inventory
          </CardTitle>
          <CardDescription>
            ISO 14067 compliant greenhouse gas breakdown
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              GHG breakdown not available for this calculation. This feature requires
              materials to be classified by carbon origin.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const { carbon_origin, gas_inventory, gwp_factors } = ghgBreakdown;

  // Prepare data for carbon origin chart
  const carbonOriginData = [
    {
      name: 'Fossil',
      value: carbon_origin.fossil,
      percentage: ((carbon_origin.fossil / totalClimate) * 100).toFixed(1),
      color: '#ef4444', // red
      icon: Factory,
    },
    {
      name: 'Biogenic',
      value: carbon_origin.biogenic,
      percentage: ((carbon_origin.biogenic / totalClimate) * 100).toFixed(1),
      color: '#22c55e', // green
      icon: Leaf,
    },
    {
      name: 'Land Use Change',
      value: carbon_origin.land_use_change,
      percentage: ((carbon_origin.land_use_change / totalClimate) * 100).toFixed(1),
      color: '#f97316', // orange
      icon: TreeDeciduous,
    },
  ];

  // Calculate gas contributions in CO2e
  const ch4CO2e = gas_inventory.methane * gwp_factors.methane_gwp100;
  const n2oCO2e = gas_inventory.nitrous_oxide * gwp_factors.n2o_gwp100;

  const gasInventoryData = [
    {
      gas: 'CO₂ (Fossil)',
      mass: gas_inventory.co2_fossil,
      massUnit: 'kg',
      gwp: 1,
      co2e: gas_inventory.co2_fossil,
      percentage: ((gas_inventory.co2_fossil / totalClimate) * 100).toFixed(2),
    },
    {
      gas: 'CO₂ (Biogenic)',
      mass: gas_inventory.co2_biogenic,
      massUnit: 'kg',
      gwp: 1,
      co2e: gas_inventory.co2_biogenic,
      percentage: ((gas_inventory.co2_biogenic / totalClimate) * 100).toFixed(2),
    },
    {
      gas: 'CH₄ (Methane)',
      mass: gas_inventory.methane,
      massUnit: 'kg',
      gwp: gwp_factors.methane_gwp100,
      co2e: ch4CO2e,
      percentage: ((ch4CO2e / totalClimate) * 100).toFixed(2),
    },
    {
      gas: 'N₂O (Nitrous Oxide)',
      mass: gas_inventory.nitrous_oxide,
      massUnit: 'kg',
      gwp: gwp_factors.n2o_gwp100,
      co2e: n2oCO2e,
      percentage: ((n2oCO2e / totalClimate) * 100).toFixed(2),
    },
    {
      gas: 'F-gases (HFC/PFC)',
      mass: gas_inventory.hfc_pfc,
      massUnit: 'kg CO₂e',
      gwp: 1,
      co2e: gas_inventory.hfc_pfc,
      percentage: ((gas_inventory.hfc_pfc / totalClimate) * 100).toFixed(2),
    },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Flame className="h-5 w-5" />
              GHG Inventory Breakdown
            </CardTitle>
            <CardDescription>
              ISO 14067 compliant greenhouse gas analysis
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Badge variant="outline" className="gap-1">
              {gwp_factors.method}
            </Badge>
            {validation?.is_valid ? (
              <Badge variant="default" className="gap-1 bg-green-600">
                <CheckCircle2 className="h-3 w-3" />
                Validated
              </Badge>
            ) : validation?.warning ? (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="h-3 w-3" />
                Check Required
              </Badge>
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {validation?.warning && (
          <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Validation Warning:</strong> {validation.warning}
              <br />
              <span className="text-sm">
                Expected: {totalClimate.toFixed(4)} kg CO₂e |
                Calculated: {validation.carbon_sum?.toFixed(4)} kg CO₂e |
                Variance: {validation.variance_pct?.toFixed(2)}%
              </span>
            </AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="carbon-origin" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="carbon-origin">Carbon Origins</TabsTrigger>
            <TabsTrigger value="gas-inventory">Gas Inventory</TabsTrigger>
          </TabsList>

          <TabsContent value="carbon-origin" className="space-y-4">
            <Alert>
              <Leaf className="h-4 w-4" />
              <AlertDescription className="text-sm">
                <strong>ISO 14067 Requirement:</strong> Biogenic carbon removals and emissions
                shall be documented separately from fossil sources. Land use change emissions
                (dLUC) are reported independently.
              </AlertDescription>
            </Alert>

            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={carbonOriginData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" label={{ value: 'kg CO₂e', position: 'bottom' }} />
                  <YAxis type="category" dataKey="name" width={150} />
                  <Tooltip
                    formatter={(value: number) => `${value.toFixed(4)} kg CO₂e`}
                    labelFormatter={(label) => `${label} Carbon`}
                  />
                  <Legend />
                  <Bar dataKey="value" name="CO₂e Emissions">
                    {carbonOriginData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-3 gap-4">
              {carbonOriginData.map((origin) => {
                const Icon = origin.icon;
                return (
                  <Card key={origin.name}>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-3">
                        <div className="rounded-full p-2" style={{ backgroundColor: `${origin.color}20` }}>
                          <Icon className="h-5 w-5" style={{ color: origin.color }} />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">{origin.name}</p>
                          <p className="text-2xl font-bold">
                            {origin.value.toFixed(3)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            kg CO₂e ({origin.percentage}%)
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <Alert>
              <AlertDescription className="text-xs">
                <strong>Note:</strong> Biogenic CO₂ represents carbon that was recently
                captured from the atmosphere through photosynthesis. Per ISO 14067, it is
                reported separately but may be climate-neutral over short time periods
                (depending on regeneration rates).
              </AlertDescription>
            </Alert>
          </TabsContent>

          <TabsContent value="gas-inventory" className="space-y-4">
            <Alert>
              <Flame className="h-4 w-4" />
              <AlertDescription className="text-sm">
                <strong>GHG Protocol Requirement:</strong> Report emissions by gas type using
                IPCC 100-year Global Warming Potential (GWP) factors to convert to CO₂ equivalents.
              </AlertDescription>
            </Alert>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Greenhouse Gas</TableHead>
                  <TableHead className="text-right">Mass</TableHead>
                  <TableHead className="text-right">GWP-100</TableHead>
                  <TableHead className="text-right">CO₂e</TableHead>
                  <TableHead className="text-right">% of Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {gasInventoryData.map((gas) => (
                  <TableRow key={gas.gas}>
                    <TableCell className="font-medium">{gas.gas}</TableCell>
                    <TableCell className="text-right font-mono">
                      {gas.mass.toFixed(6)} {gas.massUnit}
                    </TableCell>
                    <TableCell className="text-right">{gas.gwp}</TableCell>
                    <TableCell className="text-right font-mono">
                      {gas.co2e.toFixed(4)} kg
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="secondary">{gas.percentage}%</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">
                      Total GHG Emissions
                    </p>
                    <p className="text-3xl font-bold">
                      {totalClimate.toFixed(4)}
                    </p>
                    <p className="text-xs text-muted-foreground">kg CO₂e</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">
                      GWP Method
                    </p>
                    <p className="text-2xl font-bold">{gwp_factors.method}</p>
                    <p className="text-xs text-muted-foreground">
                      CH₄: {gwp_factors.methane_gwp100} | N₂O: {gwp_factors.n2o_gwp100}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
