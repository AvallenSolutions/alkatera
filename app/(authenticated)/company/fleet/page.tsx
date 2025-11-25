"use client";

import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Car, Zap, Fuel, FileText, Code, FlaskConical, CheckCircle2 } from "lucide-react";

export default function FleetPage() {
  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Fleet Management</h1>
        <p className="text-muted-foreground mt-1">
          Smart Fleet Management with automatic Scope 1/2 routing based on propulsion type
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 mb-2">
              <Fuel className="h-5 w-5 text-orange-600" />
              <Badge variant="secondary">Scope 1</Badge>
            </div>
            <CardTitle className="text-lg">ICE Vehicles</CardTitle>
            <CardDescription>Internal Combustion Engine</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Diesel, petrol, and hybrid vehicles automatically route to Scope 1 (direct combustion emissions)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 mb-2">
              <Zap className="h-5 w-5 text-blue-600" />
              <Badge>Scope 2</Badge>
            </div>
            <CardTitle className="text-lg">BEV Vehicles</CardTitle>
            <CardDescription>Battery Electric Vehicles</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Electric vehicles automatically route to Scope 2 (indirect grid electricity emissions)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 mb-2">
              <Car className="h-5 w-5 text-slate-600" />
              <Badge variant="outline">DEFRA 2025</Badge>
            </div>
            <CardTitle className="text-lg">Official Factors</CardTitle>
            <CardDescription>UK Government Data</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              All calculations use official DEFRA 2025 emission factors with full traceability
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="h-6 w-6 text-green-600" />
            <CardTitle>Implementation Status</CardTitle>
          </div>
          <CardDescription>Complete DEFRA 2025 Fleet Management System</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">✅ Backend Complete</h3>
            <ul className="text-sm space-y-1 ml-4">
              <li>• Database schema (vehicles, fleet_activities tables)</li>
              <li>• 10 DEFRA 2025 emission factors loaded</li>
              <li>• Smart scope routing Edge Function deployed</li>
              <li>• Full audit trail with Glass Box compliance</li>
              <li>• RLS policies enforced</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-2">📋 Documentation Available</h3>
            <div className="grid gap-2 mt-2">
              <Link href="/dev/docs/fleet-implementation">
                <Button variant="outline" className="w-full justify-start">
                  <Code className="h-4 w-4 mr-2" />
                  Fleet Implementation - Technical Overview
                </Button>
              </Link>
              <Link href="/dev/docs/verification-tests">
                <Button variant="outline" className="w-full justify-start">
                  <FlaskConical className="h-4 w-4 mr-2" />
                  Verification Tests - SQL & API Tests
                </Button>
              </Link>
              <Link href="/dev/docs/ui-documentation">
                <Button variant="outline" className="w-full justify-start">
                  <FileText className="h-4 w-4 mr-2" />
                  UI Documentation - Components & User Journeys
                </Button>
              </Link>
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-900">
            <h3 className="font-semibold mb-2">🎯 How It Works</h3>
            <p className="text-sm mb-2">
              The Smart Fleet Protocol automatically routes vehicle emissions to the correct GHG Protocol scope:
            </p>
            <div className="text-sm space-y-2 ml-4">
              <div>
                <Badge variant="secondary" className="mr-2">ICE</Badge>
                <span>Diesel/Petrol vehicles → Scope 1 (Direct emissions from fuel combustion)</span>
              </div>
              <div>
                <Badge className="mr-2">BEV</Badge>
                <span>Electric vehicles → Scope 2 (Indirect emissions from grid electricity)</span>
              </div>
            </div>
          </div>

          <div className="bg-green-50 dark:bg-green-950/20 p-4 rounded-lg border border-green-200 dark:border-green-900">
            <h3 className="font-semibold mb-2 text-green-900 dark:text-green-100">Example Calculation</h3>
            <div className="text-sm space-y-2">
              <div>
                <p className="font-semibold">Tesla Model 3 (BEV) - 150 km journey:</p>
                <p className="ml-4">Factor: 0.04597 kgCO2e/km (DEFRA 2025)</p>
                <p className="ml-4">Emissions: (150 × 0.04597) / 1000 = <strong>0.006896 tCO2e</strong></p>
                <p className="ml-4">Scope: <Badge>Scope 2</Badge></p>
              </div>
              <div className="mt-2">
                <p className="font-semibold">Ford Transit Diesel Van - 85 km journey:</p>
                <p className="ml-4">Factor: 0.26385 kgCO2e/km (DEFRA 2025)</p>
                <p className="ml-4">Emissions: (85 × 0.26385) / 1000 = <strong>0.022427 tCO2e</strong></p>
                <p className="ml-4">Scope: <Badge variant="secondary">Scope 1</Badge></p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
