"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BOMUploadDialog } from "./BOMUploadDialog";
import { BOMReviewTable, createReviewableItems, type ReviewableBOMItem } from "./BOMReviewTable";
import type { ExtractedBOMItem, BOMParseResult } from "@/lib/bom/types";
import type { IngredientFormData } from "./IngredientFormCard";
import type { PackagingFormData } from "./PackagingFormCard";

type ImportStep = 'upload' | 'review';

interface BOMImportFlowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: (
    ingredients: IngredientFormData[],
    packaging: PackagingFormData[]
  ) => void;
  organizationId: string;
}

export function BOMImportFlow({
  open,
  onOpenChange,
  onImportComplete,
  organizationId,
}: BOMImportFlowProps) {
  const [step, setStep] = useState<ImportStep>('upload');
  const [reviewItems, setReviewItems] = useState<ReviewableBOMItem[]>([]);
  const [metadata, setMetadata] = useState<BOMParseResult['metadata']>({});
  const [isImporting, setIsImporting] = useState(false);

  const handleItemsExtracted = (
    items: ExtractedBOMItem[],
    extractedMetadata: BOMParseResult['metadata']
  ) => {
    console.log('[BOMImportFlow] Items extracted:', items.length);
    const reviewable = createReviewableItems(items);
    console.log('[BOMImportFlow] Reviewable items created:', reviewable.length);
    setReviewItems(reviewable);
    setMetadata(extractedMetadata);
    setStep('review');
    console.log('[BOMImportFlow] Step set to review');
  };

  const handleImport = async (selectedItems: ReviewableBOMItem[]) => {
    console.log('[BOMImportFlow] Import started with', selectedItems.length, 'items');
    setIsImporting(true);

    try {
      const ingredients: IngredientFormData[] = [];
      const packaging: PackagingFormData[] = [];

      for (const item of selectedItems) {
        if (item.itemType === 'ingredient') {
          const ingredientData: IngredientFormData = {
            tempId: `ing-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: item.cleanName,
            data_source: null,
            amount: item.quantity ?? 0,
            unit: mapUnit(item.unit),
            origin_country: '',
            is_organic_certified: false,
            transport_mode: 'truck',
            distance_km: 0,
          };
          ingredients.push(ingredientData);
        } else {
          const packagingData: PackagingFormData = {
            tempId: `pkg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: item.cleanName,
            data_source: null,
            amount: item.quantity ?? 0,
            unit: mapUnit(item.unit),
            packaging_category: detectPackagingCategory(item.cleanName),
            recycled_content_percentage: 0,
            printing_process: 'standard_ink',
            net_weight_g: convertToGrams(item.quantity, item.unit),
            origin_country: '',
            transport_mode: 'truck',
            distance_km: 0,
          };
          packaging.push(packagingData);
        }
      }

      console.log('[BOMImportFlow] Calling onImportComplete with:', ingredients.length, 'ingredients,', packaging.length, 'packaging');
      onImportComplete(ingredients, packaging);
      handleClose();
    } catch (error) {
      console.error('[BOMImportFlow] Import failed:', error);
    } finally {
      setIsImporting(false);
    }
  };

  const handleClose = () => {
    setStep('upload');
    setReviewItems([]);
    setMetadata({});
    onOpenChange(false);
  };

  const handleCancel = () => {
    if (step === 'review') {
      setStep('upload');
      setReviewItems([]);
    } else {
      handleClose();
    }
  };

  console.log('[BOMImportFlow] Current step:', step, 'reviewItems:', reviewItems.length);

  if (step === 'upload') {
    return (
      <BOMUploadDialog
        open={open}
        onOpenChange={handleClose}
        onItemsExtracted={handleItemsExtracted}
      />
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Review Extracted Items</DialogTitle>
          <DialogDescription>
            {metadata.productDescription && (
              <span className="block">
                Product: <strong>{metadata.productDescription}</strong>
              </span>
            )}
            Review and edit the extracted items before importing them to your product specification.
          </DialogDescription>
        </DialogHeader>

        <BOMReviewTable
          items={reviewItems}
          onItemsChange={setReviewItems}
          onImport={handleImport}
          onCancel={handleCancel}
          isImporting={isImporting}
        />
      </DialogContent>
    </Dialog>
  );
}

function mapUnit(unit: string | null): string {
  if (!unit) return 'kg';

  const unitMap: Record<string, string> = {
    'kg': 'kg',
    'g': 'g',
    'L': 'l',
    'l': 'l',
    'ml': 'ml',
    'm': 'unit',
    'unit': 'unit',
  };

  return unitMap[unit] || 'kg';
}

function detectPackagingCategory(name: string): 'container' | 'label' | 'closure' | 'secondary' | null {
  const nameLower = name.toLowerCase();

  if (nameLower.includes('label') || nameLower.includes('sticker')) {
    return 'label';
  }
  if (nameLower.includes('cap') || nameLower.includes('lid') ||
      nameLower.includes('closure') || nameLower.includes('cork') ||
      nameLower.includes('capsule')) {
    return 'closure';
  }
  if (nameLower.includes('box') || nameLower.includes('carton') ||
      nameLower.includes('divider') || nameLower.includes('tape') ||
      nameLower.includes('case') || nameLower.includes('crate')) {
    return 'secondary';
  }
  if (nameLower.includes('bottle') || nameLower.includes('glass') ||
      nameLower.includes('jar') || nameLower.includes('can') ||
      nameLower.includes('container') || nameLower.includes('pouch')) {
    return 'container';
  }

  return 'container';
}

function convertToGrams(quantity: number | null, unit: string | null): number {
  if (!quantity) return 0;

  switch (unit) {
    case 'kg':
      return quantity * 1000;
    case 'g':
      return quantity;
    default:
      return quantity;
  }
}
