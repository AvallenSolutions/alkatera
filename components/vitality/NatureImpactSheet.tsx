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
import { Mountain, MapPin, Leaf } from 'lucide-react';

interface LandUseItem {
  id: string;
  ingredient: string;
  origin: string;
  mass: number;
  landIntensity: number;
  totalFootprint: number;
}

interface NatureImpactSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  totalLandUse: number;
  ingredientCount: number;
  landUseItems: LandUseItem[];
}

export function NatureImpactSheet({
  open,
  onOpenChange,
  totalLandUse,
  ingredientCount,
  landUseItems,
}: NatureImpactSheetProps) {
  const getIntensityBadge = (intensity: number) => {
    if (intensity < 5) return { className: 'bg-green-600', label: 'Low Impact' };
    if (intensity < 15) return { className: 'bg-amber-600', label: 'Medium Impact' };
    return { className: 'bg-red-600', label: 'High Impact' };
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-3xl overflow-y-auto">
        <SheetHeader className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-100">
              <Mountain className="h-5 w-5 text-green-600" />
            </div>
            <div className="flex-1">
              <SheetTitle>Nature & Biodiversity Impact</SheetTitle>
              <SheetDescription className="mt-1">
                Land use footprint by agricultural ingredient showing occupation and transformation impacts
              </SheetDescription>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <Card className="bg-green-50 border-green-200">
              <CardContent className="p-4">
                <div className="flex items-baseline gap-3">
                  <span className="text-3xl font-bold text-green-900">
                    {totalLandUse.toLocaleString('en-GB', { maximumFractionDigits: 0 })}
                  </span>
                  <span className="text-sm text-muted-foreground">m²a</span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Total land footprint
                </p>
              </CardContent>
            </Card>

            <Card className="bg-green-50 border-green-200">
              <CardContent className="p-4">
                <div className="flex items-baseline gap-3">
                  <span className="text-3xl font-bold text-green-900">
                    {ingredientCount}
                  </span>
                  <span className="text-sm text-muted-foreground">ingredients</span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Agricultural inputs tracked
                </p>
              </CardContent>
            </Card>
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Ingredient Land Use Breakdown</h3>
            <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
              Audit Level 4
            </Badge>
          </div>

          {landUseItems.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                <Mountain className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No land use data available</p>
                <p className="text-xs mt-1">Evidence data will be populated from ingredient sourcing records</p>
              </CardContent>
            </Card>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-green-50">
                    <TableHead className="font-semibold text-xs">Ingredient</TableHead>
                    <TableHead className="font-semibold text-xs">Origin</TableHead>
                    <TableHead className="font-semibold text-xs text-right">Mass</TableHead>
                    <TableHead className="font-semibold text-xs text-right">Land Intensity</TableHead>
                    <TableHead className="font-semibold text-xs text-right">Total Footprint</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {landUseItems.map((item) => {
                    const intensityBadge = getIntensityBadge(item.landIntensity);
                    return (
                      <TableRow key={item.id} className="hover:bg-green-50/50">
                        <TableCell className="font-medium text-sm">
                          <div className="flex items-center gap-2">
                            <Leaf className="h-4 w-4 text-green-600" />
                            {item.ingredient}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {item.origin}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-right">
                          {item.mass.toLocaleString('en-GB', { maximumFractionDigits: 0 })} kg
                        </TableCell>
                        <TableCell className="text-sm text-right">
                          <div className="flex flex-col items-end gap-1">
                            <span>{item.landIntensity.toFixed(2)} m²a/kg</span>
                            <Badge variant="default" className={`${intensityBadge.className} text-xs`}>
                              {intensityBadge.label}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm font-semibold text-right">
                          {item.totalFootprint.toLocaleString('en-GB', { maximumFractionDigits: 0 })} m²a
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          <Card className="bg-green-50 border-green-200">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Mountain className="h-4 w-4 text-green-600" />
                <p className="text-sm font-semibold text-green-900">ReCiPe 2016 Land Use</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Land use measures both occupation (m²·year) and transformation impacts on agricultural and natural land. The unit m²a represents square metres occupied for one year. Higher land intensity ingredients drive greater biodiversity risk through habitat loss and fragmentation.
              </p>
              <div className="flex gap-2 mt-2">
                <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">CSRD E4</Badge>
                <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">TNFD</Badge>
                <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">ReCiPe 2016</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </SheetContent>
    </Sheet>
  );
}
