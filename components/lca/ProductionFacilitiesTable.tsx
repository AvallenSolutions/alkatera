"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Trash2, AlertCircle, CheckCircle2 } from "lucide-react";

export interface ProductionSite {
  id: string;
  facility_id: string;
  facility_name: string;
  production_volume: number;
  share_of_production: number;
  facility_intensity: number;
  attributable_emissions_per_unit: number;
  data_source: 'Verified' | 'Industry_Average';
}

interface ProductionFacilitiesTableProps {
  productionSites: ProductionSite[];
  onAddFacility: () => void;
  onRemoveFacility: (siteId: string) => void;
  productNetVolume: number;
  volumeUnit: string;
  loading?: boolean;
}

export function ProductionFacilitiesTable({
  productionSites,
  onAddFacility,
  onRemoveFacility,
  productNetVolume,
  volumeUnit,
  loading = false,
}: ProductionFacilitiesTableProps) {
  const totalVolume = productionSites.reduce((sum, site) => sum + site.production_volume, 0);

  const weightedAverageIntensity = productionSites.length > 0
    ? productionSites.reduce((sum, site) => {
        const weight = site.production_volume / totalVolume;
        return sum + (site.facility_intensity * weight);
      }, 0)
    : 0;

  const manufacturingImpact = weightedAverageIntensity * productNetVolume;

  if (productionSites.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Production Facilities</CardTitle>
          <CardDescription>
            Link this product to the facility(s) where it is manufactured
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              You must link at least one facility to calculate Manufacturing impact.
            </AlertDescription>
          </Alert>

          <Button onClick={onAddFacility} className="w-full">
            <Plus className="mr-2 h-4 w-4" />
            Add Production Site
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Production Facilities</CardTitle>
            <CardDescription>
              {productionSites.length} {productionSites.length === 1 ? 'site' : 'sites'} linked • {totalVolume.toLocaleString()} units total production
            </CardDescription>
          </div>
          <Button onClick={onAddFacility} size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Add Site
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Facility Name</TableHead>
                <TableHead>Data Source</TableHead>
                <TableHead className="text-right">Volume Produced</TableHead>
                <TableHead className="text-right">Share</TableHead>
                <TableHead className="text-right">Intensity</TableHead>
                <TableHead className="w-[80px]">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {productionSites.map((site) => (
                <TableRow key={site.id}>
                  <TableCell className="font-medium">{site.facility_name}</TableCell>
                  <TableCell>
                    {site.data_source === 'Verified' ? (
                      <Badge variant="default" className="bg-green-600">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Verified
                      </Badge>
                    ) : (
                      <Badge variant="secondary">
                        Average
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {site.production_volume.toLocaleString()} units
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {site.share_of_production.toFixed(1)}%
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {site.facility_intensity.toFixed(4)} kg CO₂e/{volumeUnit}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onRemoveFacility(site.id)}
                      className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-4 space-y-3">
          <h4 className="font-semibold text-blue-900 dark:text-blue-100">Manufacturing Impact Summary</h4>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-blue-700 dark:text-blue-300">Weighted Average Intensity</p>
              <p className="text-lg font-mono font-semibold text-blue-900 dark:text-blue-100">
                {weightedAverageIntensity.toFixed(4)} kg CO₂e/{volumeUnit}
              </p>
            </div>

            <div>
              <p className="text-sm text-blue-700 dark:text-blue-300">Product Net Volume</p>
              <p className="text-lg font-mono font-semibold text-blue-900 dark:text-blue-100">
                {productNetVolume} {volumeUnit}
              </p>
            </div>
          </div>

          <div className="pt-3 border-t border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-700 dark:text-blue-300">Total Manufacturing Impact per Unit</p>
            <p className="text-2xl font-mono font-bold text-blue-900 dark:text-blue-100">
              {manufacturingImpact.toFixed(4)} kg CO₂e/unit
            </p>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
              = {weightedAverageIntensity.toFixed(4)} × {productNetVolume} {volumeUnit}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
