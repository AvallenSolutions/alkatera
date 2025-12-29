"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Car, Zap, Fuel, TrendingUp } from "lucide-react";

export function FleetOverviewCards() {
  return (
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
  );
}
