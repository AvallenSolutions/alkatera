import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart3, Leaf, Package, FlaskConical, AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { ScopeBreakdown } from '@/hooks/data/useCompanyMetrics';
import { MaterialBreakdownItem, GHGBreakdown } from './CarbonBreakdownSheet';

interface CarbonDeepDiveProps {
  scopeBreakdown: ScopeBreakdown | null;
  totalCO2: number;
  materialBreakdown?: MaterialBreakdownItem[];
  ghgBreakdown?: GHGBreakdown | null;
}

export function CarbonDeepDive({ scopeBreakdown, totalCO2, materialBreakdown, ghgBreakdown }: CarbonDeepDiveProps) {
  const [sortBy, setSortBy] = useState<'impact' | 'name' | 'quantity'>('impact');

  // Check if we have any data to display
  const hasData = scopeBreakdown || (materialBreakdown && materialBreakdown.length > 0) || ghgBreakdown;

  if (!hasData) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-sm font-medium">No carbon breakdown data available</p>
          <p className="text-xs mt-2">
            Complete an LCA calculation to see detailed GHG emissions analysis
          </p>
        </CardContent>
      </Card>
    );
  }

  // Sort materials
  const sortedMaterials = materialBreakdown ? [...materialBreakdown].sort((a, b) => {
    if (sortBy === 'impact') return b.climate - a.climate;
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    if (sortBy === 'quantity') return b.quantity - a.quantity;
    return 0;
  }) : [];

  // Calculate percentages
  const materialsWithPercentage = sortedMaterials.map(m => ({
    ...m,
    percentage: totalCO2 > 0 ? (m.climate / totalCO2) * 100 : 0,
  }));

  // Separate ingredients from packaging
  const ingredients = materialsWithPercentage.filter(m =>
    !m.name.toLowerCase().includes('bottle') &&
    !m.name.toLowerCase().includes('cap') &&
    !m.name.toLowerCase().includes('label') &&
    !m.name.toLowerCase().includes('packaging')
  );

  const packaging = materialsWithPercentage.filter(m =>
    m.name.toLowerCase().includes('bottle') ||
    m.name.toLowerCase().includes('cap') ||
    m.name.toLowerCase().includes('label') ||
    m.name.toLowerCase().includes('packaging')
  );

  const ingredientsTotal = ingredients.reduce((sum, m) => sum + m.climate, 0);
  const packagingTotal = packaging.reduce((sum, m) => sum + m.climate, 0);

  const getDataSourceBadge = (source?: string) => {
    const config: Record<string, { label: string; className: string }> = {
      primary: { label: 'Primary Data', className: 'bg-green-600' },
      secondary_modelled: { label: 'Secondary', className: 'bg-blue-600' },
      secondary: { label: 'Secondary', className: 'bg-blue-600' },
      missing: { label: 'Missing Data', className: 'bg-red-600' },
      modelled: { label: 'Modelled', className: 'bg-amber-600' },
    };

    const badgeConfig = config[source || 'secondary_modelled'] || config.secondary_modelled;
    return <Badge variant="default" className={`${badgeConfig.className} text-xs`}>{badgeConfig.label}</Badge>;
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="ghg" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="ghg">GHG Inventory</TabsTrigger>
          <TabsTrigger value="materials">Material Breakdown</TabsTrigger>
          <TabsTrigger value="origin">Carbon Origin</TabsTrigger>
        </TabsList>

        {/* GHG Gas Inventory Tab */}
        <TabsContent value="ghg" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FlaskConical className="h-5 w-5 text-orange-600" />
                  <CardTitle className="text-lg">Greenhouse Gas Inventory</CardTitle>
                </div>
                <div className="flex gap-2">
                  <Badge variant="outline" className="text-xs">ISO 14067</Badge>
                  <Badge variant="outline" className="text-xs">GHG Protocol</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {ghgBreakdown ? (
                <>
                  {/* Summary Cards */}
                  <div className="grid grid-cols-3 gap-4">
                    <Card className="bg-orange-50 border-orange-200">
                      <CardContent className="p-4">
                        <div className="flex items-baseline gap-2">
                          <span className="text-2xl font-bold text-orange-900">
                            {totalCO2.toLocaleString('en-GB', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                          </span>
                          <span className="text-xs text-muted-foreground">kg CO₂eq</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Total GHG Emissions</p>
                      </CardContent>
                    </Card>

                    <Card className="bg-blue-50 border-blue-200">
                      <CardContent className="p-4">
                        <div className="flex items-baseline gap-2">
                          <span className="text-2xl font-bold text-blue-900">
                            {ghgBreakdown.gwp_factors.methane_gwp100}
                          </span>
                          <span className="text-xs text-muted-foreground">GWP</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">CH₄ Factor (100-year)</p>
                      </CardContent>
                    </Card>

                    <Card className="bg-blue-50 border-blue-200">
                      <CardContent className="p-4">
                        <div className="flex items-baseline gap-2">
                          <span className="text-2xl font-bold text-blue-900">
                            {ghgBreakdown.gwp_factors.n2o_gwp100}
                          </span>
                          <span className="text-xs text-muted-foreground">GWP</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">N₂O Factor (100-year)</p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Gas Inventory Table */}
                  <div>
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <Info className="h-4 w-4" />
                      Gas-by-Gas Breakdown
                    </h3>
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-orange-50">
                            <TableHead className="font-semibold">Gas Species</TableHead>
                            <TableHead className="font-semibold text-right">Mass (kg)</TableHead>
                            <TableHead className="font-semibold text-center">GWP100 Factor</TableHead>
                            <TableHead className="font-semibold text-right">CO₂eq (kg)</TableHead>
                            <TableHead className="font-semibold text-right">% of Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <TableRow>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-red-500" />
                                CO₂ (Fossil)
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              {ghgBreakdown.gas_inventory.co2_fossil.toLocaleString('en-GB', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                            </TableCell>
                            <TableCell className="text-center">1</TableCell>
                            <TableCell className="text-right font-semibold">
                              {ghgBreakdown.gas_inventory.co2_fossil.toLocaleString('en-GB', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                            </TableCell>
                            <TableCell className="text-right">
                              {((ghgBreakdown.gas_inventory.co2_fossil / totalCO2) * 100).toFixed(1)}%
                            </TableCell>
                          </TableRow>

                          <TableRow>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-green-500" />
                                CO₂ (Biogenic)
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              {ghgBreakdown.gas_inventory.co2_biogenic.toLocaleString('en-GB', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                            </TableCell>
                            <TableCell className="text-center">1</TableCell>
                            <TableCell className="text-right font-semibold">
                              {ghgBreakdown.gas_inventory.co2_biogenic.toLocaleString('en-GB', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                            </TableCell>
                            <TableCell className="text-right">
                              {((ghgBreakdown.gas_inventory.co2_biogenic / totalCO2) * 100).toFixed(1)}%
                            </TableCell>
                          </TableRow>

                          <TableRow>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-blue-500" />
                                Methane (CH₄)
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              {ghgBreakdown.gas_inventory.methane.toLocaleString('en-GB', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                            </TableCell>
                            <TableCell className="text-center">{ghgBreakdown.gwp_factors.methane_gwp100}</TableCell>
                            <TableCell className="text-right font-semibold">
                              {(ghgBreakdown.gas_inventory.methane * ghgBreakdown.gwp_factors.methane_gwp100).toLocaleString('en-GB', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                            </TableCell>
                            <TableCell className="text-right">
                              {(((ghgBreakdown.gas_inventory.methane * ghgBreakdown.gwp_factors.methane_gwp100) / totalCO2) * 100).toFixed(1)}%
                            </TableCell>
                          </TableRow>

                          <TableRow>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-purple-500" />
                                Nitrous Oxide (N₂O)
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              {ghgBreakdown.gas_inventory.nitrous_oxide.toLocaleString('en-GB', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                            </TableCell>
                            <TableCell className="text-center">{ghgBreakdown.gwp_factors.n2o_gwp100}</TableCell>
                            <TableCell className="text-right font-semibold">
                              {(ghgBreakdown.gas_inventory.nitrous_oxide * ghgBreakdown.gwp_factors.n2o_gwp100).toLocaleString('en-GB', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                            </TableCell>
                            <TableCell className="text-right">
                              {(((ghgBreakdown.gas_inventory.nitrous_oxide * ghgBreakdown.gwp_factors.n2o_gwp100) / totalCO2) * 100).toFixed(1)}%
                            </TableCell>
                          </TableRow>

                          {ghgBreakdown.gas_inventory.hfc_pfc > 0 && (
                            <TableRow>
                              <TableCell className="font-medium">
                                <div className="flex items-center gap-2">
                                  <div className="w-3 h-3 rounded-full bg-amber-500" />
                                  F-gases (HFC/PFC)
                                </div>
                              </TableCell>
                              <TableCell className="text-right">-</TableCell>
                              <TableCell className="text-center">Various</TableCell>
                              <TableCell className="text-right font-semibold">
                                {ghgBreakdown.gas_inventory.hfc_pfc.toLocaleString('en-GB', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                              </TableCell>
                              <TableCell className="text-right">
                                {((ghgBreakdown.gas_inventory.hfc_pfc / totalCO2) * 100).toFixed(1)}%
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  {/* Methodology Note */}
                  <Card className="bg-blue-50 border-blue-200">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-blue-600 mt-0.5" />
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-blue-900">Assessment Method: {ghgBreakdown.gwp_factors.method}</p>
                          <p className="text-xs text-muted-foreground">
                            Global Warming Potentials calculated using {ghgBreakdown.gwp_factors.method} characterisation factors.
                            All emissions converted to 100-year CO₂ equivalents per IPCC methodology.
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="text-sm">GHG breakdown not available for this calculation</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Material Breakdown Tab */}
        <TabsContent value="materials" className="space-y-4 mt-6">
          {materialBreakdown && materialBreakdown.length > 0 ? (
            <>
              {/* Summary Statistics */}
              <div className="grid grid-cols-3 gap-4">
                <Card className="bg-green-50 border-green-200">
                  <CardContent className="p-4">
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold text-green-900">
                        {ingredients.length}
                      </span>
                      <span className="text-xs text-muted-foreground">ingredients</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {ingredientsTotal.toFixed(3)} kg CO₂eq total
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-blue-50 border-blue-200">
                  <CardContent className="p-4">
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold text-blue-900">
                        {packaging.length}
                      </span>
                      <span className="text-xs text-muted-foreground">packaging parts</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {packagingTotal.toFixed(3)} kg CO₂eq total
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-orange-50 border-orange-200">
                  <CardContent className="p-4">
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold text-orange-900">
                        {materialBreakdown.length}
                      </span>
                      <span className="text-xs text-muted-foreground">total materials</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {totalCO2.toFixed(3)} kg CO₂eq combined
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Sort Options */}
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Material-by-Material Impact Analysis
                </h3>
                <div className="flex gap-2">
                  <Badge
                    variant={sortBy === 'impact' ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => setSortBy('impact')}
                  >
                    By Impact
                  </Badge>
                  <Badge
                    variant={sortBy === 'name' ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => setSortBy('name')}
                  >
                    By Name
                  </Badge>
                  <Badge
                    variant={sortBy === 'quantity' ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => setSortBy('quantity')}
                  >
                    By Quantity
                  </Badge>
                </div>
              </div>

              {/* Ingredients Section */}
              {ingredients.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Leaf className="h-4 w-4 text-green-600" />
                      Ingredients ({ingredients.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-green-50">
                            <TableHead className="font-semibold">Material Name</TableHead>
                            <TableHead className="font-semibold text-right">Quantity</TableHead>
                            <TableHead className="font-semibold text-right">Emission Factor</TableHead>
                            <TableHead className="font-semibold text-right">Total Impact</TableHead>
                            <TableHead className="font-semibold text-right">% of Total</TableHead>
                            <TableHead className="font-semibold text-center">Data Source</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {ingredients.map((material, idx) => {
                            const emissionFactor = material.quantity > 0 ? material.climate / material.quantity : 0;
                            return (
                              <TableRow key={idx} className={material.percentage > 5 ? 'bg-orange-50/50' : ''}>
                                <TableCell className="font-medium">
                                  {material.name}
                                  {material.warning && (
                                    <Badge variant="destructive" className="ml-2 text-xs">
                                      {material.warning}
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  {material.quantity.toLocaleString('en-GB', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} {material.unit}
                                </TableCell>
                                <TableCell className="text-right text-xs text-muted-foreground">
                                  {emissionFactor.toLocaleString('en-GB', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} kg CO₂eq/{material.unit}
                                </TableCell>
                                <TableCell className="text-right font-semibold">
                                  {material.climate.toLocaleString('en-GB', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} kg
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                                      <div
                                        className="h-full bg-green-500"
                                        style={{ width: `${Math.min(material.percentage, 100)}%` }}
                                      />
                                    </div>
                                    <span className="text-xs font-medium w-12 text-right">
                                      {material.percentage.toFixed(1)}%
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell className="text-center">
                                  {getDataSourceBadge(material.source)}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Packaging Section */}
              {packaging.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Package className="h-4 w-4 text-blue-600" />
                      Packaging ({packaging.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-blue-50">
                            <TableHead className="font-semibold">Material Name</TableHead>
                            <TableHead className="font-semibold text-right">Quantity</TableHead>
                            <TableHead className="font-semibold text-right">Emission Factor</TableHead>
                            <TableHead className="font-semibold text-right">Total Impact</TableHead>
                            <TableHead className="font-semibold text-right">% of Total</TableHead>
                            <TableHead className="font-semibold text-center">Data Source</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {packaging.map((material, idx) => {
                            const emissionFactor = material.quantity > 0 ? material.climate / material.quantity : 0;
                            return (
                              <TableRow key={idx} className={material.percentage > 5 ? 'bg-orange-50/50' : ''}>
                                <TableCell className="font-medium">
                                  {material.name}
                                  {material.warning && (
                                    <Badge variant="destructive" className="ml-2 text-xs">
                                      {material.warning}
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  {material.quantity.toLocaleString('en-GB', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} {material.unit}
                                </TableCell>
                                <TableCell className="text-right text-xs text-muted-foreground">
                                  {emissionFactor.toLocaleString('en-GB', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} kg CO₂eq/{material.unit}
                                </TableCell>
                                <TableCell className="text-right font-semibold">
                                  {material.climate.toLocaleString('en-GB', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} kg
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                                      <div
                                        className="h-full bg-blue-500"
                                        style={{ width: `${Math.min(material.percentage, 100)}%` }}
                                      />
                                    </div>
                                    <span className="text-xs font-medium w-12 text-right">
                                      {material.percentage.toFixed(1)}%
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell className="text-center">
                                  {getDataSourceBadge(material.source)}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-sm font-medium">No material breakdown data available</p>
                <p className="text-xs mt-2">
                  Material-level emissions will appear here after LCA calculation
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Carbon Origin Tab */}
        <TabsContent value="origin" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Leaf className="h-5 w-5 text-green-600" />
                  Carbon Origin Analysis
                </CardTitle>
                <Badge variant="outline" className="text-xs">ISO 14067 Compliant</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {ghgBreakdown ? (
                <>
                  <div className="grid grid-cols-3 gap-4">
                    <Card className="bg-red-50 border-red-200">
                      <CardContent className="p-4">
                        <div className="flex items-baseline gap-2">
                          <span className="text-2xl font-bold text-red-900">
                            {ghgBreakdown.carbon_origin.fossil.toLocaleString('en-GB', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                          </span>
                          <span className="text-xs text-muted-foreground">kg CO₂eq</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Fossil Carbon</p>
                        <p className="text-xs font-semibold mt-1">
                          {((ghgBreakdown.carbon_origin.fossil / totalCO2) * 100).toFixed(1)}% of total
                        </p>
                      </CardContent>
                    </Card>

                    <Card className="bg-green-50 border-green-200">
                      <CardContent className="p-4">
                        <div className="flex items-baseline gap-2">
                          <span className="text-2xl font-bold text-green-900">
                            {ghgBreakdown.carbon_origin.biogenic.toLocaleString('en-GB', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                          </span>
                          <span className="text-xs text-muted-foreground">kg CO₂eq</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Biogenic Carbon</p>
                        <p className="text-xs font-semibold mt-1">
                          {((ghgBreakdown.carbon_origin.biogenic / totalCO2) * 100).toFixed(1)}% of total
                        </p>
                      </CardContent>
                    </Card>

                    <Card className="bg-amber-50 border-amber-200">
                      <CardContent className="p-4">
                        <div className="flex items-baseline gap-2">
                          <span className="text-2xl font-bold text-amber-900">
                            {ghgBreakdown.carbon_origin.land_use_change.toLocaleString('en-GB', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                          </span>
                          <span className="text-xs text-muted-foreground">kg CO₂eq</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Land Use Change</p>
                        <p className="text-xs font-semibold mt-1">
                          {((ghgBreakdown.carbon_origin.land_use_change / totalCO2) * 100).toFixed(1)}% of total
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Visual Bar */}
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold">Carbon Origin Distribution</h3>
                    <div className="h-8 w-full flex rounded-lg overflow-hidden border-2">
                      <div
                        className="bg-red-500 flex items-center justify-center text-xs font-semibold text-white"
                        style={{ width: `${(ghgBreakdown.carbon_origin.fossil / totalCO2) * 100}%` }}
                      >
                        {((ghgBreakdown.carbon_origin.fossil / totalCO2) * 100) > 10 && 'Fossil'}
                      </div>
                      <div
                        className="bg-green-500 flex items-center justify-center text-xs font-semibold text-white"
                        style={{ width: `${(ghgBreakdown.carbon_origin.biogenic / totalCO2) * 100}%` }}
                      >
                        {((ghgBreakdown.carbon_origin.biogenic / totalCO2) * 100) > 10 && 'Biogenic'}
                      </div>
                      <div
                        className="bg-amber-500 flex items-center justify-center text-xs font-semibold text-white"
                        style={{ width: `${(ghgBreakdown.carbon_origin.land_use_change / totalCO2) * 100}%` }}
                      >
                        {((ghgBreakdown.carbon_origin.land_use_change / totalCO2) * 100) > 10 && 'dLUC'}
                      </div>
                    </div>
                  </div>

                  {/* Explanation Cards */}
                  <div className="grid gap-4">
                    <Card className="bg-red-50 border-red-200">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-2">
                          <div className="w-3 h-3 rounded-full bg-red-500 mt-1" />
                          <div className="space-y-1">
                            <p className="text-sm font-semibold text-red-900">Fossil Carbon</p>
                            <p className="text-xs text-muted-foreground">
                              CO₂ emissions from fossil fuels and mineral sources (e.g., glass, plastics, metals, transport).
                              These are geologically stored carbon released into the atmosphere.
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-green-50 border-green-200">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-2">
                          <div className="w-3 h-3 rounded-full bg-green-500 mt-1" />
                          <div className="space-y-1">
                            <p className="text-sm font-semibold text-green-900">Biogenic Carbon</p>
                            <p className="text-xs text-muted-foreground">
                              CO₂ from recently living biomass (e.g., sugar, fruit, plant-based materials).
                              Part of the short-term carbon cycle. Per ISO 14067, reported separately from fossil CO₂.
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-amber-50 border-amber-200">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-2">
                          <div className="w-3 h-3 rounded-full bg-amber-500 mt-1" />
                          <div className="space-y-1">
                            <p className="text-sm font-semibold text-amber-900">Direct Land Use Change (dLUC)</p>
                            <p className="text-xs text-muted-foreground">
                              Emissions from conversion of land for agricultural production (e.g., deforestation).
                              Includes carbon stock changes in soil and biomass.
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Compliance Note */}
                  <Card className="bg-blue-50 border-blue-200">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-blue-600 mt-0.5" />
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-blue-900">ISO 14067 Compliance</p>
                          <p className="text-xs text-muted-foreground">
                            Per ISO 14067:4.5.3, biogenic carbon removals and emissions are documented separately from fossil carbon.
                            This separation enables transparent reporting and proper interpretation of product carbon footprints.
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="text-sm">Carbon origin breakdown not available for this calculation</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
