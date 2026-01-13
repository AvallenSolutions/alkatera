"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Package, Layers, Edit, Box, ArrowRight } from "lucide-react";
import { fetchMultipackComponents, fetchMultipackSecondaryPackaging } from "@/lib/multipacks";
import type { MultipackComponent, MultipackSecondaryPackaging } from "@/lib/types/products";
import Link from "next/link";

interface MultipackContentsCardProps {
  productId: string;
  productName: string;
  onEdit?: () => void;
}

export function MultipackContentsCard({ productId, productName, onEdit }: MultipackContentsCardProps) {
  const [components, setComponents] = useState<MultipackComponent[]>([]);
  const [packaging, setPackaging] = useState<MultipackSecondaryPackaging[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const [componentsData, packagingData] = await Promise.all([
          fetchMultipackComponents(productId),
          fetchMultipackSecondaryPackaging(productId),
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
  const totalPackagingWeight = packaging.reduce((sum, p) => sum + p.weight_grams, 0);

  if (isLoading) {
    return (
      <Card className="backdrop-blur-xl bg-white/5 border border-white/10 animate-pulse">
        <CardHeader>
          <div className="h-6 w-48 bg-white/10 rounded" />
          <div className="h-4 w-32 bg-white/10 rounded mt-2" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="h-16 bg-white/10 rounded" />
            <div className="h-16 bg-white/10 rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="backdrop-blur-xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-indigo-500/20 flex items-center justify-center">
              <Layers className="h-5 w-5 text-indigo-400" />
            </div>
            <div>
              <CardTitle className="text-white flex items-center gap-2">
                Multipack Contents
                <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-500/30">
                  {totalUnits} units
                </Badge>
              </CardTitle>
              <CardDescription className="text-slate-400">
                {components.length} product{components.length !== 1 ? "s" : ""} in this multipack
              </CardDescription>
            </div>
          </div>
          {onEdit && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onEdit}
              className="text-indigo-400 hover:text-indigo-300"
            >
              <Edit className="h-4 w-4 mr-1" />
              Edit
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Component Products */}
        <div className="space-y-2">
          {components.map((component) => (
            <Link
              key={component.id}
              href={`/products/${component.component_product_id}`}
            >
              <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors cursor-pointer group">
                {component.component_product?.product_image_url ? (
                  <img
                    src={component.component_product.product_image_url}
                    alt={component.component_product.name}
                    className="w-12 h-12 rounded object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded bg-slate-800 flex items-center justify-center">
                    <Package className="h-6 w-6 text-slate-500" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-white truncate">
                      {component.component_product?.name || "Unknown Product"}
                    </span>
                    {component.component_product?.is_multipack && (
                      <Badge variant="secondary" className="text-xs bg-purple-500/20 text-purple-300">
                        <Layers className="h-3 w-3 mr-1" />
                        Multipack
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-slate-400">
                    {component.component_product?.sku && (
                      <span>SKU: {component.component_product.sku}</span>
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
                <div className="flex items-center gap-2">
                  <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-500/30">
                    x{component.quantity}
                  </Badge>
                  <ArrowRight className="h-4 w-4 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Secondary Packaging */}
        {packaging.length > 0 && (
          <div className="pt-3 border-t border-white/10">
            <div className="flex items-center gap-2 mb-3">
              <Box className="h-4 w-4 text-slate-400" />
              <span className="text-sm text-slate-400">Secondary Packaging</span>
              <span className="text-xs text-slate-500">({totalPackagingWeight}g total)</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {packaging.map((pkg) => (
                <Badge
                  key={pkg.id}
                  variant="outline"
                  className="bg-white/5 text-slate-300 border-slate-700"
                >
                  {pkg.material_name} ({pkg.weight_grams}g)
                  {pkg.is_recyclable && (
                    <span className="ml-1 text-green-400">♻</span>
                  )}
                </Badge>
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
          <div className="pt-3 border-t border-white/10">
            <span className="text-sm text-slate-400 block mb-2">
              Certifications from components
            </span>
            <div className="flex flex-wrap gap-2">
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
                <Badge
                  key={certName}
                  className="bg-green-500/20 text-green-300 border-green-500/30"
                >
                  {certName}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
