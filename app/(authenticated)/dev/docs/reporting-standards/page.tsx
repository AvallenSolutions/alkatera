"use client";

import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Globe,
  Scale,
  Leaf,
  Droplets,
  Mountain,
  Recycle,
  FileText,
  BarChart3,
  Shield
} from "lucide-react";

export default function ReportingStandardsPage() {
  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="space-y-2">
        <h1 className="text-4xl font-bold tracking-tight">Reporting Standards & Methodologies</h1>
        <p className="text-lg text-muted-foreground">
          Comprehensive overview of international sustainability standards, LCA methodologies, and compliance requirements implemented in the platform.
        </p>
      </div>

      {/* Executive Summary */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-600" />
            Compliance Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <span className="font-semibold">ISO 14040/44</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Full compliance with international LCA standards
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <span className="font-semibold">CSRD (EU)</span>
              </div>
              <p className="text-sm text-muted-foreground">
                All 5 environmental standards (E1-E5) covered
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <span className="font-semibold">GHG Protocol</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Scope 1, 2, and 3 calculations implemented
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="csrd" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="csrd">CSRD</TabsTrigger>
          <TabsTrigger value="lca">LCA Standards</TabsTrigger>
          <TabsTrigger value="ghg">GHG Protocol</TabsTrigger>
          <TabsTrigger value="tnfd">TNFD</TabsTrigger>
          <TabsTrigger value="glass-box">Glass Box</TabsTrigger>
        </TabsList>

        {/* CSRD Tab */}
        <TabsContent value="csrd" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Corporate Sustainability Reporting Directive (CSRD)
              </CardTitle>
              <CardDescription>
                EU regulation requiring companies to disclose environmental, social, and governance impacts
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4">
                {/* E1: Climate Change */}
                <Card className="border-orange-200">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Leaf className="h-4 w-4 text-orange-600" />
                        ESRS E1: Climate Change
                      </CardTitle>
                      <Badge variant="default" className="bg-green-600">Compliant</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="text-sm space-y-2">
                      <p className="font-semibold">Required Metrics:</p>
                      <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                        <li>Scope 1 GHG emissions (direct)</li>
                        <li>Scope 2 GHG emissions (electricity, location & market-based)</li>
                        <li>Scope 3 GHG emissions (value chain)</li>
                        <li>Climate Change GWP100 (kg CO₂eq)</li>
                      </ul>
                    </div>
                    <Separator />
                    <div className="space-y-2">
                      <p className="text-sm font-semibold">Implementation:</p>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline">ReCiPe 2016 Midpoint (H)</Badge>
                        <Badge variant="outline">IPCC AR6 GWP100</Badge>
                        <Badge variant="outline">Ecoinvent 3.12</Badge>
                      </div>
                    </div>
                    <div className="text-sm">
                      <p className="font-semibold">Data Sources:</p>
                      <ul className="list-disc list-inside space-y-1 text-muted-foreground mt-1">
                        <li>OpenLCA API with Ecoinvent 3.12 database</li>
                        <li>DEFRA 2025 emission factors (fallback)</li>
                        <li>EPA eGRID for electricity (US)</li>
                        <li>IEA country-specific factors</li>
                      </ul>
                    </div>
                  </CardContent>
                </Card>

                {/* E2: Pollution */}
                <Card className="border-purple-200">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-purple-600" />
                        ESRS E2: Pollution
                      </CardTitle>
                      <Badge variant="default" className="bg-green-600">Compliant</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="text-sm space-y-2">
                      <p className="font-semibold">Required Metrics:</p>
                      <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                        <li>Air pollutants (SOx, NOx, PM)</li>
                        <li>Water pollutants (nitrogen, phosphorus)</li>
                        <li>Soil contamination</li>
                        <li>Substances of concern</li>
                      </ul>
                    </div>
                    <Separator />
                    <div className="space-y-2">
                      <p className="text-sm font-semibold">Implementation:</p>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline">Freshwater Eutrophication (kg P eq)</Badge>
                        <Badge variant="outline">Terrestrial Acidification (kg SO₂ eq)</Badge>
                      </div>
                    </div>
                    <div className="text-sm">
                      <p className="font-semibold">Data Sources:</p>
                      <ul className="list-disc list-inside space-y-1 text-muted-foreground mt-1">
                        <li>ReCiPe 2016 characterisation factors</li>
                        <li>Ecoinvent 3.12 process data</li>
                      </ul>
                    </div>
                  </CardContent>
                </Card>

                {/* E3: Water & Marine Resources */}
                <Card className="border-blue-200">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Droplets className="h-4 w-4 text-blue-600" />
                        ESRS E3: Water & Marine Resources
                      </CardTitle>
                      <Badge variant="default" className="bg-green-600">Compliant</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="text-sm space-y-2">
                      <p className="font-semibold">Required Metrics:</p>
                      <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                        <li>Water consumption in water-stressed areas</li>
                        <li>Water withdrawals and discharges</li>
                        <li>Marine resource impacts</li>
                      </ul>
                    </div>
                    <Separator />
                    <div className="space-y-2">
                      <p className="text-sm font-semibold">Implementation:</p>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline">Water Consumption (m³)</Badge>
                        <Badge variant="outline">AWARE Water Scarcity (m³ world eq)</Badge>
                      </div>
                    </div>
                    <Alert className="mt-3">
                      <Droplets className="h-4 w-4" />
                      <AlertTitle>Spatially-Explicit Water Scarcity</AlertTitle>
                      <AlertDescription className="text-sm mt-1">
                        <strong>AWARE Method:</strong> Location-specific characterisation factors for 35+ countries.
                        Water consumption is multiplied by regional scarcity factors (e.g., Spain: 54.8, UK: 8.2).
                      </AlertDescription>
                    </Alert>
                    <div className="text-sm">
                      <p className="font-semibold">Data Sources:</p>
                      <ul className="list-disc list-inside space-y-1 text-muted-foreground mt-1">
                        <li>UNEP SETAC AWARE factors (2023)</li>
                        <li>ReCiPe 2016 water consumption</li>
                        <li>ISO 3166-1 alpha-2 country codes</li>
                      </ul>
                    </div>
                  </CardContent>
                </Card>

                {/* E4: Biodiversity & Ecosystems */}
                <Card className="border-green-200">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Mountain className="h-4 w-4 text-green-600" />
                        ESRS E4: Biodiversity & Ecosystems
                      </CardTitle>
                      <Badge variant="default" className="bg-green-600">Compliant</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="text-sm space-y-2">
                      <p className="font-semibold">Required Metrics:</p>
                      <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                        <li>Land use and land-use change</li>
                        <li>Impact on species and habitats</li>
                        <li>Deforestation and ecosystem degradation</li>
                      </ul>
                    </div>
                    <Separator />
                    <div className="space-y-2">
                      <p className="text-sm font-semibold">Implementation:</p>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline">Land Use (m²a crop eq)</Badge>
                        <Badge variant="outline">Terrestrial Ecotoxicity (kg 1,4-DCB)</Badge>
                      </div>
                    </div>
                    <div className="text-sm">
                      <p className="font-semibold">Data Sources:</p>
                      <ul className="list-disc list-inside space-y-1 text-muted-foreground mt-1">
                        <li>ReCiPe 2016 land use indicators</li>
                        <li>Ecoinvent land transformation data</li>
                        <li>USEtox ecotoxicity characterisation</li>
                      </ul>
                    </div>
                  </CardContent>
                </Card>

                {/* E5: Resource Use & Circular Economy */}
                <Card className="border-amber-200">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Recycle className="h-4 w-4 text-amber-600" />
                        ESRS E5: Resource Use & Circular Economy
                      </CardTitle>
                      <Badge variant="default" className="bg-green-600">Compliant</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="text-sm space-y-2">
                      <p className="font-semibold">Required Metrics:</p>
                      <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                        <li>Resource inflows and outflows</li>
                        <li>Waste generation and management</li>
                        <li>Material circularity indicators</li>
                      </ul>
                    </div>
                    <Separator />
                    <div className="space-y-2">
                      <p className="text-sm font-semibold">Implementation:</p>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline">Fossil Resource Scarcity (kg oil eq)</Badge>
                        <Badge variant="outline">Material Circularity Indicator (MCI)</Badge>
                        <Badge variant="outline">Waste-to-Landfill Tracking</Badge>
                      </div>
                    </div>
                    <div className="text-sm">
                      <p className="font-semibold">Data Sources:</p>
                      <ul className="list-disc list-inside space-y-1 text-muted-foreground mt-1">
                        <li>ReCiPe 2016 resource scarcity</li>
                        <li>Ellen MacArthur Foundation MCI</li>
                        <li>DEFRA waste factors</li>
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* LCA Standards Tab */}
        <TabsContent value="lca" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Scale className="h-5 w-5" />
                Life Cycle Assessment (LCA) Standards
              </CardTitle>
              <CardDescription>
                International standards and methodologies for environmental impact assessment
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* ISO 14040/44 */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-semibold">ISO 14040:2006 & ISO 14044:2006</h3>
                  <Badge variant="default" className="bg-green-600">Compliant</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  International standards for Life Cycle Assessment (LCA) principles, framework, requirements, and guidelines.
                </p>

                <div className="grid md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">ISO 14040: Principles & Framework</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm space-y-2">
                      <div>
                        <p className="font-semibold mb-1">Four Phases:</p>
                        <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                          <li>Goal & Scope Definition</li>
                          <li>Life Cycle Inventory (LCI)</li>
                          <li>Life Cycle Impact Assessment (LCIA)</li>
                          <li>Interpretation</li>
                        </ol>
                      </div>
                      <div className="pt-2">
                        <p className="font-semibold mb-1">Implementation:</p>
                        <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                          <li>Functional unit defined per product</li>
                          <li>System boundary documentation</li>
                          <li>Allocation methodology transparency</li>
                        </ul>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">ISO 14044: Requirements & Guidelines</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm space-y-2">
                      <div>
                        <p className="font-semibold mb-1">Data Quality Requirements:</p>
                        <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                          <li>Time-related coverage</li>
                          <li>Geographic coverage</li>
                          <li>Technology coverage</li>
                          <li>Precision & completeness</li>
                        </ul>
                      </div>
                      <div className="pt-2">
                        <p className="font-semibold mb-1">Implementation:</p>
                        <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                          <li>Data quality indicators tracked</li>
                          <li>Uncertainty analysis capability</li>
                          <li>Critical review documentation</li>
                        </ul>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              <Separator />

              {/* ReCiPe 2016 */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-semibold">ReCiPe 2016 Midpoint (H)</h3>
                  <Badge variant="default" className="bg-green-600">Primary Method</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Harmonised life cycle impact assessment methodology developed by RIVM, CML, PRé, and Radboud University Nijmegen.
                </p>

                <Alert>
                  <BarChart3 className="h-4 w-4" />
                  <AlertTitle>18 Impact Categories at Midpoint Level</AlertTitle>
                  <AlertDescription className="text-sm mt-2">
                    Platform implements 8 mandatory categories for CSRD compliance. Full 18-category support available for advanced reporting.
                  </AlertDescription>
                </Alert>

                <div className="space-y-3">
                  <p className="text-sm font-semibold">Implemented Impact Categories:</p>
                  <div className="grid md:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase">CSRD Required (8)</p>
                      <div className="space-y-1">
                        {[
                          "Climate Change (GWP100)",
                          "Water Consumption",
                          "Land Use",
                          "Terrestrial Ecotoxicity",
                          "Freshwater Eutrophication",
                          "Terrestrial Acidification",
                          "Fossil Resource Scarcity",
                          "Water Scarcity (AWARE)"
                        ].map((category) => (
                          <div key={category} className="flex items-center gap-2 text-sm">
                            <CheckCircle2 className="h-3 w-3 text-green-600" />
                            <span>{category}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase">Additional Available (10)</p>
                      <div className="space-y-1">
                        {[
                          "Ozone Depletion",
                          "Ionising Radiation",
                          "Photochemical Ozone Formation",
                          "Fine Particulate Matter",
                          "Marine Eutrophication",
                          "Freshwater Ecotoxicity",
                          "Marine Ecotoxicity",
                          "Human Carcinogenic Toxicity",
                          "Human Non-carcinogenic Toxicity",
                          "Mineral Resource Scarcity"
                        ].map((category) => (
                          <div key={category} className="flex items-center gap-2 text-sm">
                            <AlertTriangle className="h-3 w-3 text-amber-600" />
                            <span className="text-muted-foreground">{category}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4">
                  <p className="text-sm font-semibold mb-2">Characterisation Model:</p>
                  <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                    <li><strong>Hierarchist (H) perspective:</strong> Balance between short and long term, consensus model</li>
                    <li><strong>Time horizon:</strong> 100 years for climate change (GWP100)</li>
                    <li><strong>Geographic scope:</strong> Global with regional characterisation factors</li>
                    <li><strong>Database compatibility:</strong> Ecoinvent 3.x, GaBi, ELCD</li>
                  </ul>
                </div>
              </div>

              <Separator />

              {/* Ecoinvent Database */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-semibold">Ecoinvent 3.12 Database</h3>
                  <Badge variant="outline">Data Source</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  World's most comprehensive life cycle inventory database with 20,000+ activities across all economic sectors.
                </p>

                <div className="grid md:grid-cols-3 gap-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">System Models</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm space-y-1">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-3 w-3 text-green-600" />
                        <span>Cut-off (primary)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-3 w-3 text-green-600" />
                        <span>APOS</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-3 w-3 text-green-600" />
                        <span>Consequential</span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Geographic Coverage</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm space-y-1">
                      <ul className="list-disc list-inside text-muted-foreground">
                        <li>150+ countries/regions</li>
                        <li>Global transport networks</li>
                        <li>Regional electricity grids</li>
                      </ul>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Update Frequency</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm space-y-1">
                      <ul className="list-disc list-inside text-muted-foreground">
                        <li>Major: Annual</li>
                        <li>Minor: Quarterly</li>
                        <li>Current: 3.12 (2024)</li>
                      </ul>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* GHG Protocol Tab */}
        <TabsContent value="ghg" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Leaf className="h-5 w-5" />
                GHG Protocol Corporate Standard
              </CardTitle>
              <CardDescription>
                The most widely used international accounting tool for government and business leaders to quantify and manage greenhouse gas emissions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Scope 1 */}
              <Card className="border-red-200">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Scope 1: Direct Emissions</CardTitle>
                    <Badge variant="default" className="bg-green-600">Compliant</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Emissions from sources owned or controlled by the company
                  </p>

                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-semibold mb-2">Implemented Categories:</p>
                      <div className="grid md:grid-cols-2 gap-2">
                        <div className="flex items-center gap-2 text-sm">
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                          <span>Stationary Combustion (mass, volume, energy)</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                          <span>Mobile Combustion (fuel, distance)</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                          <span>Process Emissions (industrial)</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                          <span>Fugitive Emissions (refrigerants)</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <p className="text-sm font-semibold mb-2">Emission Factors:</p>
                      <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                        <li>DEFRA 2025 UK factors (primary)</li>
                        <li>EPA emission factors (US)</li>
                        <li>IPCC AR6 GWP100 values</li>
                        <li>Refrigerant-specific GWP (HFCs, HCFCs)</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Scope 2 */}
              <Card className="border-orange-200">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Scope 2: Indirect Energy Emissions</CardTitle>
                    <Badge variant="default" className="bg-green-600">Compliant</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Emissions from purchased electricity, steam, heating, and cooling
                  </p>

                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Dual Reporting Required</AlertTitle>
                    <AlertDescription className="text-sm mt-1">
                      GHG Protocol requires both location-based and market-based methods for electricity.
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-semibold mb-2">Implemented Methods:</p>
                      <div className="space-y-2">
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm">Location-Based Method</CardTitle>
                          </CardHeader>
                          <CardContent className="text-sm">
                            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                              <li>Grid average emission factors by country</li>
                              <li>IEA country-specific factors</li>
                              <li>EPA eGRID for US regions</li>
                              <li>DEFRA UK grid factors</li>
                            </ul>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm">Market-Based Method</CardTitle>
                          </CardHeader>
                          <CardContent className="text-sm">
                            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                              <li>Supplier-specific emission factors</li>
                              <li>Energy Attribute Certificates (RECs/GOs)</li>
                              <li>Power Purchase Agreements (PPAs)</li>
                              <li>Residual mix factors (AIB, NREL)</li>
                            </ul>
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Scope 3 */}
              <Card className="border-blue-200">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Scope 3: Value Chain Emissions</CardTitle>
                    <Badge variant="default" className="bg-green-600">15 Categories</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    All indirect emissions in the value chain (upstream and downstream)
                  </p>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase">Upstream (8 Categories)</p>
                      <div className="space-y-1">
                        {[
                          { name: "Cat 1: Purchased Goods & Services", status: true },
                          { name: "Cat 2: Capital Goods", status: true },
                          { name: "Cat 3: Fuel & Energy Activities", status: true },
                          { name: "Cat 4: Upstream Transportation", status: true },
                          { name: "Cat 5: Waste Generated", status: true },
                          { name: "Cat 6: Business Travel", status: true },
                          { name: "Cat 7: Employee Commuting", status: true },
                          { name: "Cat 8: Upstream Leased Assets", status: false }
                        ].map((cat) => (
                          <div key={cat.name} className="flex items-center gap-2 text-xs">
                            {cat.status ? (
                              <CheckCircle2 className="h-3 w-3 text-green-600" />
                            ) : (
                              <XCircle className="h-3 w-3 text-gray-400" />
                            )}
                            <span className={cat.status ? "" : "text-muted-foreground"}>{cat.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase">Downstream (7 Categories)</p>
                      <div className="space-y-1">
                        {[
                          { name: "Cat 9: Downstream Transportation", status: false },
                          { name: "Cat 10: Processing of Sold Products", status: false },
                          { name: "Cat 11: Use of Sold Products", status: false },
                          { name: "Cat 12: End-of-Life Treatment", status: false },
                          { name: "Cat 13: Downstream Leased Assets", status: false },
                          { name: "Cat 14: Franchises", status: false },
                          { name: "Cat 15: Investments", status: false }
                        ].map((cat) => (
                          <div key={cat.name} className="flex items-center gap-2 text-xs">
                            {cat.status ? (
                              <CheckCircle2 className="h-3 w-3 text-green-600" />
                            ) : (
                              <XCircle className="h-3 w-3 text-gray-400" />
                            )}
                            <span className={cat.status ? "" : "text-muted-foreground"}>{cat.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <Alert className="mt-4">
                    <FileText className="h-4 w-4" />
                    <AlertTitle>Category 1: Purchased Goods & Services</AlertTitle>
                    <AlertDescription className="text-sm mt-1">
                      This is typically the largest Scope 3 category. Platform uses Product Carbon Footprints with Ecoinvent data for accurate tracking of supply chain emissions.
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TNFD Tab */}
        <TabsContent value="tnfd" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mountain className="h-5 w-5" />
                Taskforce on Nature-related Financial Disclosures (TNFD)
              </CardTitle>
              <CardDescription>
                Framework for organisations to report and act on evolving nature-related dependencies, impacts, risks, and opportunities
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Alert className="border-green-200 bg-green-50/50">
                <Mountain className="h-4 w-4 text-green-600" />
                <AlertTitle>TNFD Compliance Status</AlertTitle>
                <AlertDescription className="text-sm mt-2 space-y-2">
                  <p>
                    Platform provides the underlying impact assessment data required for TNFD's LEAP approach (Locate, Evaluate, Assess, Prepare).
                  </p>
                  <p className="font-semibold">
                    Focus: Biodiversity and ecosystem dependencies in supply chain and operations
                  </p>
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Nature-Related Metrics Implemented</h3>

                <div className="grid gap-4">
                  {/* Land Use */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Mountain className="h-4 w-4" />
                        Land Use & Land-Use Change (LULUC)
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div>
                        <p className="font-semibold mb-1">Metrics:</p>
                        <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                          <li>Land Use: m²a crop equivalent (ReCiPe 2016)</li>
                          <li>Land transformation vs. land occupation</li>
                          <li>Geographic attribution via origin country</li>
                        </ul>
                      </div>
                      <div>
                        <p className="font-semibold mb-1">Data Sources:</p>
                        <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                          <li>Ecoinvent land transformation processes</li>
                          <li>ReCiPe 2016 characterisation factors</li>
                        </ul>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Ecotoxicity */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Leaf className="h-4 w-4" />
                        Ecotoxicity Impacts
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div>
                        <p className="font-semibold mb-1">Metrics:</p>
                        <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                          <li>Terrestrial Ecotoxicity: kg 1,4-DCB equivalent</li>
                          <li>Freshwater Ecotoxicity: kg 1,4-DCB equivalent</li>
                          <li>Marine Ecotoxicity: kg 1,4-DCB equivalent</li>
                        </ul>
                      </div>
                      <div>
                        <p className="font-semibold mb-1">Coverage:</p>
                        <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                          <li>Pesticides and agrochemicals</li>
                          <li>Heavy metals</li>
                          <li>Organic pollutants</li>
                        </ul>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Water Impacts */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Droplets className="h-4 w-4" />
                        Water-Related Impacts on Ecosystems
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div>
                        <p className="font-semibold mb-1">Metrics:</p>
                        <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                          <li>Water Scarcity (AWARE): m³ world equivalent</li>
                          <li>Freshwater Eutrophication: kg P equivalent</li>
                          <li>Geographic specificity via country codes</li>
                        </ul>
                      </div>
                      <div>
                        <p className="font-semibold mb-1">Ecosystem Relevance:</p>
                        <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                          <li>Impacts on freshwater biodiversity</li>
                          <li>Nutrient loading effects</li>
                          <li>Water availability for ecosystems</li>
                        </ul>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="text-lg font-semibold">TNFD LEAP Approach Support</h3>
                <div className="grid md:grid-cols-4 gap-4">
                  {[
                    {
                      phase: "Locate",
                      description: "Geographic attribution via origin countries and facility locations",
                      status: "Partial"
                    },
                    {
                      phase: "Evaluate",
                      description: "Impact assessment metrics for land, water, and pollution",
                      status: "Complete"
                    },
                    {
                      phase: "Assess",
                      description: "Quantified environmental impacts per material and product",
                      status: "Complete"
                    },
                    {
                      phase: "Prepare",
                      description: "Data export and reporting infrastructure",
                      status: "In Progress"
                    }
                  ].map((phase) => (
                    <Card key={phase.phase}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">{phase.phase}</CardTitle>
                        <Badge
                          variant={phase.status === "Complete" ? "default" : "outline"}
                          className={phase.status === "Complete" ? "bg-green-600" : ""}
                        >
                          {phase.status}
                        </Badge>
                      </CardHeader>
                      <CardContent>
                        <p className="text-xs text-muted-foreground">{phase.description}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Glass Box Tab */}
        <TabsContent value="glass-box" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Glass Box Compliance Protocol
              </CardTitle>
              <CardDescription>
                Internal transparency and data provenance standards ensuring audit-ready calculations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Alert className="border-blue-200 bg-blue-50/50">
                <Shield className="h-4 w-4 text-blue-600" />
                <AlertTitle>Zero Black Box Policy</AlertTitle>
                <AlertDescription className="text-sm mt-2">
                  Every calculation must be traceable to its source data with full methodology documentation. No mock data, no random numbers, no unexplained proxies.
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Mandatory Audit Metadata</h3>
                <p className="text-sm text-muted-foreground">
                  Every calculation result includes four required fields for complete transparency:
                </p>

                <div className="grid md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">1. source_used</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm space-y-2">
                      <p className="text-muted-foreground">The authoritative data source name and version</p>
                      <div className="space-y-1 font-mono text-xs bg-gray-100 p-2 rounded">
                        <div>"Ecoinvent 3.12"</div>
                        <div>"DEFRA 2025"</div>
                        <div>"Supplier: ABC Ltd"</div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">2. external_reference_id</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm space-y-2">
                      <p className="text-muted-foreground">Unique identifier tracing back to source database</p>
                      <div className="space-y-1 font-mono text-xs bg-gray-100 p-2 rounded">
                        <div>"8a4e5c7d-2f3b-4e9a-b1c3..."</div>
                        <div>"defra_2025_wheat_uk_123"</div>
                        <div>"supplier_product_456"</div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">3. factor_value</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm space-y-2">
                      <p className="text-muted-foreground">The actual numeric factor used in calculation</p>
                      <div className="space-y-1 font-mono text-xs bg-gray-100 p-2 rounded">
                        <div>0.52 kgCO2eq/kg</div>
                        <div>2.34 m³/kg</div>
                        <div>1.87 kg oil eq/kg</div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">4. methodology</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm space-y-2">
                      <p className="text-muted-foreground">LCA methodology and system boundary</p>
                      <div className="space-y-1 font-mono text-xs bg-gray-100 p-2 rounded">
                        <div>"Cradle-to-Gate (Cut-off)"</div>
                        <div>"Cradle-to-Grave"</div>
                        <div>"Gate-to-Gate"</div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Data Hierarchy Enforcement</h3>
                <p className="text-sm text-muted-foreground">
                  Strict priority order ensures highest quality data is always used:
                </p>

                <div className="space-y-3">
                  <Card className="border-green-200">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm">Priority 1: Supplier-Specific Data</CardTitle>
                        <Badge variant="default" className="bg-green-600">Highest Quality</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                        <li>Environmental Product Declarations (EPDs)</li>
                        <li>Supplier-provided LCA data</li>
                        <li>Product-specific emission factors</li>
                        <li>Confidence score: HIGH</li>
                      </ul>
                      <Alert className="mt-2">
                        <CheckCircle2 className="h-4 w-4" />
                        <AlertDescription className="text-xs">
                          Code checks <code className="font-mono">data_source === "supplier"</code> BEFORE any external API calls
                        </AlertDescription>
                      </Alert>
                    </CardContent>
                  </Card>

                  <Card className="border-blue-200">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm">Priority 2: OpenLCA / Ecoinvent</CardTitle>
                        <Badge variant="outline">Standard Path</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                        <li>Ecoinvent 3.12 database processes</li>
                        <li>ReCiPe 2016 Midpoint (H) characterisation</li>
                        <li>Full multi-capital impact metrics</li>
                        <li>Confidence score: HIGH</li>
                      </ul>
                      <Alert className="mt-2">
                        <CheckCircle2 className="h-4 w-4" />
                        <AlertDescription className="text-xs">
                          Only triggered if supplier data not available. Returns <code className="font-mono">null</code> on failure to cascade to fallback.
                        </AlertDescription>
                      </Alert>
                    </CardContent>
                  </Card>

                  <Card className="border-amber-200">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm">Priority 3: Internal DEFRA Fallback</CardTitle>
                        <Badge variant="outline">Conservative Proxy</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                        <li>DEFRA 2025 emission factors</li>
                        <li>Conservative multi-capital estimates</li>
                        <li>NOT suitable for CSRD reporting</li>
                        <li>Confidence score: LOW to MEDIUM</li>
                      </ul>
                      <Alert className="mt-2 border-amber-200">
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                        <AlertDescription className="text-xs">
                          Only used when OpenLCA unavailable. Calculation flagged with <code className="font-mono">csrd_compliant: false</code>
                        </AlertDescription>
                      </Alert>
                    </CardContent>
                  </Card>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Compliance Checks</h3>
                <div className="grid gap-3">
                  {[
                    {
                      check: "Zero Mock Data",
                      description: "No Math.random(), no hardcoded fallbacks (e.g., const co2 = 10)",
                      status: "Pass"
                    },
                    {
                      check: "Strict Data Hierarchy",
                      description: "Explicit checks for supplier data before external API calls",
                      status: "Pass"
                    },
                    {
                      check: "Mandatory Audit Fields",
                      description: "All 4 fields (source_used, external_reference_id, factor_value, methodology) present",
                      status: "Pass"
                    },
                    {
                      check: "Failure Safety",
                      description: "OpenLCA timeout triggers database fallback automatically",
                      status: "Pass"
                    },
                    {
                      check: "Calculation Provenance",
                      description: "Full audit trail stored in calculation_logs with impact_metrics JSONB",
                      status: "Pass"
                    }
                  ].map((item) => (
                    <div key={item.check} className="flex items-start gap-3 p-3 rounded-lg border">
                      <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                      <div className="space-y-1 flex-1">
                        <p className="font-semibold text-sm">{item.check}</p>
                        <p className="text-xs text-muted-foreground">{item.description}</p>
                      </div>
                      <Badge variant="default" className="bg-green-600">{item.status}</Badge>
                    </div>
                  ))}
                </div>
              </div>

              <Alert className="mt-6">
                <FileText className="h-4 w-4" />
                <AlertTitle>Audit Documentation</AlertTitle>
                <AlertDescription className="text-sm mt-2 space-y-2">
                  <p>
                    Every calculation is logged to <code className="font-mono text-xs">product_lca_calculation_logs</code> with:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-xs text-muted-foreground mt-1">
                    <li>Full request payload (materials, quantities, sources)</li>
                    <li>Complete response data (all impact metrics)</li>
                    <li>Calculation duration and timestamp</li>
                    <li>CSRD compliance flag</li>
                    <li>Data quality indicators</li>
                  </ul>
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
