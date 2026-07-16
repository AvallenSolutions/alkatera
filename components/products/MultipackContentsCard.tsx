"use client";

import { useState, useEffect } from "react";
import { Package, ArrowRight } from "lucide-react";
import { Panel } from "@/components/studio/panel";
import { Eyebrow } from "@/components/studio/eyebrow";
import { BigNumber } from "@/components/studio/big-number";
import { StateChip } from "@/components/studio/state-chip";
import { PillButton } from "@/components/studio/pill-button";
import { fetchMultipackComponents, fetchMultipackPackagingMaterials } from "@/lib/multipacks";
import type { MultipackComponent } from "@/lib/types/products";
import Link from "next/link";

interface MultipackContentsCardProps {
  productId: string;
  productName: string;
  onEdit?: () => void;
}

export function MultipackContentsCard({ productId, productName, onEdit }: MultipackContentsCardProps) {
  const [components, setComponents] = useState<MultipackComponent[]>([]);
  // Packaging now lives on product_materials (unified with single SKUs), so
  // Overview reads the same rows the Specification tab and calculator use.
  const [packaging, setPackaging] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const [componentsData, packagingData] = await Promise.all([
          fetchMultipackComponents(productId),
          fetchMultipackPackagingMaterials(productId),
        ]);
        setComponents(componentsData);
        setPackaging(packagingData);
      } catch (error) {
        console.error("Error loading multipack data:", error);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [productId]);

  const totalUnits = components.reduce((sum, c) => sum + c.quantity, 0);
  const totalPackagingWeight = packaging.reduce(
    (sum, p) => sum + (Number(p.net_weight_g) || 0),
    0
  );

  if (isLoading) {
    return (
      <Panel>
        <div className="animate-pulse space-y-4">
          <div className="h-5 w-48 rounded bg-studio-hairline/50" />
          <div className="h-4 w-32 rounded bg-studio-hairline/50" />
          <div className="space-y-3">
            <div className="h-14 rounded bg-studio-hairline/50" />
            <div className="h-14 rounded bg-studio-hairline/50" />
          </div>
        </div>
      </Panel>
    );
  }

  return (
    <Panel>
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-display text-sm font-semibold text-foreground">Multipack contents</h3>
          <p className="mt-0.5 text-xs text-studio-dim">
            {components.length} product{components.length !== 1 ? "s" : ""} in this multipack
          </p>
        </div>
        <div className="flex items-center gap-5">
          <BigNumber size="panel" value={totalUnits} label="UNITS" />
          {onEdit && (
            <PillButton variant="ghost" size="sm" onClick={onEdit}>
              Edit
            </PillButton>
          )}
        </div>
      </div>

      {/* Component Products */}
      <div className="mt-5">
        {components.map((component) => (
          <Link
            key={component.id}
            href={`/products/${component.component_product_id}`}
            className="block"
          >
            <div className="flex items-center gap-3 py-3 border-b border-studio-hairline last:border-b-0 group">
              {component.component_product?.product_image_url ? (
                <img
                  src={component.component_product.product_image_url}
                  alt={component.component_product.name}
                  className="w-12 h-12 rounded object-cover"
                />
              ) : (
                <div className="w-12 h-12 rounded bg-studio-hairline/40 flex items-center justify-center">
                  <Package className="h-6 w-6 text-studio-dim" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-display font-semibold text-foreground truncate">
                    {component.component_product?.name || "Unknown Product"}
                  </span>
                  {component.component_product?.is_multipack && (
                    <StateChip tone="quiet">Multipack</StateChip>
                  )}
                </div>
                <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-studio-dim">
                  {component.component_product?.sku && (
                    <span>SKU {component.component_product.sku}</span>
                  )}
                  {component.component_product?.unit_size_value &&
                    component.component_product?.unit_size_unit && (
                      <span className="ml-2">
                        {component.component_product.unit_size_value}{" "}
                        {component.component_product.unit_size_unit}
                      </span>
                    )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs font-bold tabular-nums text-foreground">
                  x{component.quantity}
                </span>
                <ArrowRight className="h-4 w-4 text-studio-dim opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Secondary Packaging */}
      {packaging.length > 0 && (
        <div className="mt-5 pt-4 border-t border-studio-hairline">
          <div className="flex items-center gap-3 mb-3">
            <Eyebrow tone="dim">Transit &amp; secondary packaging</Eyebrow>
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-studio-dim">
              {totalPackagingWeight.toFixed(1)}g total
            </span>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {packaging.map((pkg) => (
              <span key={pkg.id} className="inline-flex items-center gap-2">
                <StateChip tone="quiet">
                  {pkg.material_name} ({Number(pkg.net_weight_g) || 0}g)
                </StateChip>
                {Number(pkg.recyclability_percent) > 0 && (
                  <StateChip tone="good">Recyclable</StateChip>
                )}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Aggregated Certifications */}
      {components.some(
        (c) =>
          c.component_product?.certifications &&
          c.component_product.certifications.length > 0
      ) && (
        <div className="mt-5 pt-4 border-t border-studio-hairline">
          <Eyebrow tone="dim" className="mb-2">Certifications from components</Eyebrow>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {Array.from(
              new Set(
                components.flatMap(
                  (c) =>
                    c.component_product?.certifications?.map(
                      (cert) => cert.name
                    ) || []
                )
              )
            ).map((certName) => (
              <StateChip key={certName} tone="good">
                {certName}
              </StateChip>
            ))}
          </div>
        </div>
      )}
    </Panel>
  );
}
