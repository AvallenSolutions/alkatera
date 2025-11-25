"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FlaskConical } from "lucide-react";

export default function VerificationTestsPage() {
  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <FlaskConical className="h-8 w-8 text-muted-foreground" />
          <h1 className="text-3xl font-bold tracking-tight">DEFRA 2025 Verification Tests</h1>
          <Badge variant="outline">Testing</Badge>
        </div>
        <p className="text-muted-foreground">
          Complete testing guide with SQL queries and API test cases for validating DEFRA factor lookups
        </p>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-6">
          <section>
            <h2 className="text-2xl font-bold mb-4">Database Verification</h2>

            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">1. Verify All DEFRA 2025 Factors Are Loaded</h3>
                <div className="bg-slate-900 text-slate-100 p-4 rounded-lg overflow-x-auto">
                  <pre className="text-sm"><code>{`SELECT
  category,
  type,
  vehicle_class,
  propulsion_type,
  fuel_type,
  name,
  value,
  unit,
  source,
  year_of_publication
FROM emissions_factors
WHERE source = 'DEFRA 2025'
  AND year_of_publication = 2025
ORDER BY category, type, name;`}</code></pre>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  <strong>Expected Result:</strong> 10 rows (7 Scope 1 factors + 3 Scope 2 factors)
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">2. Verify Table Schemas</h3>
                <div className="bg-slate-900 text-slate-100 p-4 rounded-lg overflow-x-auto">
                  <pre className="text-sm"><code>{`-- Check vehicles table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'vehicles'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check fleet_activities table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'fleet_activities'
  AND table_schema = 'public'
ORDER BY ordinal_position;`}</code></pre>
                </div>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">Calculation Testing</h2>

            <div className="space-y-4">
              <div className="border-l-4 border-orange-500 pl-4 bg-orange-50 dark:bg-orange-950/20 p-4 rounded">
                <h4 className="font-semibold mb-2">Test 1: ICE Vehicle (Diesel Car) → Should Route to Scope 1</h4>

                <p className="text-sm font-semibold mt-3 mb-1">API Call:</p>
                <div className="bg-slate-900 text-slate-100 p-3 rounded text-xs overflow-x-auto">
                  <pre><code>{`POST /functions/v1/calculate-fleet-emissions
Content-Type: application/json
Authorization: Bearer <token>

{
  "provenance_id": "<valid-uuid>",
  "activity_data": {
    "vehicle_class": "Average Car",
    "propulsion_type": "ICE",
    "fuel_type": "Diesel",
    "distance_km": 100
  }
}`}</code></pre>
                </div>

                <p className="text-sm font-semibold mt-3 mb-1">Expected Response:</p>
                <div className="bg-slate-900 text-slate-100 p-3 rounded text-xs overflow-x-auto">
                  <pre><code>{`{
  "emissions_tco2e": 0.016885,
  "scope": "Scope 1",
  "calculation_log_id": "<uuid>",
  "metadata": {
    "factor_name": "Average Car - Diesel",
    "factor_value": 0.16885,
    "factor_unit": "kgCO2e/km",
    "factor_source": "DEFRA 2025"
  }
}`}</code></pre>
                </div>

                <p className="text-sm mt-3">
                  <strong>Verification:</strong> Emissions = (100 km × 0.16885) / 1000 = <strong>0.016885 tCO2e</strong>
                </p>
                <p className="text-sm">Scope = <Badge>Scope 1</Badge> (ICE vehicle)</p>
              </div>

              <div className="border-l-4 border-blue-500 pl-4 bg-blue-50 dark:bg-blue-950/20 p-4 rounded">
                <h4 className="font-semibold mb-2">Test 2: BEV Vehicle (Electric Car) → Should Route to Scope 2</h4>

                <p className="text-sm font-semibold mt-3 mb-1">API Call:</p>
                <div className="bg-slate-900 text-slate-100 p-3 rounded text-xs overflow-x-auto">
                  <pre><code>{`POST /functions/v1/calculate-fleet-emissions

{
  "provenance_id": "<valid-uuid>",
  "activity_data": {
    "vehicle_class": "Average Car",
    "propulsion_type": "BEV",
    "distance_km": 150
  }
}`}</code></pre>
                </div>

                <p className="text-sm font-semibold mt-3 mb-1">Expected Response:</p>
                <div className="bg-slate-900 text-slate-100 p-3 rounded text-xs overflow-x-auto">
                  <pre><code>{`{
  "emissions_tco2e": 0.006896,
  "scope": "Scope 2",
  "metadata": {
    "factor_name": "Battery Electric Vehicle - Average Car",
    "factor_value": 0.04597,
    "routing_logic": "Battery Electric Vehicle: Routed to Scope 2"
  }
}`}</code></pre>
                </div>

                <p className="text-sm mt-3">
                  <strong>Verification:</strong> Emissions = (150 km × 0.04597) / 1000 = <strong>0.006896 tCO2e</strong>
                </p>
                <p className="text-sm">Scope = <Badge variant="default">Scope 2</Badge> (BEV vehicle)</p>
                <p className="text-sm text-muted-foreground mt-2">Note: ~3.7× lower than equivalent diesel car</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">Audit Trail Verification</h2>

            <div>
              <h3 className="text-lg font-semibold mb-2">Query Calculation Log</h3>
              <div className="bg-slate-900 text-slate-100 p-4 rounded-lg overflow-x-auto">
                <pre className="text-sm"><code>{`SELECT
  cl.log_id,
  cl.created_at,
  cl.organization_id,
  cl.user_id,
  cl.input_data,
  cl.output_value,
  cl.output_unit,
  cl.methodology_version,
  cl.factor_ids_used
FROM calculation_logs cl
WHERE cl.log_id = '<calculation_log_id_from_response>'
ORDER BY cl.created_at DESC
LIMIT 1;`}</code></pre>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Expected: Complete input/output data with factor traceability to DEFRA source
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">Aggregation Testing</h2>

            <div>
              <h3 className="text-lg font-semibold mb-2">Test Fleet Emissions by Scope</h3>
              <div className="bg-slate-900 text-slate-100 p-4 rounded-lg overflow-x-auto">
                <pre className="text-sm"><code>{`SELECT * FROM get_fleet_emissions_by_scope(
  '<organization-id>',
  '2025-11-01',
  '2025-11-30'
);`}</code></pre>
              </div>
              <p className="text-sm font-semibold mt-3 mb-1">Expected Result:</p>
              <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded text-xs overflow-x-auto">
                <pre><code>{`scope    | total_emissions_tco2e | total_distance_km | journey_count
---------|----------------------|-------------------|---------------
Scope 1  | 0.029549             | 175               | 2
Scope 2  | 0.006896             | 150               | 1`}</code></pre>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">Compliance Checks</h2>

            <div className="space-y-3">
              <div>
                <h4 className="text-sm font-semibold mb-1">1. All Factors Have Source Documentation</h4>
                <div className="bg-slate-900 text-slate-100 p-3 rounded-lg overflow-x-auto">
                  <pre className="text-xs"><code>{`SELECT COUNT(*) as factors_without_docs
FROM emissions_factors
WHERE source = 'DEFRA 2025'
  AND (source_documentation_link IS NULL
    OR source_documentation_link = ''
    OR source_documentation_link NOT LIKE 'https://www.gov.uk%');`}</code></pre>
                </div>
                <p className="text-sm text-muted-foreground mt-1">Expected: 0 rows</p>
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-1">2. Scope Assignment is Consistent</h4>
                <div className="bg-slate-900 text-slate-100 p-3 rounded-lg overflow-x-auto">
                  <pre className="text-xs"><code>{`SELECT fa.scope, v.propulsion_type, COUNT(*) as mismatched_count
FROM fleet_activities fa
JOIN vehicles v ON v.id = fa.vehicle_id
WHERE fa.scope != CASE
  WHEN v.propulsion_type = 'BEV' THEN 'Scope 2'
  ELSE 'Scope 1'
END
GROUP BY fa.scope, v.propulsion_type;`}</code></pre>
                </div>
                <p className="text-sm text-muted-foreground mt-1">Expected: 0 rows (no scope mismatches)</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">Summary Checklist</h2>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1 text-sm">
                <p>✅ 10 DEFRA 2025 factors loaded</p>
                <p>✅ vehicles table exists</p>
                <p>✅ fleet_activities table exists</p>
                <p>✅ ICE vehicles route to Scope 1</p>
                <p>✅ BEV vehicles route to Scope 2</p>
              </div>
              <div className="space-y-1 text-sm">
                <p>✅ All calculations create audit logs</p>
                <p>✅ Factor traceability works</p>
                <p>✅ Aggregation functions correct</p>
                <p>✅ Scope routing is consistent</p>
                <p>✅ RLS policies enforce boundaries</p>
              </div>
            </div>
          </section>
        </CardContent>
      </Card>
    </div>
  );
}
