import React from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Droplets, MapPin, AlertTriangle } from 'lucide-react';

interface WaterSourceItem {
  id: string;
  source: string;
  location: string;
  consumption: number;
  riskFactor: number;
  riskLevel: 'high' | 'medium' | 'low';
  netImpact: number;
}

interface WaterImpactSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  totalConsumption: number;
  totalImpact: number;
  sourceItems: WaterSourceItem[];
}

export function WaterImpactSheet({
  open,
  onOpenChange,
  totalConsumption,
  totalImpact,
  sourceItems,
}: WaterImpactSheetProps) {
  const getRiskBadge = (level: 'high' | 'medium' | 'low', factor: number) => {
    const config = {
      high: { className: 'bg-red-600', label: 'High' },
      medium: { className: 'bg-amber-600', label: 'Medium' },
      low: { className: 'bg-green-600', label: 'Low' },
    };

    const { className, label } = config[level];
    return (
      <Badge variant="default" className={className}>
        {label} ({factor.toFixed(1)})
      </Badge>
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-3xl overflow-y-auto">
        <SheetHeader className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100">
              <Droplets className="h-5 w-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <SheetTitle>Water Impact by Facility</SheetTitle>
              <SheetDescription className="mt-1">
                Location-specific water consumption and scarcity risk assessment using AWARE methodology
              </SheetDescription>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="p-4">
                <div className="flex items-baseline gap-3">
                  <span className="text-3xl font-bold text-blue-900">
                    {totalConsumption.toLocaleString('en-GB', { maximumFractionDigits: 1 })}
                  </span>
                  <span className="text-sm text-muted-foreground">m³</span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Total water consumption
                </p>
              </CardContent>
            </Card>

            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="p-4">
                <div className="flex items-baseline gap-3">
                  <span className="text-3xl font-bold text-blue-900">
                    {totalImpact.toLocaleString('en-GB', { maximumFractionDigits: 1 })}
                  </span>
                  <span className="text-sm text-muted-foreground">m³ world eq</span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Scarcity-weighted impact
                </p>
              </CardContent>
            </Card>
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Facility Breakdown</h3>
            <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
              Audit Level 4
            </Badge>
          </div>

          {sourceItems.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                <Droplets className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No water consumption data available</p>
                <p className="text-xs mt-1">Evidence data will be populated from facility activity logs</p>
              </CardContent>
            </Card>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-blue-50">
                    <TableHead className="font-semibold text-xs">Source</TableHead>
                    <TableHead className="font-semibold text-xs">Location</TableHead>
                    <TableHead className="font-semibold text-xs text-right">Consumption</TableHead>
                    <TableHead className="font-semibold text-xs">Risk Factor (AWARE)</TableHead>
                    <TableHead className="font-semibold text-xs text-right">Net Impact</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sourceItems.map((item) => (
                    <TableRow key={item.id} className="hover:bg-blue-50/50">
                      <TableCell className="font-medium text-sm">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-blue-600" />
                          {item.source}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {item.location}
                      </TableCell>
                      <TableCell className="text-sm text-right">
                        {item.consumption.toLocaleString('en-GB', { maximumFractionDigits: 1 })} m³
                      </TableCell>
                      <TableCell className="text-sm">
                        {getRiskBadge(item.riskLevel, item.riskFactor)}
                      </TableCell>
                      <TableCell className="text-sm font-semibold text-right">
                        {item.netImpact.toLocaleString('en-GB', { maximumFractionDigits: 1 })} m³ world eq
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-blue-600" />
                <p className="text-sm font-semibold text-blue-900">AWARE Methodology</p>
              </div>
              <p className="text-xs text-muted-foreground">
                The AWARE (Available WAter REmaining) method quantifies relative water availability per area in a watershed. Higher factors indicate greater water scarcity. Net impact multiplies consumption by the location-specific AWARE factor.
              </p>
              <div className="flex gap-2 mt-2">
                <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">CSRD E3</Badge>
                <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">ISO 14046</Badge>
                <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">AWARE v1.3</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </SheetContent>
    </Sheet>
  );
}
