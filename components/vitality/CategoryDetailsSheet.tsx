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
import { FileText, Package, Plane, Truck } from 'lucide-react';

interface EvidenceItem {
  id: string;
  name: string;
  detail: string;
  quantity: number;
  unit: string;
  emissionFactor: number;
  totalImpact: number;
}

interface CategoryDetailsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoryName: string;
  categoryId: string;
  evidenceItems: EvidenceItem[];
  totalImpact: number;
}

export function CategoryDetailsSheet({
  open,
  onOpenChange,
  categoryName,
  categoryId,
  evidenceItems,
  totalImpact,
}: CategoryDetailsSheetProps) {
  const getCategoryIcon = () => {
    if (categoryId === 'purchased_goods') return Package;
    if (categoryId === 'business_travel') return Plane;
    if (categoryId === 'upstream_transport') return Truck;
    return FileText;
  };

  const Icon = getCategoryIcon();

  const getCategoryDescription = () => {
    switch (categoryId) {
      case 'purchased_goods':
        return 'Emissions from the production of purchased goods and services, including raw materials and packaging';
      case 'business_travel':
        return 'Emissions from employee business travel in vehicles not owned by the organisation';
      case 'upstream_transport':
        return 'Emissions from transportation and distribution of purchased goods between suppliers and facilities';
      default:
        return 'Detailed breakdown of emission sources contributing to this category';
    }
  };

  const getColumnHeaders = () => {
    switch (categoryId) {
      case 'purchased_goods':
        return ['Item Name', 'Supplier', 'Quantity', 'Emission Factor', 'Total Impact'];
      case 'business_travel':
        return ['Route', 'Mode', 'Class', 'Distance', 'Total Impact'];
      case 'upstream_transport':
        return ['Route', 'Mode', 'Weight', 'Distance', 'Total Impact'];
      default:
        return ['Item', 'Detail', 'Quantity', 'Factor', 'Impact'];
    }
  };

  const columns = getColumnHeaders();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100">
              <Icon className="h-5 w-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <SheetTitle>{categoryName}</SheetTitle>
              <SheetDescription className="mt-1">
                {getCategoryDescription()}
              </SheetDescription>
            </div>
          </div>

          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-4">
              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-bold text-blue-900">
                  {totalImpact.toLocaleString('en-GB', { maximumFractionDigits: 0 })}
                </span>
                <span className="text-sm text-muted-foreground">kg CO₂eq</span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Total category emissions from {evidenceItems.length} line item{evidenceItems.length !== 1 ? 's' : ''}
              </p>
            </CardContent>
          </Card>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Evidence Trail</h3>
            <Badge variant="outline" className="text-xs">
              Audit Level 4
            </Badge>
          </div>

          {evidenceItems.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No evidence items available for this category</p>
                <p className="text-xs mt-1">Evidence data will be populated from activity logs</p>
              </CardContent>
            </Card>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    {columns.map((col, idx) => (
                      <TableHead key={idx} className="font-semibold text-xs">
                        {col}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {evidenceItems.map((item) => (
                    <TableRow key={item.id} className="hover:bg-gray-50">
                      <TableCell className="font-medium text-sm">{item.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {item.detail}
                      </TableCell>
                      <TableCell className="text-sm">
                        {item.quantity.toLocaleString('en-GB', { maximumFractionDigits: 2 })} {item.unit}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {item.emissionFactor.toLocaleString('en-GB', { maximumFractionDigits: 4 })} kg/unit
                      </TableCell>
                      <TableCell className="text-sm font-semibold">
                        {item.totalImpact.toLocaleString('en-GB', { maximumFractionDigits: 2 })} kg
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <Card className="bg-amber-50 border-amber-200">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-amber-600" />
                <p className="text-sm font-semibold text-amber-900">Audit Trail Compliance</p>
              </div>
              <p className="text-xs text-muted-foreground">
                This evidence drawer shows the raw line items that sum up to the category total, ensuring full traceability for CSRD Article 8 compliance and third-party verification.
              </p>
              <div className="flex gap-2 mt-2">
                <Badge variant="outline" className="text-xs">ISO 14064-1</Badge>
                <Badge variant="outline" className="text-xs">GHG Protocol</Badge>
                <Badge variant="outline" className="text-xs">CSRD E1</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </SheetContent>
    </Sheet>
  );
}
