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
import { Recycle, Trash2, Flame } from 'lucide-react';

interface WasteStreamItem {
  id: string;
  stream: string;
  disposition: 'recycling' | 'landfill' | 'incineration' | 'composting' | 'anaerobic_digestion';
  mass: number;
  circularityScore: number;
}

interface CircularitySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  totalWaste: number;
  circularityRate: number;
  wasteStreams: WasteStreamItem[];
}

export function CircularitySheet({
  open,
  onOpenChange,
  totalWaste,
  circularityRate,
  wasteStreams,
}: CircularitySheetProps) {
  const getDispositionBadge = (disposition: string) => {
    const config: Record<string, { icon: any; className: string; label: string }> = {
      recycling: { icon: Recycle, className: 'bg-green-600', label: 'Recycling' },
      composting: { icon: Recycle, className: 'bg-green-600', label: 'Composting' },
      anaerobic_digestion: { icon: Recycle, className: 'bg-green-600', label: 'Anaerobic Digestion' },
      incineration: { icon: Flame, className: 'bg-orange-600', label: 'Incineration' },
      landfill: { icon: Trash2, className: 'bg-red-600', label: 'Landfill' },
    };

    const { icon: Icon, className, label } = config[disposition] || config.landfill;
    return (
      <Badge variant="default" className={`${className} gap-1`}>
        <Icon className="h-3 w-3" />
        {label}
      </Badge>
    );
  };

  const getCircularityBadge = (score: number) => {
    if (score >= 80) return { className: 'bg-green-600', label: `${score}% (Circular)` };
    if (score >= 40) return { className: 'bg-amber-600', label: `${score}% (Transitional)` };
    return { className: 'bg-red-600', label: `${score}% (Linear)` };
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-3xl overflow-y-auto">
        <SheetHeader className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100">
              <Recycle className="h-5 w-5 text-amber-600" />
            </div>
            <div className="flex-1">
              <SheetTitle>Circularity & Waste Streams</SheetTitle>
              <SheetDescription className="mt-1">
                Material flow analysis showing the fate of waste streams and circular economy performance
              </SheetDescription>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <Card className="bg-amber-50 border-amber-200">
              <CardContent className="p-4">
                <div className="flex items-baseline gap-3">
                  <span className="text-3xl font-bold text-amber-900">
                    {totalWaste.toLocaleString('en-GB', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                  </span>
                  <span className="text-sm text-muted-foreground">kg</span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Total waste generated
                </p>
              </CardContent>
            </Card>

            <Card className="bg-amber-50 border-amber-200">
              <CardContent className="p-4">
                <div className="flex items-baseline gap-3">
                  <span className="text-3xl font-bold text-amber-900">
                    {circularityRate.toFixed(3)}%
                  </span>
                  <span className="text-sm text-muted-foreground">circular</span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Circularity score
                </p>
              </CardContent>
            </Card>
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Waste Stream Breakdown</h3>
            <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
              Audit Level 4
            </Badge>
          </div>

          {wasteStreams.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                <Recycle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No waste stream data available</p>
                <p className="text-xs mt-1">Evidence data will be populated from waste manifests</p>
              </CardContent>
            </Card>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-amber-50">
                    <TableHead className="font-semibold text-xs">Stream</TableHead>
                    <TableHead className="font-semibold text-xs">Disposition</TableHead>
                    <TableHead className="font-semibold text-xs text-right">Mass</TableHead>
                    <TableHead className="font-semibold text-xs">Circularity Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {wasteStreams.map((item) => {
                    const circularityBadge = getCircularityBadge(item.circularityScore);
                    return (
                      <TableRow key={item.id} className="hover:bg-amber-50/50">
                        <TableCell className="font-medium text-sm">
                          {item.stream}
                        </TableCell>
                        <TableCell className="text-sm">
                          {getDispositionBadge(item.disposition)}
                        </TableCell>
                        <TableCell className="text-sm text-right">
                          {item.mass.toLocaleString('en-GB', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} kg
                        </TableCell>
                        <TableCell className="text-sm">
                          <Badge variant="default" className={circularityBadge.className}>
                            {circularityBadge.label}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          <Card className="bg-amber-50 border-amber-200">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Recycle className="h-4 w-4 text-amber-600" />
                <p className="text-sm font-semibold text-amber-900">Circular Economy Metrics</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Circularity scores reflect the extent to which materials are kept in use. Recycling, composting, and anaerobic digestion score 100% (circular). Incineration with energy recovery scores 50% (transitional). Landfill scores 0% (linear).
              </p>
              <div className="flex gap-2 mt-2">
                <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">CSRD E5</Badge>
                <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">Ellen MacArthur</Badge>
                <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">EU Taxonomy</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </SheetContent>
    </Sheet>
  );
}
