"use client";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2, Database, Building2 } from "lucide-react";

interface ConfirmationData {
  ingredientName: string;
  dataSource: 'openlca' | 'supplier';
  supplierName?: string;
  carbonIntensity?: number;
  unit?: string;
}

interface IngredientConfirmationPopoverProps {
  data: ConfirmationData;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  onCancel: () => void;
  children: React.ReactNode;
}

export function IngredientConfirmationPopover({
  data,
  open,
  onOpenChange,
  onConfirm,
  onCancel,
  children,
}: IngredientConfirmationPopoverProps) {
  const isGeneric = data.dataSource === 'openlca';

  const handleConfirm = () => {
    onConfirm();
    onOpenChange(false);
  };

  const handleCancel = () => {
    onCancel();
    onOpenChange(false);
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent className="w-[360px]" align="start">
        <div className="space-y-4">
          {isGeneric ? (
            <>
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/20">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-sm">Confirm Generic Data</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Industry-average data source
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm">
                  You're selecting <strong>{data.ingredientName}</strong> from the OpenLCA database.
                </p>
                <p className="text-sm text-muted-foreground">
                  This will use industry-average data instead of supplier-specific data,
                  which may be less accurate for your product.
                </p>
              </div>

              {data.unit && (
                <div className="flex items-center justify-between p-2 rounded-md bg-grey-50 dark:bg-grey-900/20">
                  <span className="text-xs text-muted-foreground">Unit:</span>
                  <Badge variant="secondary" className="bg-grey-100 text-grey-800 dark:bg-grey-800 dark:text-grey-100">
                    {data.unit}
                  </Badge>
                </div>
              )}

              <div className="flex items-center gap-2 p-2 rounded-md bg-grey-50 dark:bg-grey-900/20">
                <Database className="h-4 w-4 text-grey-600" />
                <span className="text-xs text-muted-foreground">OpenLCA Database</span>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/20">
                  <CheckCircle2 className="h-5 w-5 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-sm">Confirm Primary Data</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Supplier-specific data source
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm">
                  You're selecting <strong>{data.ingredientName}</strong> from{' '}
                  <strong>{data.supplierName}</strong>.
                </p>
                <p className="text-sm text-muted-foreground">
                  This uses supplier-specific primary data for higher accuracy
                  in your LCA calculations.
                </p>
              </div>

              {data.carbonIntensity && (
                <div className="flex items-center justify-between p-2 rounded-md bg-blue-50 dark:bg-blue-900/20">
                  <span className="text-xs text-muted-foreground">Carbon Intensity:</span>
                  <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100">
                    {data.carbonIntensity.toFixed(2)} kg CO2e/{data.unit || 'unit'}
                  </Badge>
                </div>
              )}

              <div className="flex items-center gap-2 p-2 rounded-md bg-blue-50 dark:bg-blue-900/20">
                <Building2 className="h-4 w-4 text-blue-600" />
                <span className="text-xs text-muted-foreground">{data.supplierName}</span>
              </div>
            </>
          )}

          <div className="flex gap-2 pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleConfirm}
              className={`flex-1 ${
                isGeneric
                  ? 'bg-amber-600 hover:bg-amber-700'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isGeneric ? 'Add Generic Ingredient' : `Add from ${data.supplierName}`}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
