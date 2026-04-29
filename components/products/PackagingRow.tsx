"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ChevronDown,
  ChevronUp,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Package,
  Tag,
  Grip,
  Box,
  Truck,
  Layers,
  Shield,
  Database,
} from "lucide-react";
import { PackagingEditorTabs } from "@/components/products/PackagingEditorTabs";
import type { PackagingFormData } from "@/components/products/PackagingFormCard";
import type { PackagingCategory } from "@/lib/types/lca";
import {
  getPackagingSectionStatus,
  summarisePackagingSections,
} from "@/components/products/lib/section-completion";

interface PackagingRowProps {
  packaging: PackagingFormData;
  index: number;
  organizationId: string;
  productionFacilities: any[];
  totalLinkedFacilities?: number;
  organizationLat?: number | null;
  organizationLng?: number | null;
  linkedSupplierProducts?: any[];
  onUpdate: (tempId: string, updates: Partial<PackagingFormData>) => void;
  onRemove: (tempId: string) => void;
  onAddNewWithType?: (category: PackagingCategory) => void;
  canRemove: boolean;
  defaultExpanded?: boolean;
}

const TYPE_META: Record<string, { icon: typeof Package; label: string }> = {
  container: { icon: Package, label: 'Container' },
  label: { icon: Tag, label: 'Label' },
  closure: { icon: Grip, label: 'Closure' },
  secondary: { icon: Box, label: 'Secondary' },
  shipment: { icon: Truck, label: 'Shipment' },
  tertiary: { icon: Layers, label: 'Tertiary' },
};

function dataSourceBadge(packaging: PackagingFormData) {
  if (packaging.data_source === 'supplier') {
    return (
      <Badge variant="outline" className="text-xs gap-1 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800">
        <Shield className="h-3 w-3 text-emerald-600" /> Supplier
      </Badge>
    );
  }
  if (packaging.data_source === 'openlca' || packaging.data_source === 'ecoinvent') {
    return (
      <Badge variant="outline" className="text-xs gap-1">
        <Database className="h-3 w-3" /> Database
      </Badge>
    );
  }
  return null;
}

function isRowComplete(packaging: PackagingFormData): boolean {
  return Boolean(
    packaging.packaging_category &&
    packaging.name &&
    Number(packaging.net_weight_g) > 0 &&
    packaging.data_source,
  );
}

export function PackagingRow(props: PackagingRowProps) {
  const { packaging, index, onRemove, canRemove, defaultExpanded } = props;
  const [expanded, setExpanded] = useState<boolean>(defaultExpanded ?? !isRowComplete(packaging));

  const meta = packaging.packaging_category ? TYPE_META[packaging.packaging_category] : null;
  const Icon = meta?.icon ?? Package;

  const weight = packaging.net_weight_g ? `${packaging.net_weight_g} g` : null;
  const carbonPreview = packaging.carbon_intensity != null
    ? `${packaging.carbon_intensity.toFixed(3)} kg CO₂e/kg`
    : null;

  const sectionStatus = getPackagingSectionStatus(packaging);
  const summary = summarisePackagingSections(sectionStatus);
  const allComplete = summary.complete === summary.total && summary.total > 0;

  return (
    <Card>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted/40 rounded-t-md focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <div className="flex h-7 w-7 items-center justify-center rounded bg-orange-500 text-white flex-shrink-0">
          <Icon className="h-3.5 w-3.5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">
              {packaging.name || (
                <span className="text-muted-foreground italic">
                  {meta ? `New ${meta.label.toLowerCase()}` : "New packaging item"}
                </span>
              )}
            </span>
            {allComplete ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" aria-label="Complete" />
            ) : (
              <AlertCircle className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" aria-label="Incomplete" />
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
            {meta && <Badge variant="outline" className="text-xs">{meta.label}</Badge>}
            {weight && <span>· {weight}</span>}
            {dataSourceBadge(packaging)}
            {carbonPreview && <span>· {carbonPreview}</span>}
            {summary.total > 0 && (
              <span>· {summary.complete} of {summary.total} sections complete</span>
            )}
          </div>
        </div>
        <span className="text-muted-foreground flex-shrink-0" aria-hidden>
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
        {canRemove && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onRemove(packaging.tempId);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                onRemove(packaging.tempId);
              }
            }}
            className="flex-shrink-0 inline-flex items-center justify-center h-7 w-7 rounded text-destructive hover:bg-destructive/10 cursor-pointer"
            aria-label="Remove packaging"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </span>
        )}
      </button>

      {expanded && (
        <div className="border-t px-3 py-3">
          <PackagingEditorTabs {...props} />
        </div>
      )}
    </Card>
  );
}
