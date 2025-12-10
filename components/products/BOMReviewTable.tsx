"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Trash2,
  Package,
  Beaker,
  AlertCircle,
  CheckCircle2,
  Info,
} from "lucide-react";
import type { ExtractedBOMItem } from "@/lib/bom/types";

export interface ReviewableBOMItem extends ExtractedBOMItem {
  id: string;
  selected: boolean;
  hasError: boolean;
  errorMessage?: string;
}

interface BOMReviewTableProps {
  items: ReviewableBOMItem[];
  onItemsChange: (items: ReviewableBOMItem[]) => void;
  onImport: (items: ReviewableBOMItem[]) => void;
  onCancel: () => void;
  isImporting?: boolean;
}

const UNITS = [
  { value: 'kg', label: 'Kilograms (kg)' },
  { value: 'g', label: 'Grams (g)' },
  { value: 'L', label: 'Litres (L)' },
  { value: 'ml', label: 'Millilitres (ml)' },
  { value: 'm', label: 'Metres (m)' },
  { value: 'unit', label: 'Units' },
];

export function BOMReviewTable({
  items,
  onItemsChange,
  onImport,
  onCancel,
  isImporting = false,
}: BOMReviewTableProps) {
  const [selectAll, setSelectAll] = useState(true);

  const updateItem = (id: string, updates: Partial<ReviewableBOMItem>) => {
    const newItems = items.map(item => {
      if (item.id === id) {
        const updated = { ...item, ...updates };
        updated.hasError = !updated.cleanName || updated.cleanName.length < 2;
        if (updated.hasError) {
          updated.errorMessage = 'Name is required';
        } else {
          updated.errorMessage = undefined;
        }
        return updated;
      }
      return item;
    });
    onItemsChange(newItems);
  };

  const removeItem = (id: string) => {
    onItemsChange(items.filter(item => item.id !== id));
  };

  const toggleSelectAll = () => {
    const newValue = !selectAll;
    setSelectAll(newValue);
    onItemsChange(items.map(item => ({ ...item, selected: newValue })));
  };

  const selectedItems = items.filter(item => item.selected);
  const ingredientCount = selectedItems.filter(item => item.itemType === 'ingredient').length;
  const packagingCount = selectedItems.filter(item => item.itemType === 'packaging').length;
  const hasErrors = items.some(item => item.selected && item.hasError);

  const handleImport = () => {
    if (hasErrors) return;
    onImport(selectedItems);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
            <Beaker className="h-3 w-3 mr-1" />
            {ingredientCount} Ingredient{ingredientCount !== 1 ? 's' : ''}
          </Badge>
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            <Package className="h-3 w-3 mr-1" />
            {packagingCount} Packaging
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            id="select-all"
            checked={selectAll}
            onCheckedChange={toggleSelectAll}
          />
          <label htmlFor="select-all" className="text-sm cursor-pointer">
            Select All
          </label>
        </div>
      </div>

      {hasErrors && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Some items have validation errors. Please fix them before importing.
          </AlertDescription>
        </Alert>
      )}

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50 dark:bg-slate-900">
              <TableHead className="w-10"></TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="w-28">Quantity</TableHead>
              <TableHead className="w-32">Unit</TableHead>
              <TableHead className="w-36">Type</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow
                key={item.id}
                className={item.hasError && item.selected ? 'bg-red-50 dark:bg-red-950' : ''}
              >
                <TableCell>
                  <Checkbox
                    checked={item.selected}
                    onCheckedChange={(checked) =>
                      updateItem(item.id, { selected: checked as boolean })
                    }
                  />
                </TableCell>

                <TableCell>
                  <div className="space-y-1">
                    <Input
                      value={item.cleanName}
                      onChange={(e) => updateItem(item.id, { cleanName: e.target.value })}
                      className={item.hasError && item.selected ? 'border-red-500' : ''}
                      placeholder="Material name"
                    />
                    {item.rawName !== item.cleanName && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <p className="text-xs text-muted-foreground truncate max-w-xs cursor-help">
                              <Info className="h-3 w-3 inline mr-1" />
                              Original: {item.rawName.slice(0, 40)}...
                            </p>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-sm">
                            <p className="text-xs">{item.rawName}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                </TableCell>

                <TableCell>
                  <Input
                    type="number"
                    step="0.0001"
                    value={item.quantity ?? ''}
                    onChange={(e) =>
                      updateItem(item.id, {
                        quantity: e.target.value ? parseFloat(e.target.value) : null,
                      })
                    }
                    placeholder="0"
                    className="w-24"
                  />
                </TableCell>

                <TableCell>
                  <Select
                    value={item.unit || 'kg'}
                    onValueChange={(value) => updateItem(item.id, { unit: value })}
                  >
                    <SelectTrigger className="w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {UNITS.map((unit) => (
                        <SelectItem key={unit.value} value={unit.value}>
                          {unit.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>

                <TableCell>
                  <Select
                    value={item.itemType}
                    onValueChange={(value: 'ingredient' | 'packaging') =>
                      updateItem(item.id, { itemType: value })
                    }
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ingredient">
                        <div className="flex items-center gap-2">
                          <Beaker className="h-4 w-4 text-orange-500" />
                          Ingredient
                        </div>
                      </SelectItem>
                      <SelectItem value="packaging">
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-blue-500" />
                          Packaging
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>

                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeItem(item.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}

            {items.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No items to review
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between pt-4 border-t">
        <p className="text-sm text-muted-foreground">
          {selectedItems.length} of {items.length} items selected for import
        </p>

        <div className="flex gap-3">
          <Button variant="outline" onClick={onCancel} disabled={isImporting}>
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={selectedItems.length === 0 || hasErrors || isImporting}
          >
            {isImporting ? (
              <>Importing...</>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Import {selectedItems.length} Item{selectedItems.length !== 1 ? 's' : ''}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function createReviewableItems(items: ExtractedBOMItem[]): ReviewableBOMItem[] {
  return items.map((item, index) => ({
    ...item,
    id: `bom-item-${index}-${Date.now()}`,
    selected: true,
    hasError: !item.cleanName || item.cleanName.length < 2,
    errorMessage: !item.cleanName || item.cleanName.length < 2 ? 'Name is required' : undefined,
  }));
}
