"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, CheckCircle2 } from "lucide-react";

export default function FleetImplementationPage() {
  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <FileText className="h-8 w-8 text-muted-foreground" />
          <h1 className="text-3xl font-bold tracking-tight">DEFRA 2025 Fleet Implementation</h1>
          <Badge variant="outline">Technical</Badge>
        </div>
        <p className="text-muted-foreground">
          Technical overview of DEFRA 2025 data ingestion and Smart Fleet logic with automatic Scope routing
        </p>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-6">
          <section>
            <h2 className="text-2xl font-bold mb-4">Executive Summary</h2>
            <p className="text-muted-foreground">
              Successfully implemented DEFRA 2025 emission factors and Smart Fleet logic with automatic Scope 1/Scope 2 routing
              based on vehicle propulsion type. All calculations are fully compliant with the &quot;Glass Box&quot; auditability principle.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
              What Was Delivered
            </h2>

            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-semibold mb-2">1. Database Schema Enhancements</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  <strong>Migration:</strong> add_category_type_to_emissions_factors
                </p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>Added category column (Scope 1, 2, or 3)</li>
                  <li>Added type column (detailed classification)</li>
                  <li>Added vehicle_class column (Average Car, Class III Van, etc.)</li>
                  <li>Added fuel_type column (Diesel, Petrol, Unknown)</li>
                  <li>Added propulsion_type column (ICE, BEV, PHEV, HEV)</li>
                  <li>Added region column for grid-specific factors</li>
                  <li>Created 8 new indexes for efficient querying</li>
                </ul>
              </div>

              <div>
                <h3 className="text-xl font-semibold mb-2">2. DEFRA 2025 Emission Factors</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  <strong>Migration:</strong> load_defra_2025_core_emission_factors
                </p>
                <p className="text-sm mb-2"><strong>Loaded 10 official DEFRA 2025 factors:</strong></p>

                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-semibold">Scope 1 - Stationary Combustion:</p>
                    <ul className="list-disc list-inside text-sm space-y-1 ml-4">
                      <li>Natural Gas: 0.18316 kgCO2e/kWh</li>
                      <li>LPG: 1.5123 kgCO2e/litre</li>
                      <li>Gas Oil: 2.7566 kgCO2e/litre</li>
                    </ul>
                  </div>

                  <div>
                    <p className="text-sm font-semibold">Scope 1 - Fleet Vehicles (ICE):</p>
                    <ul className="list-disc list-inside text-sm space-y-1 ml-4">
                      <li>Average Car - Diesel: 0.16885 kgCO2e/km</li>
                      <li>Average Car - Petrol: 0.16699 kgCO2e/km</li>
                      <li>Average Car - Unknown: 0.16795 kgCO2e/km</li>
                      <li>Class III Van - Diesel: 0.26385 kgCO2e/km</li>
                    </ul>
                  </div>

                  <div>
                    <p className="text-sm font-semibold">Scope 2 - Grid & Fleet Vehicles (Electric):</p>
                    <ul className="list-disc list-inside text-sm space-y-1 ml-4">
                      <li>UK Grid Electricity: 0.21233 kgCO2e/kWh</li>
                      <li>Battery Electric Vehicle - Average Car: 0.04597 kgCO2e/km</li>
                      <li>Battery Electric Vehicle - Van: 0.06123 kgCO2e/km</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-xl font-semibold mb-2">3. Smart Fleet Calculation Engine</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  <strong>Edge Function:</strong> calculate-fleet-emissions
                </p>

                <div className="bg-slate-100 dark:bg-slate-900 p-4 rounded-lg mb-3">
                  <p className="text-sm font-mono">
                    const scope = propulsion_type === &quot;BEV&quot; ? &quot;Scope 2&quot; : &quot;Scope 1&quot;;
                  </p>
                </div>

                <p className="text-sm mb-2"><strong>Smart Scope Routing Logic:</strong></p>
                <ul className="list-disc list-inside text-sm space-y-1 ml-4">
                  <li><strong>ICE Vehicles</strong> (Diesel, Petrol) → Scope 1 (Direct combustion emissions)</li>
                  <li><strong>BEV Vehicles</strong> (Electric) → Scope 2 (Indirect grid electricity emissions)</li>
                  <li><strong>PHEV/HEV</strong> → Scope 1 (Default to combustion as primary source)</li>
                </ul>
              </div>

              <div>
                <h3 className="text-xl font-semibold mb-2">4. Fleet Management Database Tables</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  <strong>Migration:</strong> create_fleet_management_tables
                </p>

                <div className="space-y-2">
                  <div>
                    <p className="text-sm font-semibold">vehicles table:</p>
                    <p className="text-sm text-muted-foreground ml-4">
                      Central registry of organizational fleet with propulsion type for scope routing
                    </p>
                  </div>

                  <div>
                    <p className="text-sm font-semibold">fleet_activities table:</p>
                    <p className="text-sm text-muted-foreground ml-4">
                      Journey logging with automatic emissions calculation and scope assignment
                    </p>
                  </div>

                  <div>
                    <p className="text-sm font-semibold">Helper Functions:</p>
                    <ul className="list-disc list-inside text-sm ml-4">
                      <li>get_fleet_emissions_by_scope() - Aggregate emissions split by Scope 1/2</li>
                      <li>get_vehicle_performance_summary() - Individual vehicle metrics</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">Example Scenarios</h2>

            <div className="space-y-4">
              <div className="border-l-4 border-orange-500 pl-4 bg-orange-50 dark:bg-orange-950/20 p-4 rounded">
                <h4 className="font-semibold mb-2">Scenario A: Diesel Van Journey (ICE → Scope 1)</h4>
                <p className="text-sm mb-2">Vehicle: Class III Van, ICE, Diesel</p>
                <p className="text-sm mb-2">Distance: 85 km</p>
                <p className="text-sm font-semibold">Calculation:</p>
                <p className="text-sm font-mono bg-white dark:bg-slate-900 p-2 rounded">
                  (85 × 0.26385) / 1000 = 0.022427 tCO2e
                </p>
                <p className="text-sm mt-2"><strong>Result:</strong> <Badge>Scope 1</Badge> 0.022427 tCO2e</p>
              </div>

              <div className="border-l-4 border-blue-500 pl-4 bg-blue-50 dark:bg-blue-950/20 p-4 rounded">
                <h4 className="font-semibold mb-2">Scenario B: Tesla Model 3 Journey (BEV → Scope 2)</h4>
                <p className="text-sm mb-2">Vehicle: Average Car, BEV, Tesla Model 3</p>
                <p className="text-sm mb-2">Distance: 200 km</p>
                <p className="text-sm font-semibold">Calculation:</p>
                <p className="text-sm font-mono bg-white dark:bg-slate-900 p-2 rounded">
                  (200 × 0.04597) / 1000 = 0.009194 tCO2e
                </p>
                <p className="text-sm mt-2"><strong>Result:</strong> <Badge variant="default">Scope 2</Badge> 0.009194 tCO2e</p>
                <p className="text-sm mt-2 text-muted-foreground">
                  Note: This is ~4.6× lower than equivalent petrol car (0.033398 tCO2e)
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">Glass Box Compliance</h2>
            <p className="text-sm mb-3">Every fleet emission calculation creates an immutable audit record with:</p>
            <ul className="list-disc list-inside text-sm space-y-1">
              <li><strong>Complete Input Data:</strong> Vehicle class, propulsion type, fuel type, distance, provenance ID</li>
              <li><strong>Factor Used:</strong> Factor ID, name, value, unit, source (DEFRA 2025), year (2025)</li>
              <li><strong>Calculation Metadata:</strong> Methodology version, engine version, timestamp, scope routing explanation</li>
              <li><strong>Output Data:</strong> Emissions value (tCO2e), determined scope, calculation log ID</li>
            </ul>
            <p className="text-sm mt-3 text-muted-foreground">
              Any auditor can look up the calculation_log_id, retrieve the complete entry, see the exact factor used,
              trace back to DEFRA source documentation, and reproduce the calculation manually.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">Production Status</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <p className="text-sm font-semibold text-green-600">✅ Complete</p>
                <ul className="text-sm space-y-1">
                  <li>Database schema</li>
                  <li>DEFRA 2025 factors loaded</li>
                  <li>Smart scope routing deployed</li>
                  <li>Fleet management UI</li>
                  <li>Full audit trail</li>
                  <li>Build passing</li>
                </ul>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-semibold text-blue-600">📍 Access</p>
                <ul className="text-sm space-y-1">
                  <li>Fleet page: <code>/company/fleet</code></li>
                  <li>Edge Function: <code>calculate-fleet-emissions</code></li>
                  <li>Database: vehicles, fleet_activities</li>
                </ul>
              </div>
            </div>
          </section>
        </CardContent>
      </Card>
    </div>
  );
}
